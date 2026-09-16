#!/usr/bin/env node
/**
 * Publishes this project's public-facing files to the standalone GitHub repo the
 * userscript is actually installed from (see build.mjs's own REPO constant).
 *
 * This monorepo's reskin/ is the working copy. The standalone repo is a
 * hand-curated public mirror with its own independent commit history — it was
 * never derived from this repo's git log, so this script works by diffing file
 * contents, not by merging or rebasing history.
 *
 * `tools/cdp.mjs`, `tools/audit/*`, and this script itself are deliberately never
 * published: internal live-audit debug tooling, not part of the contributor
 * workflow documented in README.md's Development section. Extend EXCLUDE below if
 * something else internal-only gets added to reskin/ later.
 *
 * Usage:
 *   node tools/publish.mjs                    Dry run: clone the public repo to a
 *                                              temp dir, sync files into it, and
 *                                              print what would change. Leaves the
 *                                              clone on disk for inspection.
 *   node tools/publish.mjs --publish          Same, then commit and push.
 *   node tools/publish.mjs --publish --message "..."   Custom commit message.
 *   node tools/publish.mjs --publish --keep   Don't delete the temp clone after a
 *                                              successful push.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, mkdtempSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// Read the target repo out of build.mjs rather than hardcoding it a second time —
// importing build.mjs directly would re-run the esbuild step, so this just greps
// its source text for the constant.
const buildSrc = readFileSync(join(REPO_ROOT, "build.mjs"), "utf8");
const repoMatch = buildSrc.match(/const REPO = "([^"]+)"/);
if (!repoMatch) throw new Error("Could not find REPO constant in build.mjs");
const REPO = repoMatch[1];
const PUBLIC_URL = `https://github.com/${REPO}.git`;

const EXCLUDE = [/^tools\/cdp\.mjs$/, /^tools\/audit\//, /^tools\/publish\.mjs$/];
const isExcluded = (path) => EXCLUDE.some((re) => re.test(path));

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

const args = process.argv.slice(2);
const doPublish = args.includes("--publish");
const keep = args.includes("--keep");
const messageIdx = args.indexOf("--message");
const message = messageIdx >= 0 ? args[messageIdx + 1] : "Sync public release from reskin/";

const workDir = mkdtempSync(join(tmpdir(), "learningsuite-reskin-public-"));
console.log(`cloning ${PUBLIC_URL} into ${workDir}...`);
git(["clone", "--quiet", PUBLIC_URL, workDir]);

const sourceFiles = git(["ls-files"], REPO_ROOT).trim().split("\n").filter(Boolean).filter((f) => !isExcluded(f));
const destFiles = git(["ls-files"], workDir).trim().split("\n").filter(Boolean);
const sourceSet = new Set(sourceFiles);

for (const file of sourceFiles) {
  mkdirSync(join(workDir, dirname(file)), { recursive: true });
  copyFileSync(join(REPO_ROOT, file), join(workDir, file));
}
for (const file of destFiles) {
  if (!sourceSet.has(file)) rmSync(join(workDir, file), { force: true });
}

git(["add", "-A"], workDir);
const status = git(["status", "--short"], workDir);

if (!status.trim()) {
  console.log("Public repo already matches reskin/ — nothing to publish.");
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

console.log(status);
console.log(git(["diff", "--cached", "--stat"], workDir));

if (!doPublish) {
  console.log(`Dry run only — re-run with --publish to commit and push.\nClone left at ${workDir} for inspection.`);
  process.exit(0);
}

git(["commit", "-m", message], workDir);
git(["push", "origin", "HEAD"], workDir);
console.log(`published ${git(["rev-parse", "--short", "HEAD"], workDir).trim()} to ${REPO}`);

if (!keep) rmSync(workDir, { recursive: true, force: true });
