import dotenv from "dotenv";

dotenv.config();

/**
 * Transport and protection settings. Everything here is opt-in: with no
 * variables set the server runs over stdio with all protections disabled,
 * exactly as before the HTTP transport existed.
 */
export type TransportMode = "stdio" | "http";
export type HttpAuthMode = "none" | "token" | "oauth";

export interface OAuthConfig {
  issuer: string;
  audience: string;
  jwksUri?: string;
  requiredScopes: string[];
}

export interface HttpConfig {
  host: string;
  port: number;
  path: string;
  publicUrl?: string;
  /** Public URL of the MCP endpoint (publicUrl + path), used as the OAuth resource id */
  resourceUrl?: string;
  auth: HttpAuthMode;
  tokens: string[];
  oauth?: OAuthConfig;
  allowedHosts: string[];
  allowedOrigins: string[];
  trustProxy: boolean;
  allowUnauthenticated: boolean;
  maxSessions: number;
  sessionIdleTimeoutMs: number;
  maxBodyBytes: number;
}

export interface RuntimeConfig {
  transport: TransportMode;
  http: HttpConfig;
  queryTimeoutMs: number;
  rateLimitPerMinute: number;
  maxResultBytes: number;
  /** "off", "stderr", or a file path */
  auditLog: string;
  requireReadOnlyDbUser: boolean;
}

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];
const MIN_TOKEN_LENGTH = 32;

export const isLoopbackHost = (host: string): boolean =>
  LOOPBACK_HOSTS.includes(host.trim().toLowerCase());

const list = (value?: string): string[] =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseBoolean = (name: string, value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new Error(`${name} must be true or false, got "${value}"`);
};

const parseNonNegativeInt = (name: string, value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${value}"`);
  }
  return parsed;
};

const normalizePath = (value: string): string => {
  const trimmed = value.trim() || "/mcp";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
};

/**
 * Parse settings from the environment. Throws with a readable message on
 * invalid or unsafe combinations so the server refuses to start instead of
 * running with a half-applied configuration.
 */
export const loadRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const transportValue = (env.MCP_TRANSPORT || "stdio").trim().toLowerCase();
  if (transportValue !== "stdio" && transportValue !== "http") {
    throw new Error(`MCP_TRANSPORT must be "stdio" or "http", got "${env.MCP_TRANSPORT}"`);
  }
  const transport = transportValue as TransportMode;
  const isHttp = transport === "http";

  // HTTP variables are ignored over stdio so they can never break a stdio setup
  const http = parseHttpConfig(isHttp ? env : {});
  if (isHttp) validateHttpConfig(http);

  const auditLog = (env.MCP_AUDIT_LOG || (isHttp ? "stderr" : "off")).trim();
  const auditLogKeyword = auditLog.toLowerCase();

  return {
    transport,
    http,
    queryTimeoutMs: parseNonNegativeInt("MCP_QUERY_TIMEOUT_MS", env.MCP_QUERY_TIMEOUT_MS, isHttp ? 30000 : 0),
    rateLimitPerMinute: parseNonNegativeInt(
      "MCP_RATE_LIMIT_PER_MINUTE",
      env.MCP_RATE_LIMIT_PER_MINUTE,
      isHttp ? 60 : 0,
    ),
    maxResultBytes: parseNonNegativeInt("MCP_MAX_RESULT_BYTES", env.MCP_MAX_RESULT_BYTES, isHttp ? 512 * 1024 : 0),
    auditLog: auditLogKeyword === "off" || auditLogKeyword === "stderr" ? auditLogKeyword : auditLog,
    requireReadOnlyDbUser: parseBoolean(
      "MCP_REQUIRE_READONLY_DB_USER",
      env.MCP_REQUIRE_READONLY_DB_USER,
      false,
    ),
  };
};

