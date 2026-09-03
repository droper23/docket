import { createServer } from "node:http";
import { DemoConnector } from "../connectors/demoConnector.js";
import { IcsConnector } from "../connectors/icsConnector.js";
import { SNAPSHOT_PATH, loadKnownCourses } from "../config.js";
import { recentChanges, todayView, upcomingView, workloadView } from "../core/academicViews.js";
import { computeDiagnostics } from "../core/diagnostics.js";
import { SnapshotStore } from "../core/store.js";
import { runSync } from "../core/syncRunner.js";
import { renderChanges, renderCourses, renderDiagnostics, renderToday, renderUpcoming } from "./render.js";

const PORT = Number(process.env.PORT ?? 4127);
const store = new SnapshotStore(SNAPSHOT_PATH);

async function pickConnector() {
  const known = await loadKnownCourses();
  return known.length > 0 ? new IcsConnector(known) : new DemoConnector();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

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
      return html(res, renderDiagnostics(computeDiagnostics(snapshot)));
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

function html(res: import("node:http").ServerResponse, body: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function redirect(res: import("node:http").ServerResponse, location: string) {
  res.writeHead(303, { Location: location });
  res.end();
}

server.listen(PORT, () => {
  console.log(`Docket dashboard running at http://localhost:${PORT}`);
});
