import http, { IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { HttpConfig, isLoopbackHost } from "../config/runtimeConfig";
import {
  AuthError,
  Authenticator,
  createAuthenticator,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
} from "./auth";
import { AuditLogger } from "./auditLogger";

interface Session {
  transport: StreamableHTTPServerTransport;
  server: Server;
  clientId: string;
  lastSeen: number;
}

export interface HttpServerOptions {
  config: HttpConfig;
  /** Builds a fresh MCP server (with handlers) for each session */
  createServer: () => Server;
  auditLogger: AuditLogger;
  /** Called once when a session ends (closed, deleted, or expired) */
  onSessionClosed?: (sessionId: string) => void;
  authenticator?: Authenticator;
}

export interface RunningHttpServer {
  server: http.Server;
  /** Address actually bound (port is resolved when 0 was requested) */
  url: string;
  sessionCount: () => number;
  close: () => Promise<void>;
}

class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const sendJson = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void => {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

const readJsonBody = (req: IncomingMessage, maxBytes: number): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (maxBytes > 0 && size > maxBytes) {
        failed = true;
        reject(new RequestBodyError(`Request body exceeds ${maxBytes} bytes`, 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new RequestBodyError("Parse error: request body is not valid JSON", 400));
      }
    });
    req.on("error", (error) => {
      if (!failed) reject(error);
    });
  });

/** Hostname from a Host header value, without the port ("[::1]:3000" -> "[::1]"). */
const hostnameOf = (hostHeader: string): string => {
  const value = hostHeader.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(0, end + 1);
  }
  return value.split(":")[0];
};

