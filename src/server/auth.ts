import crypto from "crypto";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { HttpConfig, OAuthConfig } from "../config/runtimeConfig";

/** Authentication failure mapped to an HTTP status and OAuth error code. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly oauthError: "invalid_request" | "invalid_token" | "insufficient_scope",
  ) {
    super(message);
  }
}

export interface Authenticator {
  /** Validates the Authorization header value (may be undefined). */
  authenticate(authorization: string | undefined): Promise<AuthInfo>;
}

const extractBearer = (authorization: string | undefined): string => {
  if (!authorization) {
    throw new AuthError("Missing Authorization header", 401, "invalid_request");
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  if (!match) {
    throw new AuthError("Authorization header must use the Bearer scheme", 401, "invalid_request");
  }
  return match[1];
};

const sha256 = (value: string): Buffer => crypto.createHash("sha256").update(value).digest();

export class NoAuthenticator implements Authenticator {
  async authenticate(): Promise<AuthInfo> {
    return { token: "", clientId: "anonymous", scopes: [] };
  }
}

/** Static bearer tokens, compared by SHA-256 digest in constant time. */
export class TokenAuthenticator implements Authenticator {
  private readonly digests: Buffer[];

  constructor(tokens: string[]) {
    this.digests = tokens.map(sha256);
  }

  async authenticate(authorization: string | undefined): Promise<AuthInfo> {
    const token = extractBearer(authorization);
    const digest = sha256(token);
    // Compare against every token so timing does not reveal which one matched
    let matched = false;
    for (const candidate of this.digests) {
      if (crypto.timingSafeEqual(candidate, digest)) matched = true;
    }
    if (!matched) {
      throw new AuthError("Invalid bearer token", 401, "invalid_token");
    }
    return {
      token,
      clientId: `token-${digest.toString("hex").slice(0, 12)}`,
      scopes: [],
    };
  }
}

interface Jwk extends crypto.JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

type Fetcher = (url: string) => Promise<any>;

const defaultFetcher: Fetcher = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  return response.json();
};

const ALGORITHMS: Record<string, { kty: string; hash: string | null; curve?: string; pss?: boolean; ecdsa?: boolean }> = {
  RS256: { kty: "RSA", hash: "sha256" },
  RS384: { kty: "RSA", hash: "sha384" },
  RS512: { kty: "RSA", hash: "sha512" },
  PS256: { kty: "RSA", hash: "sha256", pss: true },
  PS384: { kty: "RSA", hash: "sha384", pss: true },
  PS512: { kty: "RSA", hash: "sha512", pss: true },
  ES256: { kty: "EC", hash: "sha256", curve: "P-256", ecdsa: true },
  ES384: { kty: "EC", hash: "sha384", curve: "P-384", ecdsa: true },
  ES512: { kty: "EC", hash: "sha512", curve: "P-521", ecdsa: true },
  EdDSA: { kty: "OKP", hash: null },
};

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 30 * 1000;

const decodeSegment = (segment: string): any => {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new AuthError("Malformed access token", 401, "invalid_token");
  }
};

const normalizeIssuer = (issuer: string): string => issuer.replace(/\/+$/, "");

/**
 * OAuth 2.1 resource server: validates JWT access tokens issued by an external
 * authorization server against its JWKS. Tokens are never issued here.
 */
export class OAuthAuthenticator implements Authenticator {
  private keys: Jwk[] = [];
  private keysFetchedAt = Number.NEGATIVE_INFINITY;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  private jwksUri?: string;
  private refreshing?: Promise<void>;

  constructor(
    private readonly config: OAuthConfig,
    private readonly fetcher: Fetcher = defaultFetcher,
    private readonly now: () => number = Date.now,
  ) {
    this.jwksUri = config.jwksUri;
  }

  async authenticate(authorization: string | undefined): Promise<AuthInfo> {
    const token = extractBearer(authorization);
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthError("Access token is not a JWT", 401, "invalid_token");
    }
    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const header = decodeSegment(headerSegment);
    const payload = decodeSegment(payloadSegment);

    const algorithm = ALGORITHMS[header?.alg];
    if (!algorithm) {
      throw new AuthError(`Unsupported token algorithm: ${header?.alg}`, 401, "invalid_token");
    }

    const jwk = await this.findKey(header.kid, header.alg, algorithm.kty);
    const signature = Buffer.from(signatureSegment, "base64url");
    const signedData = Buffer.from(`${headerSegment}.${payloadSegment}`);
    if (!this.verifySignature(jwk, algorithm, signedData, signature)) {
      throw new AuthError("Invalid token signature", 401, "invalid_token");
    }

    this.validateClaims(payload);

    const scopes = this.extractScopes(payload);
    const missing = this.config.requiredScopes.filter((scope) => !scopes.includes(scope));
    if (missing.length > 0) {
      throw new AuthError(`Token is missing required scope(s): ${missing.join(", ")}`, 403, "insufficient_scope");
    }

