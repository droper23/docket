import type { IncomingMessage, ServerResponse } from "node:http";
import { DemoConnector } from "../connectors/demoConnector.js";
import { IcsConnector } from "../connectors/icsConnector.js";
import { bookmarkletHref, bookmarkletSource } from "../connectors/bookmarklet.js";
import { DEFAULT_USER_ID, getSnapshotStore, isCloudMode, isMultiTenantMode, loadKnownCourses, saveDiscoveredCourses } from "../config.js";
import type { DiscoveredCourse } from "../config.js";
import { recentChanges, todayView, upcomingView, workloadView } from "../core/academicViews.js";
import { computeDiagnostics } from "../core/diagnostics.js";
import { applySessionEnrichment } from "../core/enrichment.js";
import type { AssignmentPageRow } from "../core/enrichment.js";
import type { AssignmentLink } from "../core/types.js";
import { runSync } from "../core/syncRunner.js";
import { checkRateLimit } from "../core/rateLimit.js";
import {
  buildGoogleAuthUrl,
  clearSessionCookieHeader,
  completeGoogleLogin,
  createSession,
  deleteAccount,
  deleteSession,
  getUserProfile,
  parseCookies,
  regenerateBookmarkletToken,
  resolveUserId,
  resolveUserIdFromBookmarkletToken,
  sessionCookieHeader,
  sessionIdFromCookieHeader,
  upsertUser,
} from "./auth.js";
import type { PhoneAccessInfo } from "./render.js";
import {
  renderAccount,
  renderChanges,
  renderConnect,
  renderCourses,
  renderDiagnostics,
  renderImportResult,
  renderLogin,
  renderPrivacy,
  renderToday,
  renderUpcoming,
} from "./render.js";

async function pickConnector(userId: string) {
  const known = await loadKnownCourses(userId);
  return known.length > 0 ? new IcsConnector(known) : new DemoConnector();
}

/** IP for rate-limiting purposes — Vercel forwards the real client IP via `x-forwarded-for`; a bare local server has no proxy in front of it, so `req.socket.remoteAddress` is the real thing there. */
function clientIp(req: IncomingMessage): string {
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

/**
 * Cross-site POSTs can't be blocked by `SameSite=Lax` alone in every
 * browser configuration, so cookie-authenticated state-changing routes
 * (unlike the bookmarklet import routes, which use their own per-user
 * token and are never cookie-authenticated) also check that the request
 * actually originated from this deployment — a standard, dependency-free
 * CSRF defense. Missing entirely (a very old browser, or a non-browser
 * client with no Origin/Referer at all) is treated as a failure, not an
 * exemption — a real cross-site form POST omits neither header in any
 * browser capable of sending cookies in the first place.
 */
function isSameOriginRequest(req: IncomingMessage, origin: string): boolean {
  const originHeader = req.headers.origin as string | undefined;
  if (originHeader) return originHeader === origin;
  const referer = req.headers.referer as string | undefined;
  return !!referer && referer.startsWith(`${origin}/`);
}

/** Reads and caps a request body — this endpoint is reachable by anyone who can reach the deployment, not just the bookmarklet, so never trust size or shape. */
async function readBody(req: IncomingMessage, maxBytes = 2 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const MAX_IMPORTED_COURSES = 50;
const MAX_FIELD_LEN = 200;

function isNonEmptyShortString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= MAX_FIELD_LEN;
}

function validateDiscoveredCourses(raw: unknown): DiscoveredCourse[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPORTED_COURSES) {
    throw new Error("Expected a non-empty list of courses");
  }
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null) throw new Error(`Course #${i + 1} is malformed`);
    const c = item as Record<string, unknown>;
    if (!isNonEmptyShortString(c.courseId) || !isNonEmptyShortString(c.code) || typeof c.title !== "string") {
      throw new Error(`Course #${i + 1} is missing required fields`);
    }
    return {
      courseId: c.courseId,
      code: c.code,
      title: c.title.slice(0, MAX_FIELD_LEN),
      term: typeof c.term === "string" ? c.term.slice(0, MAX_FIELD_LEN) : undefined,
    };
  });
}

const MAX_IMPORTED_ROWS = 300;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_LINKS_PER_ROW = 10;
const MAX_LINK_TEXT_LEN = 100;
const MAX_LINK_URL_LEN = 500;

