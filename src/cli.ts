import { DemoConnector } from "./connectors/demoConnector.js";
import { IcsConnector } from "./connectors/icsConnector.js";
import { DEFAULT_USER_ID, getSnapshotStore, loadKnownCourses } from "./config.js";
import { runSync } from "./core/syncRunner.js";

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const store = await getSnapshotStore();

  if (command === "reset") {
    await store.reset(DEFAULT_USER_ID);
    console.log("Docket data reset. Nothing was changed on LearningSuite itself.");
    return;
  }

  if (command === "sync") {
    const sourceFlagIdx = rest.indexOf("--source");
    const source = sourceFlagIdx >= 0 ? rest[sourceFlagIdx + 1] : "demo";

    const connector =
      source === "demo"
        ? new DemoConnector()
        : new IcsConnector(await loadKnownCourses(DEFAULT_USER_ID));

    if (source === "ics") {
      const known = await loadKnownCourses(DEFAULT_USER_ID);
      if (known.length === 0) {
        console.error(
          `No courses configured. Add your real courses (with their LearningSuite ICS feed URLs) to data/courses.config.json first — see README.md "Connecting a real LearningSuite account".`,
        );
        process.exitCode = 1;
        return;
      }
    }

    const snapshot = await store.load(DEFAULT_USER_ID);
    const outcome = await runSync(snapshot, connector);
    await store.save(DEFAULT_USER_ID, snapshot);

    console.log(`Sync via "${connector.id}": ${outcome.coursesSynced} course(s) processed, ${outcome.changeCount} change(s) recorded.`);
    if (outcome.coursesFailed.length > 0) {
      console.log("Some courses did not sync cleanly (existing data for them was left untouched):");
      for (const f of outcome.coursesFailed) console.log(`  - ${f.courseId}: ${f.message}`);
    }
    return;
  }

  console.log("Usage: docket sync --source <demo|ics>  |  docket reset");
}

main().catch((err) => {
  console.error("Docket CLI failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
