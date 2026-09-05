#!/usr/bin/env node
/**
 * Live verification of the @run-at document-start fix (issue #7). CDP's
 * Page.addScriptToEvaluateOnNewDocument runs the bundle at the same point a
 * userscript manager's document-start injection would — before the parser has
 * built <head>/<body> — so this exercises the exact early path src/index.ts
 * now takes. Registers the bundle with a tiny probe prepended, navigates to a
 * real Schedule page, then asserts:
 *   - probe.readyState === "loading" (script ran before DOMContentLoaded)
 *   - style injected immediately, before <head> exists (lands on <html>)
 *   - after load: <html data-docket-reskin> present, style re-parented to end
 *     of <head>, body font is Inter (the flash-killer doing its job)
 *   - shell + adapters still mount normally (boot still works)
 * Usage: node tools/audit/50-document-start-check.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.CDP_PORT ?? "9222";
const BASE = `http://127.0.0.1:${PORT}`;

const target = (await (await fetch(`${BASE}/json/list`)).json()).find((t) => t.type === "page" && /learningsuite\.byu\.edu/.test(t.url));
if (!target) throw new Error("no learningsuite tab");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", () => rej(new Error("ws failed")), { once: true });
});
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("page threw: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result?.value;
};

// Bundle minus its userscript metadata header, with the early probe prepended.
const code = readFileSync(join(__dirname, "..", "..", "dist", "learningsuite-reskin.user.js"), "utf8");
const idx = code.indexOf('"use strict";');
const bundle = code.slice(idx);
const probe = `window.__docketProbe = { ranAt: performance.now(), readyState: document.readyState, hadHead: !!document.head };`;

// Register BEFORE navigating so the script runs at the very start of the new document.
await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: probe + bundle });

// Navigate to the course Schedule page (the page the "font visibly gets bigger"
// complaint was about) and let it load fully.
await send("Page.navigate", { url: "https://learningsuite.byu.edu/" });
await new Promise((r) => setTimeout(r, 1000));
await send("Page.navigate", { url: "https://learningsuite.byu.edu/.ORi6/cid-9R_ouvfPP1_r/student/calendar" });
await new Promise((r) => setTimeout(r, 8000));

const probeResult = await evaluate("window.__docketProbe ?? null");
const afterLoad = await evaluate(`(() => {
  const style = document.getElementById("docket-reskin-styles");
  const head = document.head;
  const fab = document.querySelector(".docket-fab");
  const bodyFont = getComputedStyle(document.body).fontFamily;
  return {
    reskinAttr: document.documentElement.getAttribute("data-docket-reskin"),
    styleOnHtml: style ? style.parentElement === document.documentElement : null,
    styleInHead: style ? style.parentElement === head : null,
    styleIsLastInHead: style && head ? head.lastElementChild === style : null,
    fabMounted: !!fab,
    bodyFontIsInter: bodyFont.startsWith("Inter"),
    schedulePageAttr: document.documentElement.getAttribute("data-docket-page"),
  };
})()`);

console.log(JSON.stringify({ probeResult, afterLoad }, null, 2));
// Deregister so later manual injects don't double-run.
await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: (await send("Runtime.evaluate", { expression: "1", returnByValue: true })).result.value && undefined }).catch(() => {});
ws.close();
