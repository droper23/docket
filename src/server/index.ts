import { execFile } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import { hostname, networkInterfaces } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { DemoConnector } from "../connectors/demoConnector.js";
import { IcsConnector } from "../connectors/icsConnector.js";
import { bookmarkletHref } from "../connectors/bookmarklet.js";
import { SNAPSHOT_PATH, loadKnownCourses, saveDiscoveredCourses } from "../config.js";
import type { DiscoveredCourse } from "../config.js";
import { recentChanges, todayView, upcomingView, workloadView } from "../core/academicViews.js";
import { computeDiagnostics } from "../core/diagnostics.js";
import { applySessionEnrichment } from "../core/enrichment.js";
import type { AssignmentPageRow } from "../core/enrichment.js";
import { SnapshotStore } from "../core/store.js";
import { runSync } from "../core/syncRunner.js";
import {
  renderChanges,
  renderConnect,
  renderCourses,
  renderDiagnostics,
  renderImportResult,
  renderToday,
  renderUpcoming,
} from "./render.js";

const PORT = Number(process.env.PORT ?? 4127);
const store = new SnapshotStore(SNAPSHOT_PATH);

async function pickConnector() {
  const known = await loadKnownCourses();
  return known.length > 0 ? new IcsConnector(known) : new DemoConnector();
}

/** Reads and caps a request body — this endpoint is reachable by anything on the LAN, not just the bookmarklet, so never trust size or shape. */
async function readBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<string> {
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
    return { title: r.title, due: r.due.slice(0, MAX_FIELD_LEN), score: r.score.slice(0, 40) };
  });
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${PORT}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const origin = `http://${host}`;

    if (req.method === "POST" && url.pathname === "/sync") {
      const snapshot = await store.load();
      const connector = await pickConnector();
      await runSync(snapshot, connector);
      await store.save(snapshot);
      redirect(res, "/");
      return;
    }

    if (req.method === "POST" && url.pathname === "/reset") {
      await store.reset();
      redirect(res, "/diagnostics");
      return;
    }

    if (req.method === "POST" && url.pathname === "/connect/learningsuite/import") {
      const body = parseFormBody(await readBody(req));
      try {
        const discovered = validateDiscoveredCourses(JSON.parse(body.courses ?? "null"));
        const known = await saveDiscoveredCourses(discovered);
        const list = known.map((c) => `<li>${esc(c.code)} — ${esc(c.title)}</li>`).join("");
        return html(res, renderImportResult("courses", `<p>Found ${known.length} course(s):</p><ul>${list}</ul><p>Go back to Docket and click <strong>Sync now</strong> to pull in their schedules.</p>`));
      } catch (err) {
        return html(res, renderImportResult("courses", `<p>Couldn't import: ${esc(err instanceof Error ? err.message : String(err))}</p>`), 400);
      }
    }

    if (req.method === "POST" && url.pathname === "/connect/learningsuite/import-assignments") {
      const body = parseFormBody(await readBody(req));
      try {
        const courseId = body.courseId;
        if (!isNonEmptyShortString(courseId)) throw new Error("Missing courseId");
        const rows = validateAssignmentRows(JSON.parse(body.rows ?? "null"));
        const snapshot = await store.load();
        const outcome = applySessionEnrichment(snapshot, courseId, rows);
        await store.save(snapshot);
        const unmatchedNote =
          outcome.unmatched.length > 0
            ? `<p>${outcome.unmatched.length} row(s) couldn't be matched to a synced assignment (run <strong>Sync now</strong> first if you haven't synced this course yet): ${outcome.unmatched.map((t) => esc(t)).join(", ")}</p>`
            : "";
        return html(
          res,
          renderImportResult(
            "assignments",
            `<p>Matched ${outcome.matched} of ${rows.length} assignment(s), ${outcome.changeCount} updated with new grade/due-time info.</p>${unmatchedNote}`,
          ),
        );
      } catch (err) {
        return html(res, renderImportResult("assignments", `<p>Couldn't import: ${esc(err instanceof Error ? err.message : String(err))}</p>`), 400);
      }
    }

    const snapshot = await store.load();

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
      const { lan, tailscale, localHostname } = await phoneAccessInfo();
      return html(res, renderDiagnostics(computeDiagnostics(snapshot), { lan, tailscale, localHostname, port: PORT }));
    }
    if (req.method === "GET" && url.pathname === "/connect") {
      const known = await loadKnownCourses();
      return html(
        res,
        renderConnect({
          courseListHref: bookmarkletHref("courses", origin),
          assignmentsHref: bookmarkletHref("assignments", origin),
          knownCourseCount: known.length,
        }),
      );
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    // A rendering/route bug must never look like "your data is gone" — surface it plainly instead.
    console.error("Docket server error:", err instanceof Error ? err.message : err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Docket hit an internal error. Your local data on disk is untouched.");
  }
});