const parseHttpConfig = (env: NodeJS.ProcessEnv): HttpConfig => {
  const authValue = (env.MCP_HTTP_AUTH || "none").trim().toLowerCase();
  if (!["none", "token", "oauth"].includes(authValue)) {
    throw new Error(`MCP_HTTP_AUTH must be "none", "token", or "oauth", got "${env.MCP_HTTP_AUTH}"`);
  }

  const host = (env.MCP_HTTP_HOST || "127.0.0.1").trim();
  const port = parseNonNegativeInt("MCP_HTTP_PORT", env.MCP_HTTP_PORT, 3000);
  if (port < 1 || port > 65535) {
    throw new Error(`MCP_HTTP_PORT must be between 1 and 65535, got "${env.MCP_HTTP_PORT}"`);
  }
  const path = normalizePath(env.MCP_HTTP_PATH || "/mcp");

  let publicUrl: string | undefined;
  if (env.MCP_HTTP_PUBLIC_URL && env.MCP_HTTP_PUBLIC_URL.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(env.MCP_HTTP_PUBLIC_URL.trim());
    } catch {
      throw new Error(`MCP_HTTP_PUBLIC_URL is not a valid URL: "${env.MCP_HTTP_PUBLIC_URL}"`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("MCP_HTTP_PUBLIC_URL must use http or https");
    }
    publicUrl = parsed.origin;
  }
  const resourceUrl = publicUrl ? `${publicUrl}${path}` : undefined;

  const allowedHosts = list(env.MCP_HTTP_ALLOWED_HOSTS).map((h) => h.toLowerCase());
  if (allowedHosts.length === 0 && isLoopbackHost(host)) {
    allowedHosts.push(...LOOPBACK_HOSTS);
  }
  if (publicUrl) {
    const publicHost = new URL(publicUrl).hostname.toLowerCase();
    if (!allowedHosts.includes(publicHost)) allowedHosts.push(publicHost);
  }

  const http: HttpConfig = {
    host,
    port,
    path,
    publicUrl,
    resourceUrl,
    auth: authValue as HttpAuthMode,
    tokens: list(env.MCP_HTTP_AUTH_TOKENS),
    allowedHosts,
    allowedOrigins: list(env.MCP_HTTP_ALLOWED_ORIGINS),
    trustProxy: parseBoolean("MCP_HTTP_TRUST_PROXY", env.MCP_HTTP_TRUST_PROXY, false),
    allowUnauthenticated: parseBoolean(
      "MCP_HTTP_ALLOW_UNAUTHENTICATED",
      env.MCP_HTTP_ALLOW_UNAUTHENTICATED,
      false,
    ),
    maxSessions: parseNonNegativeInt("MCP_HTTP_MAX_SESSIONS", env.MCP_HTTP_MAX_SESSIONS, 100),
    sessionIdleTimeoutMs: parseNonNegativeInt(
      "MCP_HTTP_SESSION_IDLE_TIMEOUT_MS",
      env.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS,
      30 * 60 * 1000,
    ),
    maxBodyBytes: parseNonNegativeInt("MCP_HTTP_MAX_BODY_BYTES", env.MCP_HTTP_MAX_BODY_BYTES, 1024 * 1024),
  };

  if (http.auth === "oauth") {
    const issuer = (env.MCP_OAUTH_ISSUER || "").trim();
    const audience = (env.MCP_OAUTH_AUDIENCE || "").trim() || resourceUrl || "";
    http.oauth = {
      issuer,
      audience,
      jwksUri: (env.MCP_OAUTH_JWKS_URI || "").trim() || undefined,
      requiredScopes: list(env.MCP_OAUTH_REQUIRED_SCOPES),
    };
  }

  return http;
};

const validateHttpConfig = (http: HttpConfig): void => {
  if (http.auth === "token") {
    if (http.tokens.length === 0) {
      throw new Error("MCP_HTTP_AUTH=token requires MCP_HTTP_AUTH_TOKENS");
    }
    if (http.tokens.some((token) => token.length < MIN_TOKEN_LENGTH)) {
      throw new Error(
        `Every MCP_HTTP_AUTH_TOKENS entry must be at least ${MIN_TOKEN_LENGTH} characters (e.g. openssl rand -hex 32)`,
      );
    }
  }

  if (http.auth === "oauth") {
    if (!http.publicUrl) {
      throw new Error("MCP_HTTP_AUTH=oauth requires MCP_HTTP_PUBLIC_URL (the HTTPS URL clients connect to)");
    }
    if (!http.oauth?.issuer) {
      throw new Error("MCP_HTTP_AUTH=oauth requires MCP_OAUTH_ISSUER");
    }
    try {
      new URL(http.oauth.issuer);
      if (http.oauth.jwksUri) new URL(http.oauth.jwksUri);
    } catch {
      throw new Error("MCP_OAUTH_ISSUER and MCP_OAUTH_JWKS_URI must be valid URLs");
    }
  }

  if (http.auth === "none" && !http.allowUnauthenticated) {
    const exposedHosts = http.allowedHosts.filter((h) => !isLoopbackHost(h));
    if (!isLoopbackHost(http.host) || exposedHosts.length > 0) {
      throw new Error(
        "MCP_HTTP_AUTH=none is only allowed on a loopback address with loopback-only allowed hosts. " +
          "Set MCP_HTTP_AUTH=token or oauth, or MCP_HTTP_ALLOW_UNAUTHENTICATED=true to override.",
      );
    }
  }
};

let cachedConfig: RuntimeConfig | undefined;

/** Lazily loaded process-wide configuration. */
export const getRuntimeConfig = (): RuntimeConfig => {
  if (!cachedConfig) cachedConfig = loadRuntimeConfig();
  return cachedConfig;
};
