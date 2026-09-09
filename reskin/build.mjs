#!/usr/bin/env node
/**
 * Bundles reskin/src into one Safari-userscript file with a `// ==UserScript==`
 * metadata block — no signing, no Xcode, no code-signing pipeline at all
 * (that's the whole point: see reskin/README.md). `@match` is scoped to
 * LearningSuite's own origin only (spec §23 — narrowest possible permission).
 *
 * `@connect max.byu.edu` + `GM_xmlhttpRequest` are the one deliberate exception: opt-in
 * "External Calendars" (Settings) lets a student merge a course's iCalendar feed hosted
 * elsewhere (e.g. BYU MAX, `max.byu.edu`) into the Combined Schedule agenda — see
 * homeAdapter.ts's loadExternalFeeds(). Off by default, and only ever fetches a URL the
 * student explicitly typed in; nothing is sent, only read. See reskin/PRIVACY.md.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

// Where the built file is published for install/update — update this if the project is
// forked or moved. The version query prevents userscript managers from serving a stale cached
// bundle during update checks (a real Safari Userscripts failure observed in Sep 2026).
const REPO = "droper23/docket";
const SCRIPT_PATH = "reskin/dist/learningsuite-reskin.user.js";

const metadata = `// ==UserScript==
// @name         LearningSuite Reskin
// @namespace    https://github.com/${REPO}
// @version      ${pkg.version}
// @description  A visual/interaction layer over BYU LearningSuite, styled like an Apple-designed app. LearningSuite stays the real backend — nothing is replaced. See reskin/README.md.
// @author       Docket contributors
// @match        https://learningsuite.byu.edu/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      max.byu.edu
// @updateURL    https://raw.githubusercontent.com/${REPO}/main/${SCRIPT_PATH}?v=${pkg.version}
// @downloadURL  https://raw.githubusercontent.com/${REPO}/main/${SCRIPT_PATH}?v=${pkg.version}
// ==/UserScript==
`;

mkdirSync(join(__dirname, "dist"), { recursive: true });

const outfile = join(__dirname, "dist/learningsuite-reskin.user.js");

await build({
  entryPoints: [join(__dirname, "src/index.ts")],
  bundle: true,
  format: "iife",
  target: "safari14",
  outfile,
  loader: { ".css": "text" },
  banner: { js: metadata },
  logLevel: "info",
});

// Userscripts evaluates content-mode scripts inside a function that has a
// non-simple parameter list. A "use strict" directive is a syntax error in
// that context; esbuild adds one to IIFE output by default. The bundle does
// not require strict mode, so remove only that generated directive.
const output = readFileSync(outfile, "utf8");
writeFileSync(outfile, output.replace(/\n"use strict";\n/, "\n"));
