#!/usr/bin/env node
/**
 * Bundles reskin/src into one Safari-userscript file with a `// ==UserScript==`
 * metadata block — no signing, no Xcode, no code-signing pipeline at all
 * (that's the whole point: see reskin/README.md). `@match` is scoped to
 * LearningSuite's own origin only (spec §23 — narrowest possible permission).
 */
import { build } from "esbuild";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

// Where the built file is published for install/update — update this if the project is
// forked or moved. Userscripts (the Safari extension this targets) checks @version against
// @updateURL to offer updates; see reskin/README.md for the exact install/update flow.
const REPO = "droper23/docket";
const SCRIPT_PATH = "reskin/dist/learningsuite-reskin.user.js";

const metadata = `// ==UserScript==
// @name         LearningSuite Reskin
// @namespace    https://github.com/${REPO}
// @version      ${pkg.version}
// @description  A visual/interaction layer over BYU LearningSuite, styled like an Apple-designed app. LearningSuite stays the real backend — nothing is replaced. See reskin/README.md.
// @author       Docket contributors
// @match        https://learningsuite.byu.edu/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/${REPO}/main/${SCRIPT_PATH}
// @downloadURL  https://raw.githubusercontent.com/${REPO}/main/${SCRIPT_PATH}
// ==/UserScript==
`;

mkdirSync(join(__dirname, "dist"), { recursive: true });

await build({
  entryPoints: [join(__dirname, "src/index.ts")],
  bundle: true,
  format: "iife",
  target: "safari14",
  outfile: join(__dirname, "dist/learningsuite-reskin.user.js"),
  loader: { ".css": "text" },
  banner: { js: metadata },
  logLevel: "info",
});