function validateLinks(raw: unknown): AssignmentLink[] {
  if (!Array.isArray(raw)) return [];
  const links: AssignmentLink[] = [];
  for (const item of raw.slice(0, MAX_LINKS_PER_ROW)) {
    if (typeof item !== "object" || item === null) continue;
    const l = item as Record<string, unknown>;
    if (typeof l.url !== "string" || !/^https?:\/\//.test(l.url)) continue;
    // Defense in depth: the bookmarklet already excludes learningsuite.byu.edu links
    // (session-scoped path prefix, not worth capturing) — enforce that server-side too,
    // since this route accepts input from any page's JS, not just the real bookmarklet.
    if (/learningsuite\.byu\.edu/i.test(l.url)) continue;
    links.push({
      text: typeof l.text === "string" ? l.text.slice(0, MAX_LINK_TEXT_LEN) : "",
      url: l.url.slice(0, MAX_LINK_URL_LEN),
    });
  }
  return links;
}

function validateAssignmentRows(raw: unknown): AssignmentPageRow[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPORTED_ROWS) {
    throw new Error("Expected a non-empty list of assignment rows");
  }
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null) throw new Error(`Row #${i + 1} is malformed`);
    const r = item as Record<string, unknown>;
    if (!isNonEmptyShortString(r.title) || typeof r.due !== "string" || typeof r.score !== "string") {
      throw new Error(`Row #${i + 1} is missing required fields`);
    }
    return {
      title: r.title,
      due: r.due.slice(0, MAX_FIELD_LEN),
      score: r.score.slice(0, 40),
      category: typeof r.category === "string" && r.category.length > 0 ? r.category.slice(0, MAX_FIELD_LEN) : undefined,
      description: typeof r.description === "string" && r.description.length > 0 ? r.description.slice(0, MAX_DESCRIPTION_LEN) : undefined,
      links: validateLinks(r.links),
      completed: r.completed === true,
    };
  });
}

function html(res: ServerResponse, body: string, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(303, { Location: location });
  res.end();
}

/**
 * The actual origin (scheme + host) this request arrived on — used to bake
 * a working URL into the bookmarklets (docs/ARCHITECTURE.md §8). Vercel
 * terminates TLS in front of the function and forwards the original scheme
 * via `x-forwarded-proto`; a plain local `http.createServer` never sets
 * that header, so it falls back to http. Getting this right matters for a
 * reason beyond cosmetics: a bookmarklet's cross-origin POST from an HTTPS
 * LearningSuite page to a deployed origin only avoids mixed-content
 * blocking if that origin is *also* https.
 */
