/**
 * Hands this tab's LearningSuite session to an always-on relay (tools/session-relay.mjs), which
 * keeps it alive with LearningSuite's own `keepAlive` request while this machine sleeps — the
 * in-page pinger in keepAlive.ts can't run then, and a 2-hour sleep otherwise outlives the
 * session.
 *
 * The session is `PHPSESSID` (not HttpOnly, so readable here) plus the subsession and app id
 * from the URL (`/.UW6g/student/...`). Re-sent every 10 minutes and whenever the tab comes back,
 * so the relay always holds the session the laptop is actually using. Off unless the user has
 * entered a relay URL in Settings.
 */
import { loadSettings } from "../core/settings.js";
import { gmPostJson } from "./gmRequest.js";

const SEND_MS = 10 * 60 * 1000;

function currentSession(): { phpsessid: string; subsessionID: string; appId: string } | null {
  const phpsessid = document.cookie
    .split("; ")
    .find((c) => c.startsWith("PHPSESSID="))
    ?.slice("PHPSESSID=".length);
  const match = location.pathname.match(/^\/\.([^/]+)\/([^/]+)\//);
  if (!phpsessid || !match) return null;
  return { phpsessid, subsessionID: match[1]!, appId: match[2]! };
}

export function startSessionRelay(): void {
  const send = (): void => {
    const { url, secret } = loadSettings().sessionRelay;
    const session = currentSession();
    if (!url || !secret || !session) return;
    gmPostJson(`${url}/session`, session, { Authorization: `Bearer ${secret}` }).catch((error) =>
      console.warn("[docket] session relay unreachable", error),
    );
  };
  send();
  setInterval(send, SEND_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") send();
  });
}
