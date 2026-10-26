import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { HttpConfig } from "../config/runtimeConfig";
import { AuditLogger } from "../server/auditLogger";
import { AuthError } from "../server/auth";
import { RunningHttpServer, startHttpServer } from "../server/httpServer";

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

const baseConfig = (overrides: Partial<HttpConfig> = {}): HttpConfig => ({
  host: "127.0.0.1",
  port: 0,
  path: "/mcp",
  auth: "token",
  tokens: [TOKEN_A, TOKEN_B],
  allowedHosts: ["localhost", "127.0.0.1"],
  allowedOrigins: [],
  trustProxy: false,
  allowUnauthenticated: false,
  maxSessions: 2,
  sessionIdleTimeoutMs: 60_000,
  maxBodyBytes: 4096,
  ...overrides,
});

// Minimal MCP server whose tool echoes the caller identity it was given
const createTestServer = () => {
  const server = new Server({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{ name: "whoami", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (_request, extra) => ({
    content: [{ type: "text", text: JSON.stringify({ session: extra.sessionId, client: extra.authInfo?.clientId }) }],
  }));
  return server;
};

const connectClient = async (url: string, token: string) => {
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return { client, transport };
};

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "1" } },
};

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("Streamable HTTP server", () => {
  let running: RunningHttpServer;
  const closedSessions: string[] = [];

  beforeEach(async () => {
    closedSessions.length = 0;
    running = await startHttpServer({
      config: baseConfig(),
      createServer: createTestServer,
      auditLogger: new AuditLogger("off"),
      onSessionClosed: (id) => closedSessions.push(id),
    });
  });

  afterEach(async () => {
    await running.close();
  });

  it("serves health without authentication", async () => {
    const response = await fetch(running.url.replace("/mcp", "/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("rejects requests without a valid bearer token", async () => {
    const missing = await post(running.url, initializeBody);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toMatch(/^Bearer realm="mysql-mcp"$/);

    const wrong = await post(running.url, initializeBody, { Authorization: `Bearer ${"z".repeat(64)}` });
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("runs a full MCP session with the SDK client and passes identity to handlers", async () => {
    const { client, transport } = await connectClient(running.url, TOKEN_A);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(["whoami"]);
    expect(tools.tools[0].annotations).toEqual({ readOnlyHint: true });

    const result: any = await client.callTool({ name: "whoami", arguments: {} });
    const identity = JSON.parse(result.content[0].text);
    expect(identity.session).toBe(transport.sessionId);
    expect(identity.client).toMatch(/^token-/);
    expect(running.sessionCount()).toBe(1);

    await transport.terminateSession();
    expect(closedSessions).toEqual([identity.session]);
    expect(running.sessionCount()).toBe(0);
    await client.close();
  });

  it("does not let another identity use a session", async () => {
    const { client, transport } = await connectClient(running.url, TOKEN_A);

    const hijack = await post(
      running.url,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { Authorization: `Bearer ${TOKEN_B}`, "Mcp-Session-Id": transport.sessionId!, "Mcp-Protocol-Version": "2025-06-18" },
    );
    expect(hijack.status).toBe(403);
    await client.close();
  });

  it("requires a session for non-initialize requests and rejects unknown sessions", async () => {
    const auth = { Authorization: `Bearer ${TOKEN_A}` };
    const noSession = await post(running.url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, auth);
    expect(noSession.status).toBe(400);

    const unknown = await post(running.url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, {
      ...auth,
      "Mcp-Session-Id": "00000000-0000-0000-0000-000000000000",
    });
    expect(unknown.status).toBe(404);
  });

  it("rejects disallowed Origin and Host headers (DNS rebinding)", async () => {
    const badOrigin = await post(running.url, initializeBody, {
      Authorization: `Bearer ${TOKEN_A}`,
      Origin: "https://evil.example.com",
    });
    expect(badOrigin.status).toBe(403);

    const localOrigin = await fetch(running.url, { method: "OPTIONS", headers: { Origin: "http://localhost:6274" } });
    expect(localOrigin.status).toBe(204);
    expect(localOrigin.headers.get("access-control-allow-origin")).toBe("http://localhost:6274");

    const { port } = new URL(running.url);
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { Host: "evil.example.com" } },
        (res) => {
          res.resume();
          resolve(res.statusCode || 0);
        },
      );
      req.on("error", reject);
      req.end("{}");
    });
    expect(status).toBe(403);
  });

  it("rejects oversized and malformed bodies", async () => {
    const auth = { Authorization: `Bearer ${TOKEN_A}` };
    const tooLarge = await post(running.url, JSON.stringify({ pad: "x".repeat(10_000) }), auth);
    expect(tooLarge.status).toBe(413);

    const malformed = await post(running.url, "{not json", auth);
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe(-32700);
  });

  it("caps the number of sessions", async () => {
    const first = await connectClient(running.url, TOKEN_A);
    const second = await connectClient(running.url, TOKEN_A);

    const third = await post(running.url, initializeBody, { Authorization: `Bearer ${TOKEN_A}` });
    expect(third.status).toBe(503);

    await first.client.close();
    await second.client.close();
  });

  it("closes all sessions on shutdown", async () => {
    const { client, transport } = await connectClient(running.url, TOKEN_A);
    const sessionId = transport.sessionId;
    await running.close();
    expect(closedSessions).toEqual([sessionId]);
    await client.close();
    // afterEach closes again; make that a no-op
    running = { ...running, close: async () => undefined };
  });
});

describe("Streamable HTTP server with OAuth", () => {
  it("publishes protected resource metadata and points 401s at it", async () => {
    const running = await startHttpServer({
      config: baseConfig({
        auth: "oauth",
        tokens: [],
        publicUrl: "https://mcp.example.com",
        resourceUrl: "https://mcp.example.com/mcp",
        allowedHosts: [],
        oauth: { issuer: "https://id.example.com/", audience: "https://mcp.example.com/mcp", requiredScopes: ["mysql:read"] },
      }),
      createServer: createTestServer,
      auditLogger: new AuditLogger("off"),
      authenticator: {
        authenticate: async () => {
          throw new AuthError("Missing Authorization header", 401, "invalid_request");
        },
      },
    });

    try {
      const metadata = await fetch(running.url.replace("/mcp", "/.well-known/oauth-protected-resource/mcp"));
      expect(await metadata.json()).toEqual({
        resource: "https://mcp.example.com/mcp",
        authorization_servers: ["https://id.example.com/"],
        bearer_methods_supported: ["header"],
        scopes_supported: ["mysql:read"],
        resource_name: "MySQL MCP Server",
      });

      const unauthorized = await post(running.url, initializeBody);
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("www-authenticate")).toBe(
        'Bearer realm="mysql-mcp", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
      );
    } finally {
      await running.close();
    }
  });
});
