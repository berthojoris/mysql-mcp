import { loadRuntimeConfig } from "../config/runtimeConfig";

const TOKEN = "a".repeat(64);

describe("loadRuntimeConfig", () => {
  it("defaults to stdio with every protection off", () => {
    const config = loadRuntimeConfig({});

    expect(config.transport).toBe("stdio");
    expect(config.queryTimeoutMs).toBe(0);
    expect(config.rateLimitPerMinute).toBe(0);
    expect(config.maxResultBytes).toBe(0);
    expect(config.auditLog).toBe("off");
  });

  it("ignores HTTP settings over stdio, even invalid ones", () => {
    const config = loadRuntimeConfig({ MCP_HTTP_PORT: "not-a-port", MCP_HTTP_AUTH: "bogus" });

    expect(config.transport).toBe("stdio");
    expect(config.http.port).toBe(3000);
  });

  it("enables protections by default over HTTP", () => {
    const config = loadRuntimeConfig({ MCP_TRANSPORT: "http" });

    expect(config.http.host).toBe("127.0.0.1");
    expect(config.http.path).toBe("/mcp");
    expect(config.http.auth).toBe("none");
    expect(config.http.allowedHosts).toEqual(expect.arrayContaining(["localhost", "127.0.0.1"]));
    expect(config.queryTimeoutMs).toBe(30000);
    expect(config.rateLimitPerMinute).toBe(60);
    expect(config.maxResultBytes).toBe(512 * 1024);
    expect(config.auditLog).toBe("stderr");
  });

  it("lets explicit values override the HTTP defaults", () => {
    const config = loadRuntimeConfig({
      MCP_TRANSPORT: "HTTP",
      MCP_QUERY_TIMEOUT_MS: "0",
      MCP_RATE_LIMIT_PER_MINUTE: "5",
      MCP_AUDIT_LOG: "logs/audit.log",
      MCP_HTTP_PATH: "custom/",
    });

    expect(config.queryTimeoutMs).toBe(0);
    expect(config.rateLimitPerMinute).toBe(5);
    expect(config.auditLog).toBe("logs/audit.log");
    expect(config.http.path).toBe("/custom");
  });

  it("rejects an unknown transport", () => {
    expect(() => loadRuntimeConfig({ MCP_TRANSPORT: "sse" })).toThrow(/MCP_TRANSPORT/);
  });

  it("refuses unauthenticated HTTP on a public bind address", () => {
    expect(() => loadRuntimeConfig({ MCP_TRANSPORT: "http", MCP_HTTP_HOST: "0.0.0.0" })).toThrow(
      /MCP_HTTP_AUTH=none/,
    );
  });

  it("refuses unauthenticated HTTP when a public host is allowed (tunnels)", () => {
    expect(() =>
      loadRuntimeConfig({ MCP_TRANSPORT: "http", MCP_HTTP_PUBLIC_URL: "https://abc.ngrok.app" }),
    ).toThrow(/MCP_HTTP_AUTH=none/);
  });

  it("allows the unauthenticated override explicitly", () => {
    const config = loadRuntimeConfig({
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "0.0.0.0",
      MCP_HTTP_ALLOW_UNAUTHENTICATED: "true",
    });
    expect(config.http.auth).toBe("none");
  });

  it("requires long bearer tokens", () => {
    expect(() =>
      loadRuntimeConfig({ MCP_TRANSPORT: "http", MCP_HTTP_AUTH: "token", MCP_HTTP_AUTH_TOKENS: "short" }),
    ).toThrow(/at least 32/);

    const config = loadRuntimeConfig({
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "0.0.0.0",
      MCP_HTTP_AUTH: "token",
      MCP_HTTP_AUTH_TOKENS: `${TOKEN}, ${"b".repeat(40)}`,
    });
    expect(config.http.tokens).toEqual([TOKEN, "b".repeat(40)]);
  });

  it("requires a public URL and issuer for OAuth and derives the audience", () => {
    expect(() =>
      loadRuntimeConfig({ MCP_TRANSPORT: "http", MCP_HTTP_AUTH: "oauth", MCP_OAUTH_ISSUER: "https://id.example.com" }),
    ).toThrow(/MCP_HTTP_PUBLIC_URL/);

    const config = loadRuntimeConfig({
      MCP_TRANSPORT: "http",
      MCP_HTTP_AUTH: "oauth",
      MCP_HTTP_PUBLIC_URL: "https://mcp.example.com/ignored",
      MCP_OAUTH_ISSUER: "https://id.example.com/",
      MCP_OAUTH_REQUIRED_SCOPES: "mysql:read",
    });
    expect(config.http.resourceUrl).toBe("https://mcp.example.com/mcp");
    expect(config.http.oauth?.audience).toBe("https://mcp.example.com/mcp");
    expect(config.http.oauth?.requiredScopes).toEqual(["mysql:read"]);
    expect(config.http.allowedHosts).toContain("mcp.example.com");
  });
});
