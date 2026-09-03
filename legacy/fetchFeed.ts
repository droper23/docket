/**
 * Fetches a LearningSuite ICS feed. Confirmed live (2026-09-02) that this
 * endpoint requires no authentication at all — no cookies, no session — so
 * this is a plain, unattended-safe HTTP GET. See learningsuite-handoff.md §1.4.
 */

export interface FetchResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const RETRY_DELAYS_MS = [500, 1500, 4000];

export async function fetchIcsFeed(url: string): Promise<FetchResult> {
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/calendar" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status} ${res.statusText}`;
      } else {
        const text = await res.text();
        if (!text.startsWith("BEGIN:VCALENDAR")) {
          lastError = "response was not a valid ICS payload (missing BEGIN:VCALENDAR)";
        } else {
          return { ok: true, text };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { ok: false, error: lastError };
}