function requestOrigin(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

/**
 * Optional, local-only enrichment for the Diagnostics page (same-Wi-Fi /
 * Tailscale addresses — see docs/ARCHITECTURE.md §9). Undefined when
 * running as a deployed function: there's no meaningful "this machine's
 * network interfaces" to report there, and shelling out to the `tailscale`
 * CLI (which doesn't exist in that environment) would just add latency to
 * every request for nothing.
 */
export type PhoneAccessProvider = () => Promise<PhoneAccessInfo | undefined>;

export async function handleRequest(req: IncomingMessage, res: ServerResponse, getPhoneAccessInfo?: PhoneAccessProvider): Promise<void> {
  try {
    const origin = requestOrigin(req);
    const url = new URL(req.url ?? "/", origin);
    const store = await getSnapshotStore();
    const multiTenant = isMultiTenantMode();

    // --- Bookmarklet import routes: identity comes from a per-user token embedded in the
    // script (docs/ARCHITECTURE.md §14), never from a cookie — this request originates from
    // the LearningSuite tab's own origin, which can't carry Docket's session cookie
    // cross-site. Handled before the cookie-based login gate below, since these requests
    // never have a Docket session at all, by design. On a single-tenant instance (no
    // multi-tenant mode) this resolves to DEFAULT_USER_ID unconditionally, exactly
    // reproducing the "anyone who can reach this deployment" trust model that existed
    // before multi-tenancy — nothing changes there.
    if (req.method === "POST" && url.pathname === "/connect/learningsuite/import") {
      const body = parseFormBody(await readBody(req));
      try {
        const userId = await resolveImportUserId(body.token, multiTenant);
        if (isCloudMode()) {
          const rl = await checkRateLimit("import", userId, 30, 60);
          if (!rl.allowed) throw new Error("Too many import attempts — wait a minute and try again");
        }
        const discovered = validateDiscoveredCourses(JSON.parse(body.courses ?? "null"));
        const known = await saveDiscoveredCourses(userId, discovered);
        const list = known.map((c) => `<li>${esc(c.code)} — ${esc(c.title)}</li>`).join("");
        html(res, renderImportResult("courses", `<p>Found ${known.length} course(s):</p><ul>${list}</ul><p>Go back to Docket and click <strong>Sync now</strong> to pull in their schedules.</p>`));
      } catch (err) {
        html(res, renderImportResult("courses", `<p>Couldn't import: ${esc(err instanceof Error ? err.message : String(err))}</p>`), 400);
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/connect/learningsuite/import-assignments") {
      const body = parseFormBody(await readBody(req));
      try {
        const userId = await resolveImportUserId(body.token, multiTenant);
        if (isCloudMode()) {
          const rl = await checkRateLimit("import", userId, 30, 60);
          if (!rl.allowed) throw new Error("Too many import attempts — wait a minute and try again");
        }
        const courseId = body.courseId;
        if (!isNonEmptyShortString(courseId)) throw new Error("Missing courseId");
        const rows = validateAssignmentRows(JSON.parse(body.rows ?? "null"));
        const snapshot = await store.load(userId);
        const outcome = applySessionEnrichment(snapshot, courseId, rows);
        await store.save(userId, snapshot);
        const unmatchedNote =
          outcome.unmatched.length > 0
            ? `<p>${outcome.unmatched.length} row(s) couldn't be matched to a synced assignment (run <strong>Sync now</strong> first if you haven't synced this course yet): ${outcome.unmatched.map((t) => esc(t)).join(", ")}</p>`
            : "";
        html(
          res,
          renderImportResult(
            "assignments",
            `<p>Matched ${outcome.matched} of ${rows.length} assignment(s), ${outcome.changeCount} updated with new grade/due-time info.</p>${unmatchedNote}`,
          ),
        );
      } catch (err) {
        html(res, renderImportResult("assignments", `<p>Couldn't import: ${esc(err instanceof Error ? err.message : String(err))}</p>`), 400);
      }
      return;
    }

    // --- Public routes: never need a Docket login. On a single-tenant instance these are
    // harmless dead ends (redirected straight back to "/") rather than 404s, since nothing
    // in that mode ever links to them.
    if (req.method === "GET" && url.pathname === "/privacy") {
      return html(res, renderPrivacy());
    }
    if (req.method === "GET" && url.pathname === "/auth/login") {
      if (!multiTenant) return redirect(res, "/");
      const state = Math.random().toString(36).slice(2);
      res.setHeader("Set-Cookie", `docket_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=600${origin.startsWith("https://") ? "; Secure" : ""}`);
      return redirect(res, buildGoogleAuthUrl(origin, state));
    }
    if (req.method === "GET" && url.pathname === "/auth/callback") {
      if (!multiTenant) return redirect(res, "/");
      if (isCloudMode()) {
        const rl = await checkRateLimit("auth-callback", clientIp(req), 20, 60);
        if (!rl.allowed) {
          res.writeHead(429, { "Content-Type": "text/plain" });
          res.end("Too many sign-in attempts — wait a minute and try again.");
          return;
        }
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const expectedState = parseCookies(req.headers.cookie)["docket_oauth_state"];
      if (!code || !state || !expectedState || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Sign-in failed: missing or mismatched state. Try signing in again from /auth/login.");
        return;
      }
      try {
        const identity = await completeGoogleLogin(code, origin);
        const profile = await upsertUser(identity);
        const sessionId = await createSession(profile.sub);
        res.setHeader("Set-Cookie", [sessionCookieHeader(sessionId, origin), `docket_oauth_state=; Max-Age=0; Path=/auth`]);
        return redirect(res, "/");
      } catch (err) {
        console.error("Docket sign-in failed:", err instanceof Error ? err.message : err);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Sign-in failed. Try again from /auth/login.");
        return;
      }
    }
    if (req.method === "POST" && url.pathname === "/auth/logout") {
      const sessionId = sessionIdFromCookieHeader(req.headers.cookie);
      if (sessionId) await deleteSession(sessionId);
      res.setHeader("Set-Cookie", clearSessionCookieHeader(origin));
      return redirect(res, multiTenant ? "/auth/login" : "/");
    }

    // --- Everything below requires a resolved identity. Single-tenant: always
    // DEFAULT_USER_ID, no login, exactly as before multi-tenant mode existed.
    // Multi-tenant: resolved from the session cookie; redirect to sign in if absent.
    const userId = multiTenant ? await resolveUserId(req.headers.cookie) : DEFAULT_USER_ID;
    if (!userId) {
      if (req.method === "GET") return html(res, renderLogin());
      return redirect(res, "/auth/login");
    }

    // Cookie-authenticated state-changing routes get CSRF protection via an
    // Origin/Referer check (see isSameOriginRequest) — the bookmarklet import routes above
    // are exempt because they were never cookie-authenticated in the first place.
    if (req.method === "POST" && multiTenant && !isSameOriginRequest(req, origin)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Request rejected: origin mismatch.");
      return;
    }

    if (req.method === "GET" && url.pathname === "/account") {
      if (!multiTenant) return redirect(res, "/");
      const profile = await getUserProfile(userId);
      if (!profile) return redirect(res, "/auth/login");
      const regenerated = url.searchParams.get("regenerated") === "1";
      return html(res, renderAccount({ email: profile.email, name: profile.name, bookmarkletToken: profile.bookmarkletToken, origin, regenerated }));
    }
    if (req.method === "GET" && url.pathname === "/account/export") {
      if (!multiTenant) return redirect(res, "/");
      const snapshot = await store.load(userId);
      res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=docket-export.json" });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }
    if (req.method === "POST" && url.pathname === "/account/regenerate-token") {
      if (!multiTenant) return redirect(res, "/");
      await regenerateBookmarkletToken(userId);
      return redirect(res, "/account?regenerated=1");
    }
    if (req.method === "POST" && url.pathname === "/account/delete") {
      if (!multiTenant) return redirect(res, "/");
      await deleteAccount(userId);
      res.setHeader("Set-Cookie", clearSessionCookieHeader(origin));
      return redirect(res, "/auth/login");
    }

    if (req.method === "POST" && url.pathname === "/sync") {
      const snapshot = await store.load(userId);
      const connector = await pickConnector(userId);
      await runSync(snapshot, connector);
      await store.save(userId, snapshot);
      redirect(res, "/");
      return;
    }

    if (req.method === "POST" && url.pathname === "/reset") {
      await store.reset(userId);
      redirect(res, "/diagnostics");
      return;
    }

    const snapshot = await store.load(userId);

    if (req.method === "GET" && url.pathname === "/") {
      return html(res, renderToday(todayView(snapshot)));
    }
    if (req.method === "GET" && url.pathname === "/upcoming") {
      return html(res, renderUpcoming(upcomingView(snapshot)));
    }
    if (req.method === "GET" && url.pathname === "/courses") {
      return html(res, renderCourses(snapshot, workloadView(snapshot)));
    }
    if (req.method === "GET" && url.pathname === "/changes") {
      return html(res, renderChanges(recentChanges(snapshot)));
    }
    if (req.method === "GET" && url.pathname === "/diagnostics") {
      const deployed = isCloudMode();
      const phone = deployed ? undefined : await getPhoneAccessInfo?.();
      return html(res, renderDiagnostics(computeDiagnostics(snapshot), phone, deployed));
    }
    if (req.method === "GET" && url.pathname === "/connect") {
      const known = await loadKnownCourses(userId);
      const profile = multiTenant ? await getUserProfile(userId) : null;
      const token = profile?.bookmarkletToken ?? "";
      return html(
        res,
        renderConnect({
          courseListHref: bookmarkletHref("courses", origin, token),
          assignmentsHref: bookmarkletHref("assignments", origin, token),
          courseListSource: bookmarkletSource("courses", origin, token),
          assignmentsSource: bookmarkletSource("assignments", origin, token),
          knownCourseCount: known.length,
          account: profile ? { email: profile.email } : undefined,
        }),
      );
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    // A rendering/route bug must never look like "your data is gone" — surface it plainly instead.
    console.error("Docket server error:", err instanceof Error ? err.message : err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Docket hit an internal error. Your data is untouched.");
  }
}

/** Resolves which user a bookmarklet import belongs to: the embedded token on a multi-tenant instance (rejecting a missing/invalid one outright), or `DEFAULT_USER_ID` unconditionally on a single-tenant one — unchanged from before multi-tenancy existed there. */
async function resolveImportUserId(token: string | undefined, multiTenant: boolean): Promise<string> {
  if (!multiTenant) return DEFAULT_USER_ID;
  if (!token) throw new Error("Missing identity token — copy a fresh script from /connect while signed in");
  const userId = await resolveUserIdFromBookmarkletToken(token);
  if (!userId) throw new Error("Unrecognized or revoked identity token — copy a fresh script from /connect while signed in");
  return userId;
}
