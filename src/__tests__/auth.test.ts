import crypto from "crypto";
import { AuthError, OAuthAuthenticator, TokenAuthenticator } from "../server/auth";

const ISSUER = "https://id.example.com/";
const AUDIENCE = "https://mcp.example.com/mcp";

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

const sign = (
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: crypto.KeyObject,
  options: { hash?: string | null; dsaEncoding?: "ieee-p1363" } = {},
) => {
  const data = `${b64(header)}.${b64(payload)}`;
  const hash = options.hash === undefined ? "sha256" : options.hash;
  const key = options.dsaEncoding ? { key: privateKey, dsaEncoding: options.dsaEncoding } : privateKey;
  const signature = crypto.sign(hash, Buffer.from(data), key);
  return `${data}.${signature.toString("base64url")}`;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  iss: ISSUER,
  aud: AUDIENCE,
  sub: "user-1",
  client_id: "chatgpt",
  scope: "mysql:read profile",
  exp: nowSeconds() + 300,
  ...overrides,
});

describe("TokenAuthenticator", () => {
  const token = "t".repeat(64);
  const auth = new TokenAuthenticator([token, "u".repeat(64)]);

  it("accepts a configured token with a stable client id", async () => {
    const first = await auth.authenticate(`Bearer ${token}`);
    const second = await auth.authenticate(`bearer ${token}`);

    expect(first.clientId).toMatch(/^token-[0-9a-f]{12}$/);
    expect(second.clientId).toBe(first.clientId);
  });

  it("rejects missing, malformed, and unknown tokens", async () => {
    await expect(auth.authenticate(undefined)).rejects.toMatchObject({ status: 401, oauthError: "invalid_request" });
    await expect(auth.authenticate(`Basic ${token}`)).rejects.toMatchObject({ oauthError: "invalid_request" });
    await expect(auth.authenticate(`Bearer ${"x".repeat(64)}`)).rejects.toMatchObject({
      status: 401,
      oauthError: "invalid_token",
    });
  });
});

describe("OAuthAuthenticator", () => {
  const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const ec = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const rsaJwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "rsa-1", use: "sig" };
  const ecJwk = { ...ec.publicKey.export({ format: "jwk" }), kid: "ec-1" };

  const makeAuth = (keys: unknown[] = [rsaJwk, ecJwk], requiredScopes: string[] = []) => {
    const fetcher = jest.fn(async (url: string) => {
      if (url.endsWith("/.well-known/openid-configuration")) {
        return { jwks_uri: "https://id.example.com/jwks" };
      }
      if (url === "https://id.example.com/jwks") return { keys };
      throw new Error(`unexpected ${url}`);
    });
    return {
      fetcher,
      auth: new OAuthAuthenticator({ issuer: ISSUER, audience: AUDIENCE, requiredScopes }, fetcher),
    };
  };

  it("accepts a valid RS256 token and discovers the JWKS", async () => {
    const { auth, fetcher } = makeAuth();
    const token = sign({ alg: "RS256", kid: "rsa-1" }, validPayload(), rsa.privateKey);

    const info = await auth.authenticate(`Bearer ${token}`);

    expect(info.clientId).toBe("chatgpt");
    expect(info.scopes).toEqual(["mysql:read", "profile"]);
    expect(fetcher).toHaveBeenCalledWith("https://id.example.com/.well-known/openid-configuration");
  });

  it("accepts a valid ES256 token with an audience array", async () => {
    const { auth } = makeAuth();
    const token = sign(
      { alg: "ES256", kid: "ec-1" },
      validPayload({ aud: ["other", AUDIENCE] }),
      ec.privateKey,
      { dsaEncoding: "ieee-p1363" },
    );

    await expect(auth.authenticate(`Bearer ${token}`)).resolves.toMatchObject({ clientId: "chatgpt" });
  });

  it.each([
    ["wrong audience", { aud: "https://other.example.com/mcp" }],
    ["wrong issuer", { iss: "https://evil.example.com/" }],
    ["expired", { exp: nowSeconds() - 3600 }],
    ["not yet valid", { nbf: nowSeconds() + 3600 }],
    ["missing exp", { exp: undefined }],
  ])("rejects a token with %s", async (_label, overrides) => {
    const { auth } = makeAuth();
    const token = sign({ alg: "RS256", kid: "rsa-1" }, validPayload(overrides), rsa.privateKey);

    await expect(auth.authenticate(`Bearer ${token}`)).rejects.toMatchObject({ status: 401, oauthError: "invalid_token" });
  });

  it("rejects a forged signature", async () => {
    const { auth } = makeAuth();
    const attacker = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = sign({ alg: "RS256", kid: "rsa-1" }, validPayload(), attacker.privateKey);

    await expect(auth.authenticate(`Bearer ${token}`)).rejects.toThrow(/signature/);
  });

  it("rejects alg none and HMAC tokens", async () => {
    const { auth } = makeAuth();
    const unsigned = `${b64({ alg: "none" })}.${b64(validPayload())}.`;
    const hmacData = `${b64({ alg: "HS256", kid: "rsa-1" })}.${b64(validPayload())}`;
    const hmac = `${hmacData}.${crypto.createHmac("sha256", "secret").update(hmacData).digest("base64url")}`;

    await expect(auth.authenticate(`Bearer ${unsigned}`)).rejects.toThrow(/Unsupported token algorithm/);
    await expect(auth.authenticate(`Bearer ${hmac}`)).rejects.toThrow(/Unsupported token algorithm/);
  });

  it("does not use an RSA key for an EC algorithm", async () => {
    const { auth } = makeAuth([rsaJwk]);
    const token = sign({ alg: "ES256", kid: "rsa-1" }, validPayload(), ec.privateKey, { dsaEncoding: "ieee-p1363" });

    await expect(auth.authenticate(`Bearer ${token}`)).rejects.toThrow(/No matching signing key/);
  });

  it("returns 403 insufficient_scope when a required scope is missing", async () => {
    const { auth } = makeAuth(undefined, ["mysql:write"]);
    const token = sign({ alg: "RS256", kid: "rsa-1" }, validPayload(), rsa.privateKey);

    const error = await auth.authenticate(`Bearer ${token}`).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ status: 403, oauthError: "insufficient_scope" });
  });

  it("refetches the JWKS once when it sees an unknown kid (key rotation)", async () => {
    const rotated = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rotatedJwk = { ...rotated.publicKey.export({ format: "jwk" }), kid: "rsa-2" };
    let keys: unknown[] = [rsaJwk];
    const fetcher = jest.fn(async (url: string) =>
      url.endsWith("openid-configuration") ? { jwks_uri: "https://id.example.com/jwks" } : { keys },
    );
    let now = Date.now();
    const auth = new OAuthAuthenticator({ issuer: ISSUER, audience: AUDIENCE, requiredScopes: [] }, fetcher, () => now);

    await auth.authenticate(`Bearer ${sign({ alg: "RS256", kid: "rsa-1" }, validPayload(), rsa.privateKey)}`);
    keys = [rsaJwk, rotatedJwk];
    now += 60 * 1000;
    const info = await auth.authenticate(
      `Bearer ${sign({ alg: "RS256", kid: "rsa-2" }, validPayload(), rotated.privateKey)}`,
    );

    expect(info.clientId).toBe("chatgpt");
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/jwks"))).toHaveLength(2);
  });
});
