import { randomBytes } from "node:crypto";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { getRedisClient, registerUser } from "../core/redisStore.js";

/**
 * Docket's own login for multi-tenant hosted mode (docs/ARCHITECTURE.md
 * §14) — entirely separate from, and unrelated to, BYU/LearningSuite auth.
 * Nothing here ever sees a BYU NetID or password; it only establishes who
 * you are *to Docket*, so your data can be kept apart from every other
 * student's on the same shared deployment. Hand-rolled against Google's
 * plain REST/JWT endpoints rather than an auth SDK — this project's
 * existing "one documented dependency exception (`@upstash/redis`), hand
 * -roll everything else with a small surface area" philosophy (see
 * `icsParser.ts`'s comment on the same tradeoff), and Node ≥20's built-in
 * `crypto.createPublicKey({format:"jwk"})` support means real RS256 ID
 * -token verification needs zero new dependencies.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_COOKIE_NAME = "docket_session";

export function buildGoogleAuthUrl(origin: string, state: string): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Always show the account chooser — avoids silently reusing whichever
    // Google account happened to be last signed in on a shared computer.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** Exchanges an OAuth `code` for a verified Google identity — the only two network calls in the whole login flow. */
export async function completeGoogleLogin(code: string, origin: string, fetchJwks: JwksFetcher = defaultFetchJwks): Promise<GoogleIdentity> {
  const idToken = await exchangeCodeForIdToken(code, origin);
  return verifyGoogleIdToken(idToken, fetchJwks);
}

async function exchangeCodeForIdToken(code: string, origin: string): Promise<string> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google token response had no id_token");
  return body.id_token;
}

interface Jwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
}
type JwksFetcher = () => Promise<{ keys: Jwk[] }>;

async function defaultFetchJwks(): Promise<{ keys: Jwk[] }> {
  const res = await fetch(GOOGLE_JWKS_ENDPOINT);
  if (!res.ok) throw new Error(`Failed to fetch Google's JWKS: HTTP ${res.status}`);
  return (await res.json()) as { keys: Jwk[] };
}

/**
 * Verifies a Google-issued ID token's RS256 signature and standard claims
 * from first principles — decode the JWT, fetch Google's current signing
 * keys, import the one matching `kid` as a public key
 * (`crypto.createPublicKey({format:"jwk"})`, a real Node ≥20 capability),
 * and verify with `crypto.verify`. `fetchJwks` is injectable (same
 * dependency-injection pattern as `IcsConnector`'s `fetchIcs` parameter in
 * `src/connectors/icsConnector.ts`) so tests supply a fixture keypair
 * instead of ever hitting Google.
 */