function html(res: import("node:http").ServerResponse, body: string, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function redirect(res: import("node:http").ServerResponse, location: string) {
  res.writeHead(303, { Location: location });
  res.end();
}

/**
 * Which of this machine's IPv4 addresses is Tailscale's own virtual
 * interface, asked directly (`tailscale ip -4`) rather than guessed from
 * its IP range — some campus Wi-Fi networks (this one included) hand out
 * addresses in the same 100.64.0.0/10 CGNAT space Tailscale uses for its
 * overlay, so range-sniffing alone mislabels a perfectly ordinary Wi-Fi
 * address as "Tailscale." Returns undefined if the `tailscale` CLI isn't
 * installed or isn't logged in — most students won't have it, and that's
 * fine, it's presented as an optional fallback, never the default.
 */
async function tailscaleAddress(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("tailscale", ["ip", "-4"], { timeout: 2000 });
    const ip = stdout.trim().split("\n")[0]?.trim();
    return ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every non-internal IPv4 address this machine has, split into "ordinary
 * Wi-Fi/Ethernet LAN" vs. Tailscale's virtual address. Kept separate
 * because they mean different things to a student reading the startup
 * message: a LAN address works only if the phone is on the *same* Wi-Fi
 * and that network doesn't isolate devices from each other (many
 * campus/eduroam-style networks do); a Tailscale address works from
 * anywhere, but only if Tailscale is installed.
 */
async function detectedAddresses(): Promise<{ lan: string[]; tailscale: string[] }> {
  const nets = networkInterfaces();
  const all: string[] = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === "IPv4" && !net.internal) all.push(net.address);
    }
  }
  const tsAddr = await tailscaleAddress();
  const tailscale = tsAddr && all.includes(tsAddr) ? [tsAddr] : [];
  const lan = all.filter((a) => a !== tsAddr);
  return { lan, tailscale };
}

export async function phoneAccessInfo(): Promise<{ lan: string[]; tailscale: string[]; localHostname: string }> {
  const { lan, tailscale } = await detectedAddresses();
  const localHostname = hostname().endsWith(".local") ? hostname() : `${hostname()}.local`;
  return { lan, tailscale, localHostname };
}

// Bind to all interfaces (not just localhost) so a phone on the same Wi-Fi can reach
// this — see docs/ARCHITECTURE.md §Phone access. Still entirely local: nothing here
// is exposed to the public internet, and there's no port-forwarding involved.
server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Docket dashboard running at http://localhost:${PORT}`);
  const { lan, tailscale, localHostname } = await phoneAccessInfo();
  if (lan.length > 0) {
    console.log(`On your phone (same Wi-Fi, no install needed): http://${localHostname}:${PORT}  (or by IP: ${lan.map((a) => `http://${a}:${PORT}`).join(", ")})`);
  }
  if (tailscale.length > 0) {
    console.log(`Tailscale detected — also reachable from anywhere at: ${tailscale.map((a) => `http://${a}:${PORT}`).join(", ")}`);
  }
  if (lan.length === 0 && tailscale.length === 0) {
    console.log(`No network interface detected for phone access — see docs/ARCHITECTURE.md §Phone access.`);
  }
});
