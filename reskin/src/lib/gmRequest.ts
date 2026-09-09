/**
 * Cross-origin GET, for "External Calendars" (Settings) only — everything else this reskin
 * does reads the current page's own DOM. `GM_xmlhttpRequest` is the userscript-manager grant
 * that lets a script fetch a URL outside its own `@match` origin without hitting the target's
 * CORS policy (confirmed live: max.byu.edu's iCalendar feed sends no
 * `Access-Control-Allow-Origin`, so a plain page `fetch()` from learningsuite.byu.edu would be
 * blocked). Declared in build.mjs's `@grant`/`@connect`. Fails soft — reject, never throw — so
 * a manager that didn't grant it (or a feed URL outside `@connect`) just means that one feed's
 * items don't load, same "broken adapter never destroys the page" rule as everywhere else.
 */
declare const GM_xmlhttpRequest:
  | ((details: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      timeout?: number;
      onload: (response: { status: number; responseText: string }) => void;
      onerror: (error: unknown) => void;
      ontimeout: () => void;
    }) => void)
  | undefined;

export function gmFetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== "function") {
      reject(new Error("GM_xmlhttpRequest not granted by this userscript manager"));
      return;
    }
    try {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { Accept: "text/calendar" },
        timeout: 15000,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) resolve(response.responseText);
          else reject(new Error(`HTTP ${response.status}`));
        },
        onerror: () => reject(new Error("network error")),
        ontimeout: () => reject(new Error("timed out")),
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
