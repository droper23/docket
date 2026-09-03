// Vercel Cron target — configured in vercel.json to run on a schedule.
// Replaces the local launchd agent (scripts/install-launchd.sh) once
// deployed: this is what keeps course data current without anyone's
// laptop needing to be on. See docs/ARCHITECTURE.md §12.
import { DemoConnector } from "../../dist/src/connectors/demoConnector.js";
import { IcsConnector } from "../../dist/src/connectors/icsConnector.js";
import { getSnapshotStore, loadKnownCourses } from "../../dist/src/config.js";
import { runSync } from "../../dist/src/core/syncRunner.js";

export default async function handler(req, res) {
  // Vercel signs cron requests with this header — reject anything else so a
  // random visitor can't trigger unlimited syncs. CRON_SECRET is set once
  // via `vercel env add CRON_SECRET`; if it's unset (e.g. a fresh deploy
  // before that step), fail closed rather than run unauthenticated.
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"];
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.statusCode = 401;
    res.end("Unauthorized");
    return;
  }

  try {
    const known = await loadKnownCourses();
    const connector = known.length > 0 ? new IcsConnector(known) : new DemoConnector();
    const store = await getSnapshotStore();
    const snapshot = await store.load();
    const outcome = await runSync(snapshot, connector);
    await store.save(snapshot);

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: outcome.ok, source: connector.id, ...outcome }));
  } catch (err) {
    console.error("Docket cron sync failed:", err instanceof Error ? err.message : err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}
