#!/usr/bin/env node
/**
 * One-time build-time asset fetch for issue #4 ("all the fonts should be the
 * same"): downloads Inter's variable woff2 (SIL OFL) so build.mjs can embed it
 * as a base64 data: URI — zero network requests at runtime, per PRIVACY.md.
 * Uses Google Fonts' own unicode-range subset files (the "latin" block), which
 * keeps the embedded payload small; characters outside the subset fall through
 * --docket-font's stack to system fonts per-glyph, as font fallback always has.
 *
 * Usage: node tools/fetch-font.mjs   (writes src/styles/font-inter.css)
 * Committing the generated file keeps `npm run build` itself network-free.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();

// Google serves per-subset @font-face blocks; keep only the latin one (the last
// block, with unicode-range covering U+0000-00FF). Safari 14 supports woff2 and
// variable fonts, so a single file covers every weight we specify.
const blocks = [...css.matchAll(/\/\*\s*(\S+)\s*\*\/\s*@font-face\s*{[^}]*}/g)];
const latin = blocks.find((m) => m[1] === "latin");
if (!latin) throw new Error("latin subset block not found in Google Fonts response");
const faceBlock = latin[0].replace(/^\/\*\s*\S+\s*\*\/\s*/, "");
const srcUrl = faceBlock.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
if (!srcUrl) throw new Error("woff2 url not found in latin @font-face block");

const fontBytes = Buffer.from(await (await fetch(srcUrl)).arrayBuffer());
const b64 = fontBytes.toString("base64");

const woff2 = faceBlock.match(/format\('woff2'\)/) ? "woff2" : "woff2-variations";
const out = `/**
 * GENERATED FILE — do not edit by hand. Regenerate with: node tools/fetch-font.mjs
 *
 * Inter (variable, SIL Open Font License 1.1 — https://github.com/rsms/inter/blob/master/LICENSE.txt),
 * embedded as a base64 data: URI so the reskin renders a real, consistent,
 * SF-Pro-proportioned typeface on every OS/browser with ZERO network requests
 * (PRIVACY.md/THREAT_MODEL.md: the only permitted origin is learningsuite.byu.edu
 * itself, so a CDN is not an option; a data: URI makes no request at all).
 *
 * Why this exists (confirmed live Sep 2026): --docket-font's stack
 * (-apple-system, BlinkMacSystemFont, "SF Pro Text", ...) only resolves to real
 * San Francisco on Apple platforms; on Windows/Android/Linux it falls all the
 * way through to Arial — exactly the "generic" look the user reported.
 * Inter is first in the stack AFTER the data: font is guaranteed available, so
 * Apple platforms may still resolve -apple-system first (native SF there is the
 * best possible result); everywhere else gets Inter instead of Arial.
 * Source woff2: ${srcUrl}
 * Payload: ${(fontBytes.length / 1024).toFixed(1)} KB raw (base64 adds ~33%).
 * Subset: Google Fonts' "latin" unicode-range block; other scripts fall back
 * per-glyph to system fonts, as font fallback always has.
 */
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(data:font/woff2;base64,${b64}) format("${woff2}");
}
`;

const outPath = join(__dirname, "..", "src", "styles", "font-inter.css");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`wrote ${outPath} — font ${(fontBytes.length / 1024).toFixed(1)} KB, css ${(out.length / 1024).toFixed(1)} KB`);
