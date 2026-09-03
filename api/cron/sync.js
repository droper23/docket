// Vercel Cron target — configured in vercel.json to run on a schedule.
// Replaces the local launchd agent (scripts/install-launchd.sh) once
// deployed: this is what keeps course data current without anyone's
// laptop needing to be on. See docs/ARCHITECTURE.md §12.
import { DemoConnector } from "../../dist/src/connectors/demoConnector.js";
import { IcsConnector } from "../../dist/src/connectors/icsConnector.js";
import { DEFAULT_USER_ID, getSnapshotStore, isMultiTenantMode, loadKnownCourses } from "../../dist/src/config.js";
import { runSync } from "../../dist/src/core/syncRunner.js";
import { listAllUserIds } from "../../dist/src/core/redisStore.js";

/** One user's worth of sync work — shared by both the single- and multi-tenant paths below so there's exactly one implementation, not two. */
async function syncOneUser(userId) {
  const known = await loadKnownCourses(userId);
  const connector = known.length > 0 ? new IcsConnector(known) : new DemoConnector();
  const store = await getSnapshotStore();
  const snapshot = await store.load(userId);
  const outcome = await runSync(snapshot, connector);
  await store.save(userId, snapshot);
  return { source: connector.id, ...outcome };
}

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
    if (!isMultiTenantMode()) {
      // Single-tenant: exactly the original, single-user behavior — unchanged.
      const result = await syncOneUser(DEFAULT_USER_ID);
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: result.ok, ...result }));
      return;
    }

    // Multi-tenant: sync every registered student. One user's bad course config or a
    // transient network hiccup must never abort the run for everyone else — log and move
    // on, same "stale is better than wrong" resilience this project already applies to
    // sync elsewhere (docs/ARCHITECTURE.md).
    const userIds = await listAllUserIds();
    const results = [];
    for (const userId of userIds) {
      try {
        results.push({ userId, ...(await syncOneUser(userId)) });
      } catch (err) {
        console.error(`Docket cron sync failed for user ${userId}:`, err instanceof Error ? err.message : err);
        results.push({ userId, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, userCount: userIds.length, results }));
  } catch (err) {
    console.error("Docket cron sync failed:", err instanceof Error ? err.message : err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}