export async function verifyGoogleIdToken(idToken: string, fetchJwks: JwksFetcher = defaultFetchJwks): Promise<GoogleIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8")) as { kid?: string; alg?: string };
  if (header.alg !== "RS256") throw new Error(`Unexpected ID token algorithm: ${header.alg}`);
  if (!header.kid) throw new Error("ID token header has no kid");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    aud?: string;
    iss?: string;
    exp?: number;
  };

  const { keys } = await fetchJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("No matching signing key found for this ID token's kid");

  const publicKey = createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: "jwk" });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, "utf-8");
  const signature = Buffer.from(sigB64, "base64url");
  if (!cryptoVerify("RSA-SHA256", signingInput, publicKey, signature)) {
    throw new Error("ID token signature verification failed");
  }

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  if (payload.aud !== clientId) throw new Error("ID token audience does not match this app's client id");
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) throw new Error(`Unexpected ID token issuer: ${payload.iss}`);
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("ID token has expired");
  if (!payload.sub || !payload.email) throw new Error("ID token is missing sub/email");

  return { sub: payload.sub, email: payload.email, emailVerified: !!payload.email_verified, name: payload.name };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — is multi-tenant mode fully configured?`);
  return value;
}

// --- Sessions -------------------------------------------------------------
//
// A session id is a high-entropy random opaque string, never a signed
// token/JWT — it's just a Redis lookup key, so there's nothing to sign or
// verify beyond "does this key exist," which sidesteps an entire class of
// token-signing bugs for no security cost (it's already unguessable and
// instantly server-revocable by deleting the Redis key).

interface SessionRecord {
  userId: string;
  createdAt: string;
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("base64url");
  await getRedisClient().set(`docket:session:${sessionId}`, { userId, createdAt: new Date().toISOString() } satisfies SessionRecord, {
    ex: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getRedisClient().del(`docket:session:${sessionId}`);
}

/** Exported for the one other place that needs to read a non-session cookie (the OAuth `state` anti-CSRF cookie, in `src/server/handler.ts`'s `/auth/callback`). */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** Resolves the logged-in userId from a request's `Cookie` header, or `undefined` if not logged in / session expired. */
export async function resolveUserId(cookieHeader: string | undefined): Promise<string | undefined> {
  const sessionId = parseCookies(cookieHeader)[SESSION_COOKIE_NAME];
  if (!sessionId) return undefined;
  const record = await getRedisClient().get<SessionRecord>(`docket:session:${sessionId}`);
  return record?.userId;
}

export function sessionCookieHeader(sessionId: string, origin: string): string {
  const secure = origin.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearSessionCookieHeader(origin: string): string {
  const secure = origin.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function sessionIdFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[SESSION_COOKIE_NAME];
}

// --- User profiles + bookmarklet identity ---------------------------------
//
// The bookmarklet/Shortcut POST comes from the LearningSuite tab's own
// origin — it can never carry Docket's session cookie cross-site. Instead,
// each user's personalized script (generated only once they're logged in,
// on /connect) embeds a separate long-lived opaque token, which the import
// routes resolve back to a userId — see src/connectors/bookmarklet.ts and
// the /connect/learningsuite/import* routes in src/server/handler.ts.

export interface UserProfile {
  sub: string;
  email: string;
  name?: string;
  bookmarkletToken: string;
  createdAt: string;
}

/** Looks up or creates the Docket account for a verified Google identity — called once per login, from `GET /auth/callback`. */
export async function upsertUser(identity: GoogleIdentity): Promise<UserProfile> {
  const redis = getRedisClient();
  const key = `docket:user:${identity.sub}`;
  const existing = await redis.get<UserProfile>(key);
  if (existing) return existing;

  const profile: UserProfile = {
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    bookmarkletToken: randomBytes(24).toString("base64url"),
    createdAt: new Date().toISOString(),
  };
  await redis.set(key, profile);
  await redis.set(`docket:bmtoken:${profile.bookmarkletToken}`, identity.sub);
  await registerUser(identity.sub);
  return profile;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  return getRedisClient().get<UserProfile>(`docket:user:${userId}`);
}

/** Issues a new bookmarklet token and invalidates the old one — for a "Regenerate token" control on /account, so a leaked/old copy of the script stops working. */
export async function regenerateBookmarkletToken(userId: string): Promise<string> {
  const redis = getRedisClient();
  const profile = await redis.get<UserProfile>(`docket:user:${userId}`);
  if (!profile) throw new Error("No such user");
  await redis.del(`docket:bmtoken:${profile.bookmarkletToken}`);
  const newToken = randomBytes(24).toString("base64url");
  await redis.set(`docket:user:${userId}`, { ...profile, bookmarkletToken: newToken } satisfies UserProfile);
  await redis.set(`docket:bmtoken:${newToken}`, userId);
  return newToken;
}

/** Resolves a bookmarklet-embedded token (submitted by the connector script, not a cookie) back to the userId it belongs to. */
export async function resolveUserIdFromBookmarkletToken(token: string): Promise<string | undefined> {
  const userId = await getRedisClient().get<string>(`docket:bmtoken:${token}`);
  return userId ?? undefined;
}

/** Deletes everything belonging to one user's Docket account — for `POST /account/delete`. Never touches other users' data (each key is userId-scoped). */
export async function deleteAccount(userId: string): Promise<void> {
  const redis = getRedisClient();
  const profile = await redis.get<UserProfile>(`docket:user:${userId}`);
  await Promise.all([
    redis.del(`docket:snapshot:${userId}`),
    redis.del(`docket:courses:${userId}`),
    redis.del(`docket:user:${userId}`),
    redis.srem("docket:users", userId),
    profile ? redis.del(`docket:bmtoken:${profile.bookmarkletToken}`) : Promise.resolve(),
  ]);
}