export const startHttpServer = async (options: HttpServerOptions): Promise<RunningHttpServer> => {
  const { config, createServer, auditLogger } = options;
  const authenticator = options.authenticator || createAuthenticator(config);
  const sessions = new Map<string, Session>();
  const metadataPaths = new Set(["/.well-known/oauth-protected-resource", `/.well-known/oauth-protected-resource${config.path}`]);
  const resourceMetadataUrl = protectedResourceMetadataUrl(config);
  const allowedOrigins = new Set(config.allowedOrigins.map((origin) => origin.replace(/\/+$/, "").toLowerCase()));

  const clientIpOf = (req: IncomingMessage): string => {
    if (config.trustProxy) {
      const forwarded = req.headers["x-forwarded-for"];
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || "").split(",")[0].trim();
      if (first) return first;
    }
    return req.socket.remoteAddress || "unknown";
  };

  const isHostAllowed = (hostHeader: string | undefined): boolean => {
    if (config.allowedHosts.length === 0) return true;
    if (!hostHeader) return false;
    return config.allowedHosts.includes(hostnameOf(hostHeader));
  };

  const isOriginAllowed = (origin: string): boolean => {
    const normalized = origin.replace(/\/+$/, "").toLowerCase();
    if (allowedOrigins.size > 0) return allowedOrigins.has(normalized);
    // Default: only local browser tools may call a loopback-bound server
    if (!isLoopbackHost(config.host)) return false;
    try {
      return isLoopbackHost(new URL(normalized).hostname);
    } catch {
      return false;
    }
  };

  const setCorsHeaders = (res: ServerResponse, origin: string): void => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
  };

  const authenticateHeader = (error?: AuthError): string => {
    const parts = ['Bearer realm="mysql-mcp"'];
    if (resourceMetadataUrl && config.auth === "oauth") {
      parts.push(`resource_metadata="${resourceMetadataUrl}"`);
    }
    // RFC 6750: no error code when the request carried no credentials
    if (error && error.oauthError !== "invalid_request") {
      parts.push(`error="${error.oauthError}"`, `error_description="${error.message.replace(/"/g, "'")}"`);
    }
    if (error?.oauthError === "insufficient_scope" && config.oauth?.requiredScopes.length) {
      parts.push(`scope="${config.oauth.requiredScopes.join(" ")}"`);
    }
    return parts.join(", ");
  };

  const closeSession = (sessionId: string, reason: string): void => {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    try {
      options.onSessionClosed?.(sessionId);
    } catch (error: any) {
      console.error(`Session ${sessionId} cleanup failed: ${error.message}`);
    }
    auditLogger.log({ event: "session_closed", session: sessionId, client: session.clientId, reason });
    // server.close() closes the transport, whose onclose re-enters here as a no-op
    session.server.close().catch(() => undefined);
  };

  const findSession = (
    req: IncomingMessage,
    res: ServerResponse,
    authInfo: AuthInfo,
  ): Session | undefined => {
    const header = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(header) ? header[0] : header;
    if (!sessionId) {
      sendJson(res, 400, jsonRpcError(-32000, "Bad Request: Mcp-Session-Id header is required"));
      return undefined;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      sendJson(res, 404, jsonRpcError(-32001, "Session not found"));
      return undefined;
    }
    if (session.clientId !== authInfo.clientId) {
      sendJson(res, 403, jsonRpcError(-32000, "Forbidden: session belongs to another client"));
      return undefined;
    }
    session.lastSeen = Date.now();
    return session;
  };

  const startSession = async (
    req: IncomingMessage,
    res: ServerResponse,
    authInfo: AuthInfo,
    body: unknown,
  ): Promise<void> => {
    if (config.maxSessions > 0 && sessions.size >= config.maxSessions) {
      sendJson(res, 503, jsonRpcError(-32000, "Too many active sessions, try again later"), { "Retry-After": "60" });
      return;
    }

    const server = createServer();
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, server, clientId: authInfo.clientId, lastSeen: Date.now() });
        auditLogger.log({
          event: "session_opened",
          session: sessionId,
          client: authInfo.clientId,
          ip: authInfo.extra?.clientIp,
        });
      },
      onsessionclosed: (sessionId) => closeSession(sessionId, "deleted by client"),
    });
    transport.onclose = () => {
      if (transport.sessionId) closeSession(transport.sessionId, "transport closed");
    };

    await server.connect(transport);
    (req as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
    await transport.handleRequest(req, res, body);

    // A rejected initialize never creates a session; release its server
    if (!transport.sessionId || !sessions.has(transport.sessionId)) {
      await server.close().catch(() => undefined);
    }
  };

  const handleMcpRequest = async (req: IncomingMessage, res: ServerResponse, clientIp: string): Promise<void> => {
    let authInfo: AuthInfo;
    try {
      authInfo = await authenticator.authenticate(req.headers.authorization);
    } catch (error: any) {
      if (!(error instanceof AuthError)) throw error;
      auditLogger.log({ event: "auth_failed", ip: clientIp, reason: error.message });
      sendJson(
        res,
        error.status,
        { error: error.oauthError, error_description: error.message },
        { "WWW-Authenticate": authenticateHeader(error) },
      );
      return;
    }
    authInfo = { ...authInfo, extra: { ...(authInfo.extra || {}), clientIp } };

    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await readJsonBody(req, config.maxBodyBytes);
      } catch (error: any) {
        const status = error instanceof RequestBodyError ? error.status : 400;
        sendJson(res, status, jsonRpcError(status === 413 ? -32000 : -32700, error.message), { Connection: "close" });
        if (status === 413) res.on("finish", () => req.destroy());
        return;
      }

      if (req.headers["mcp-session-id"]) {
        const session = findSession(req, res, authInfo);
        if (!session) return;
        (req as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
        await session.transport.handleRequest(req, res, body);
        return;
      }

      const initializing = Array.isArray(body) ? body.some(isInitializeRequest) : isInitializeRequest(body);
      if (!initializing) {
        sendJson(res, 400, jsonRpcError(-32000, "Bad Request: No valid session ID provided"));
        return;
      }
      await startSession(req, res, authInfo, body);
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      const session = findSession(req, res, authInfo);
      if (!session) return;
      (req as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
      await session.transport.handleRequest(req, res);
      return;
    }

    sendJson(res, 405, jsonRpcError(-32000, "Method not allowed"), { Allow: "GET, POST, DELETE, OPTIONS" });
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = (new URL(req.url || "/", "http://localhost").pathname.replace(/\/+$/, "") || "/");

    if (pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    // DNS-rebinding protection: reject unexpected Host and Origin headers
    if (!isHostAllowed(req.headers.host)) {
      sendJson(res, 403, jsonRpcError(-32000, "Forbidden: Host header is not allowed"));
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      if (!isOriginAllowed(origin)) {
        sendJson(res, 403, jsonRpcError(-32000, "Forbidden: Origin is not allowed"));
        return;
      }
      setCorsHeaders(res, origin);
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (config.auth === "oauth" && req.method === "GET" && metadataPaths.has(pathname)) {
      sendJson(res, 200, protectedResourceMetadata(config));
      return;
    }

    if (pathname !== config.path) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    await handleMcpRequest(req, res, clientIpOf(req));
  };

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error: any) => {
      console.error(`HTTP request failed: ${error?.message || error}`);
      sendJson(res, 500, jsonRpcError(-32603, "Internal server error"));
    });
  });

  const sweepInterval = Math.max(1000, Math.min(60 * 1000, config.sessionIdleTimeoutMs || 60 * 1000));
  const sweeper = setInterval(() => {
    if (config.sessionIdleTimeoutMs <= 0) return;
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      if (now - session.lastSeen > config.sessionIdleTimeoutMs) closeSession(sessionId, "idle timeout");
    }
  }, sweepInterval);
  sweeper.unref();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  const displayHost = config.host.includes(":") ? `[${config.host}]` : config.host;

  return {
    server,
    url: `http://${displayHost}:${port}${config.path}`,
    sessionCount: () => sessions.size,
    close: async () => {
      clearInterval(sweeper);
      for (const sessionId of [...sessions.keys()]) closeSession(sessionId, "server shutdown");
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    },
  };
};
