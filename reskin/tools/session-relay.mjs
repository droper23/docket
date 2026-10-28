#!/usr/bin/env node
/**
 * Session relay: run on an always-on machine to keep a LearningSuite session alive while the
 * laptop that owns it is asleep. The userscript (Settings > Session Relay) posts its current
 * `PHPSESSID` + subsession here; this sends LearningSuite's own `keepAlive` request with that
 * cookie every 10 minutes — the same request the page sends itself (see src/lib/keepAlive.ts).
 *
 *   SESSION_RELAY_SECRET=<long random string> node tools/session-relay.mjs [port]
 *
 * The session is held in memory only and never logged. Anyone who can read it can act as you
 * on LearningSuite, so only reach this over a private network (Tailscale or similar); plain
 * HTTP on shared Wi-Fi exposes the cookie to anyone sniffing that network.
 */
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const PING_MS = 10 * 60 * 1000;
const ORIGIN = "https://learningsuite.byu.edu";

let secret = process.env.SESSION_RELAY_SECRET;
if (!secret) {
  secret = randomBytes(24).toString("base64url");
  console.log(`No SESSION_RELAY_SECRET set; generated one for this run:\n  ${secret}`);
}

/** @type {{ phpsessid: string, subsessionID: string, appId: string } | null} */
let session = null;
let lastPingAt = null;
let lastResult = "no session yet";

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function ping() {
  if (!session) return false;
  const { phpsessid, subsessionID, appId } = session;
  const body = new URLSearchParams({
    funcName: "keepAlive",
    funcParams: "null",
    url: "ajax/general/general.php",
    classname: "",
    contructorParams: "null",
    isPage: "false",
  });
  lastPingAt = new Date().toISOString();
  try {
    const res = await fetch(`${ORIGIN}/ajax.php?appId=${encodeURIComponent(appId)}&subsessionID=${encodeURIComponent(subsessionID)}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: `PHPSESSID=${phpsessid}`,
      },
      body,
    });
    const text = await res.text();
    let ok = false;
    try {
      const json = JSON.parse(text);
      ok = json.result === "success" && json.subsessionid === subsessionID;
    } catch {}
    lastResult = ok ? "success" : `failed (HTTP ${res.status})`;
  } catch (err) {
    lastResult = `failed (${err.message})`;
  }
  log(`keepAlive ${lastResult}`);
  return lastResult === "success";
}

setInterval(ping, PING_MS);

function authorized(req) {
  const given = Buffer.from((req.headers.authorization || "").replace(/^Bearer /, ""));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

createServer((req, res) => {
  // The userscript normally calls through GM_xmlhttpRequest (no CORS); these headers also let a
  // plain page fetch reach a relay on the same machine.
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (!authorized(req)) return send(res, 401, { error: "unauthorized" });

  if (req.method === "GET" && req.url === "/status") {
    return send(res, 200, { hasSession: !!session, lastPingAt, lastResult });
  }

  if (req.method === "POST" && req.url === "/session") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4096) req.destroy();
    });
    req.on("end", async () => {
      let next;
      try {
        next = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "bad json" });
      }
      const valid = (v) => typeof v === "string" && /^[A-Za-z0-9,_-]{1,256}$/.test(v);
      if (!valid(next.phpsessid) || !valid(next.subsessionID) || !valid(next.appId)) {
        return send(res, 400, { error: "expected phpsessid, subsessionID, appId" });
      }
      const changed = !session || session.phpsessid !== next.phpsessid || session.subsessionID !== next.subsessionID;
      session = { phpsessid: next.phpsessid, subsessionID: next.subsessionID, appId: next.appId };
      if (changed) log("received a new session");
      const ok = changed ? await ping() : lastResult === "success";
      send(res, 200, { ok, lastResult });
    });
    return;
  }

  send(res, 404, { error: "not found" });
}).listen(PORT, () => log(`session relay listening on :${PORT}`));