    const clientId = String(payload.client_id || payload.azp || payload.sub || "unknown");
    return {
      token,
      clientId,
      scopes,
      expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
      extra: { subject: payload.sub },
    };
  }

  private verifySignature(
    jwk: Jwk,
    algorithm: (typeof ALGORITHMS)[string],
    data: Buffer,
    signature: Buffer,
  ): boolean {
    try {
      const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
      if (algorithm.pss) {
        return crypto.verify(
          algorithm.hash,
          data,
          { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
          signature,
        );
      }
      if (algorithm.ecdsa) {
        return crypto.verify(algorithm.hash, data, { key, dsaEncoding: "ieee-p1363" }, signature);
      }
      return crypto.verify(algorithm.hash, data, key, signature);
    } catch {
      return false;
    }
  }

  private validateClaims(payload: any): void {
    if (!payload || typeof payload !== "object") {
      throw new AuthError("Malformed token payload", 401, "invalid_token");
    }
    const nowSeconds = Math.floor(this.now() / 1000);

    if (typeof payload.iss !== "string" || normalizeIssuer(payload.iss) !== normalizeIssuer(this.config.issuer)) {
      throw new AuthError("Token issuer does not match", 401, "invalid_token");
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!this.config.audience || !audiences.includes(this.config.audience)) {
      throw new AuthError("Token audience does not match this server", 401, "invalid_token");
    }

    if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
      throw new AuthError("Token is expired", 401, "invalid_token");
    }
    if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
      throw new AuthError("Token is not valid yet", 401, "invalid_token");
    }
  }

  private extractScopes(payload: any): string[] {
    if (typeof payload.scope === "string") return payload.scope.split(" ").filter(Boolean);
    if (Array.isArray(payload.scp)) return payload.scp.map(String);
    if (typeof payload.scp === "string") return payload.scp.split(" ").filter(Boolean);
    return [];
  }

  private async findKey(kid: string | undefined, alg: string, kty: string): Promise<Jwk> {
    const canRetry = () => this.now() - this.lastAttemptAt > JWKS_MIN_REFRESH_MS;
    if (this.now() - this.keysFetchedAt > JWKS_TTL_MS && canRetry()) {
      await this.refreshKeys();
    }

    let key = this.selectKey(kid, alg, kty);
    // Unknown kid usually means the authorization server rotated its keys
    if (!key && canRetry()) {
      await this.refreshKeys();
      key = this.selectKey(kid, alg, kty);
    }
    if (!key) {
      throw new AuthError("No matching signing key for token", 401, "invalid_token");
    }
    return key;
  }

  private selectKey(kid: string | undefined, alg: string, kty: string): Jwk | undefined {
    const candidates = this.keys.filter(
      (key) =>
        key.kty === kty &&
        (!key.use || key.use === "sig") &&
        (!key.alg || key.alg === alg) &&
        (!ALGORITHMS[alg].curve || key.crv === ALGORITHMS[alg].curve),
    );
    if (kid) return candidates.find((key) => key.kid === kid);
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  private refreshKeys(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        this.lastAttemptAt = this.now();
        try {
          const uri = await this.resolveJwksUri();
          const jwks = await this.fetcher(uri);
          if (!jwks || !Array.isArray(jwks.keys)) {
            throw new Error(`JWKS at ${uri} has no "keys" array`);
          }
          this.keys = jwks.keys;
          this.keysFetchedAt = this.now();
        } catch (error: any) {
          // Keep any previously fetched keys; lastAttemptAt throttles the next retry
          console.error(`OAuth: failed to load signing keys: ${error.message}`);
        } finally {
          this.refreshing = undefined;
        }
      })();
    }
    return this.refreshing;
  }

  private async resolveJwksUri(): Promise<string> {
    if (this.jwksUri) return this.jwksUri;
    const issuer = normalizeIssuer(this.config.issuer);
    const issuerUrl = new URL(issuer);
    // OpenID Connect discovery, then RFC 8414 (path inserted after the well-known prefix)
    const candidates = [
      `${issuer}/.well-known/openid-configuration`,
      `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname === "/" ? "" : issuerUrl.pathname}`,
    ];
    for (const url of candidates) {
      try {
        const metadata = await this.fetcher(url);
        if (metadata && typeof metadata.jwks_uri === "string") {
          this.jwksUri = metadata.jwks_uri;
          return metadata.jwks_uri;
        }
      } catch {
        // try the next discovery document
      }
    }
    throw new Error(`Could not discover jwks_uri for issuer ${this.config.issuer}; set MCP_OAUTH_JWKS_URI`);
  }
}

export const createAuthenticator = (http: HttpConfig): Authenticator => {
  if (http.auth === "token") return new TokenAuthenticator(http.tokens);
  if (http.auth === "oauth" && http.oauth) return new OAuthAuthenticator(http.oauth);
  return new NoAuthenticator();
};

/** RFC 9728 Protected Resource Metadata for this server. */
export const protectedResourceMetadata = (http: HttpConfig) => ({
  resource: http.resourceUrl,
  authorization_servers: http.oauth ? [http.oauth.issuer] : [],
  bearer_methods_supported: ["header"],
  ...(http.oauth && http.oauth.requiredScopes.length > 0 ? { scopes_supported: http.oauth.requiredScopes } : {}),
  resource_name: "MySQL MCP Server",
});

export const protectedResourceMetadataUrl = (http: HttpConfig): string | undefined =>
  http.publicUrl ? `${http.publicUrl}/.well-known/oauth-protected-resource${http.path}` : undefined;
