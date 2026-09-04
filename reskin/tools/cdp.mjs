#!/usr/bin/env node
/**
 * Dependency-free Chrome DevTools Protocol driver for live-auditing real
 * learningsuite.byu.edu pages (the project's established methodology: never
 * ship a CSS selector that wasn't confirmed against the real DOM — see
 * reskin/AGENT_BRIEF.md strategy §1-2 and ROADMAP.md's live passes).
 *
 * Expects a Chrome instance running with --remote-debugging-port=9222
 * (see `launch` below). Node >= 22 required (global WebSocket).
 *
 * Commands:
 *   cdp.mjs launch <profileDir> [url]   Launch a fresh headed Chrome with a
 *                                       throwaway profile and open url.
 *   cdp.mjs open <url>                  Navigate the page tab.
 *   cdp.mjs eval '<expr>'               Evaluate JS in the page; prints JSON. *   cdp.mjs eval-file <path.mjs>    Evaluate a JS snippet from a file
 *                                       (avoids shell-quoting hell for long
 *                                       audit snippets). The file runs inside
 *                                       an async function, so it may `await`;
 *                                       its final statement should be
 *                                       `return <value>;`.

 *   cdp.mjs shot <out.png> [--full]     Screenshot the page (full = whole
 *                                       scrollable page).
 *   cdp.mjs tabs                        List open page targets.
 *
 * Everything is driven over the HTTP /json + WebSocket endpoints — no npm
 * deps, no build step.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.CDP_PORT ?? "9222";
const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  const targets = await (await fetch(`${BASE}/json/list`)).json();
  const page = targets.find((t) => t.type === "page" && /learningsuite\.byu\.edu/.test(t.url)) ?? targets.find((t) => t.type === "page" && t.url.startsWith("http"));
  if (!page) throw new Error(`No navigable page target (got: ${targets.map((t) => `${t.type}:${t.url}`).join(", ") || "none"})`);
  return page;
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", () => reject(new Error("CDP websocket failed")), { once: true });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function withCdp(fn) {
  const target = await pageTarget();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  try {
    return await fn(cdp, target);
  } finally {
    cdp.close();
  }
}

async function cmdEval(expr) {
  const out = await withCdp(async (cdp) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error("Page threw: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result?.value;
  });
  console.log(JSON.stringify(out, null, 2));
}

async function cmdEvalFile(path) {
  const code = readFileSync(path, "utf8");
  const out = await withCdp(async (cdp) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `(async () => {\n${code}\n})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error("Page threw: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result?.value;
  });
  console.log(JSON.stringify(out, null, 2));
}

async function cmdShot(path, full) {
  const out = await withCdp(async (cdp, target) => {
    if (full) {
      const lm = await cdp.send("Page.getLayoutMetrics");
      const css = lm.cssContentSize ?? lm.contentSize;
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: Math.ceil(css.width),
        height: Math.ceil(css.height),
        deviceScaleFactor: 2,
        mobile: false,
      });
    }
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!full });
    return shot.data;
  });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, Buffer.from(out, "base64"));
  console.log(`wrote ${path}`);
}

async function cmdOpen(url) {
  await withCdp(async (cdp) => {
    await cdp.send("Page.navigate", { url });
  });
  console.log(`navigated to ${url}`);
}

// Live-verify the built bundle on the real authenticated page (the established loop
// from prior passes): strip the ==UserScript== metadata block, eval the rest.
async function cmdInject(path) {
  const code = readFileSync(path, "utf8");
  const idx = code.indexOf('"use strict";');
  const body = idx >= 0 ? code.slice(idx) : code;
  const out = await withCdp(async (cdp) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression: body,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error("Inject threw: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result?.value;
  });
  console.log(`injected ${path}`, out === undefined ? "" : JSON.stringify(out));
}

async function cmdLaunch(profileDir, url) {
  const chrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" +
    (process.platform === "darwin" ? "" : process.platform === "win32" ? ".exe" : "");
  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${PORT}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      url ?? "https://learningsuite.byu.edu/",
    ],
    { stdio: "ignore", detached: true },
  );
  child.unref();
  // Wait for the debugging endpoint to come up.
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/json/version`);
      console.log(`Chrome launched (pid ${child.pid}); CDP on http://127.0.0.1:${PORT}`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Chrome never opened its debugging endpoint");
}

// Real input events (synthetic .click() can't drive :hover or native menu semantics).
// Coordinates come from the target element's box center at eval time.
async function cmdHover(selector, outPath) {
  await withCdp(async (cdp) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`,
      returnByValue: true,
    });
    const pos = r.result?.value;
    if (!pos) throw new Error(`no element for selector: ${selector}`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y });
    await new Promise((res) => setTimeout(res, 350));
    if (outPath) {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outPath, Buffer.from(shot.data, "base64"));
      console.log(`wrote ${outPath}`);
    }
  });
}

async function cmdClick(selector) {
  await cmdHover(selector, null);
  await withCdp(async (cdp) => {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`,
      returnByValue: true,
    });
    const pos = r.result?.value;
 if (!pos) throw new Error(`no element for selector: ${selector}`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await new Promise((res) => setTimeout(res, 350));
  });
  console.log(`clicked ${selector}`);
}

const [, , command, ...rest] = process.argv;
switch (command) {
  case "launch":
    await cmdLaunch(rest[0] ?? join(__dirname, ".chrome-audit-profile"), rest[1]);
    break;
  case "open":
    await cmdOpen(rest[0]);
    break;
  case "inject":
    await cmdInject(rest[0] ?? join(__dirname, "../dist/learningsuite-reskin.user.js"));
    break;
  case "eval":
    await cmdEval(rest[0]);
    break;
  case "eval-file":
    await cmdEvalFile(rest[0]);
    break;
  case "shot":
    await cmdShot(rest[0], rest.includes("--full"));
    break;
  case "hover":
    await cmdHover(rest[0], rest[1]);
    break;
  case "click":
    await cmdClick(rest[0]);
    break;
  case "tabs":
    console.log(JSON.stringify(await (await fetch(`${BASE}/json/list`)).json(), null, 2));
    break;
  default:
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
