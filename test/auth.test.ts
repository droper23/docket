import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { buildGoogleAuthUrl, clearSessionCookieHeader, parseCookies, sessionCookieHeader, verifyGoogleIdToken } from "../src/server/auth.js";

process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { kty: string; n: string; e: string };
const KID = "test-key-1";

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function makeIdToken(payloadOverrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}): string {
  const header = { alg: "RS256", kid: KID, ...headerOverrides };
  const payload = {
    sub: "google-user-123",
    email: "student@example.test",
    email_verified: true,
    name: "Test Student",
    aud: "test-client-id.apps.googleusercontent.com",
    iss: "https://accounts.google.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadOverrides,
  };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function fakeJwks() {
  return { keys: [{ kty: jwk.kty, kid: KID, n: jwk.n, e: jwk.e }] };
}

test("verifyGoogleIdToken: a validly signed token with correct claims is accepted", async () => {
  const identity = await verifyGoogleIdToken(makeIdToken(), fakeJwks);
  assert.equal(identity.sub, "google-user-123");
  assert.equal(identity.email, "student@example.test");
  assert.equal(identity.emailVerified, true);
  assert.equal(identity.name, "Test Student");
});

test("verifyGoogleIdToken: rejects a token whose signature doesn't match (tampered payload)", async () => {
  const valid = makeIdToken();
  const [header, payload, sig] = valid.split(".");
  const tamperedPayload = b64url({ sub: "attacker", email: "attacker@evil.test", aud: "test-client-id.apps.googleusercontent.com", iss: "https://accounts.google.com", exp: Math.floor(Date.now() / 1000) + 3600 });
  const tampered = `${header}.${tamperedPayload}.${sig}`;
  await assert.rejects(() => verifyGoogleIdToken(tampered, fakeJwks), /signature verification failed/);
});

test("verifyGoogleIdToken: rejects an expired token", async () => {
  const expired = makeIdToken({ exp: Math.floor(Date.now() / 1000) - 60 });
  await assert.rejects(() => verifyGoogleIdToken(expired, fakeJwks), /expired/);
});

test("verifyGoogleIdToken: rejects a token issued for a different client (wrong audience)", async () => {
  const wrongAud = makeIdToken({ aud: "someone-elses-client-id.apps.googleusercontent.com" });
  await assert.rejects(() => verifyGoogleIdToken(wrongAud, fakeJwks), /audience/);
});

test("verifyGoogleIdToken: rejects a token from an unexpected issuer", async () => {
  const wrongIss = makeIdToken({ iss: "https://not-google.evil.test" });
  await assert.rejects(() => verifyGoogleIdToken(wrongIss, fakeJwks), /issuer/);
});

test("verifyGoogleIdToken: rejects a non-RS256 token outright, never attempts verification with the wrong algorithm", async () => {
  const wrongAlg = makeIdToken({}, { alg: "none" });
  await assert.rejects(() => verifyGoogleIdToken(wrongAlg, fakeJwks), /algorithm/);
});

test("verifyGoogleIdToken: rejects a kid with no matching key in the fetched JWKS", async () => {
  const unknownKid = makeIdToken({}, { kid: "some-other-key-id" });
  await assert.rejects(() => verifyGoogleIdToken(unknownKid, fakeJwks), /No matching signing key/);
});

test("buildGoogleAuthUrl: embeds client id, callback redirect, and state", () => {
  const url = new URL(buildGoogleAuthUrl("https://docket.example.test", "csrf-state-abc"));
  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "test-client-id.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://docket.example.test/auth/callback");
  assert.equal(url.searchParams.get("state"), "csrf-state-abc");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
});

test("parseCookies: parses a real multi-cookie header, including one with a URL-encoded value", () => {
  const parsed = parseCookies("docket_session=abc123; docket_oauth_state=xyz%3D%3D; other=1");
  assert.equal(parsed.docket_session, "abc123");
  assert.equal(parsed.docket_oauth_state, "xyz==");
  assert.equal(parsed.other, "1");
});

test("parseCookies: empty/undefined header returns an empty object, not a throw", () => {
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(""), {});
});

test("sessionCookieHeader: HttpOnly + SameSite=Lax always set; Secure only for an https origin", () => {
  const httpsHeader = sessionCookieHeader("sess-id", "https://docket.example.test");
  assert.match(httpsHeader, /HttpOnly/);
  assert.match(httpsHeader, /SameSite=Lax/);
  assert.match(httpsHeader, /Secure/);

  const httpHeader = sessionCookieHeader("sess-id", "http://localhost:3000");
  assert.match(httpHeader, /HttpOnly/);
  assert.doesNotMatch(httpHeader, /Secure/);
});

test("clearSessionCookieHeader: expires the cookie immediately (Max-Age=0)", () => {
  assert.match(clearSessionCookieHeader("https://docket.example.test"), /Max-Age=0/);
});
