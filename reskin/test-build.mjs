#!/usr/bin/env node
/** Bundles each test/*.test.ts (and its relative source imports) to plain ESM under Node — run via `npm test`, not directly. */
import { build } from "esbuild";
import { readdirSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, "test");
const entryPoints = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => join(testDir, f));

mkdirSync(join(__dirname, "dist-test"), { recursive: true });
// Test files resolve fixtures relative to their own compiled location, so the fixtures
// directory needs to exist alongside them under dist-test/, not just under test/.
cpSync(join(testDir, "fixtures"), join(__dirname, "dist-test/fixtures"), { recursive: true });

await build({
  entryPoints,
  outdir: join(__dirname, "dist-test"),
  bundle: true,
  platform: "node",
  format: "esm",
  loader: { ".css": "text" },
  // jsdom is a heavy CJS package that uses dynamic `require()` internally —
  // bundling it breaks under esbuild's ESM output. Left external so Node
  // resolves it normally at test-run time instead.
  external: ["jsdom"],
  logLevel: "info",
});
