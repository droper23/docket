/**
 * Keeps the LearningSuite session alive while a tab is open, and recovers it silently after
 * the laptop sleeps, so the "This page has been inactive for over 2 hours" dialog never
 * appears.
 *
 * Confirmed live (Oct 2026): LearningSuite's server session is a sliding 2-hour window
 * (`global_sessionMaxLifetime = 7200`). The page's own `core/timeout` module shows the warning
 * once `global_sessionTimeoutTime` passes, by calling
 * `require("core/loadScript").loadDriverBuild(".../timeoutWarning/drivervue-build.js", cb)`.
 * The warning dialog's "renew" path calls `core/ajax`'s
 * `ajaxCallback(appID, "ajax/general/general.php", ..., "keepAlive")`, which returns
 * `{"result":"success","subsessionid":...}`. Every `core/ajax` call also resets the page's
 * warning deadline itself, so one keepAlive extends both the server session and the client timer.
 *
 * Nothing runs while the machine sleeps, so a sleep longer than 2 hours always outlives the
 * server session. On wake (or when the warning would have shown) this pings once; if the
 * session is gone it reloads, which goes back through BYU CAS and lands signed in again
 * without a prompt as long as the CAS single sign-on session is still valid. It never
 * reloads over unsaved form edits; then LearningSuite's own warning is shown instead.
 *
 * `require`, `global_appID` and the AMD modules live in the page's JS world, which the
 * userscript sandbox (`@grant GM_*`) can't reach directly, so this runs as an injected page
 * script. LearningSuite sends no CSP, so the inline script is allowed.
 */
const PAGE_SCRIPT = `(() => {
  if (window.__docketKeepAlive) return;
  window.__docketKeepAlive = true;
  const PING_MS = 10 * 60 * 1000;
  const TICK_MS = 30 * 1000;
  const RELOAD_GUARD_KEY = "docket-keepalive-reloaded-at";
  let lastPing = Date.now();
  let lastTick = Date.now();

  const ready = () => typeof window.require === "function" && typeof window.global_appID !== "undefined";

  const ping = (onDone) => {
    if (!ready()) return;
    lastPing = Date.now();
    window.require(["core/ajax"], (ajax) => {
      ajax.ajaxCallback(window.global_appID, "ajax/general/general.php", "", null, false, "keepAlive", null,
        (body) => {
          let ok = false;
          try {
            const res = JSON.parse(body);
            ok = res.result === "success" && (!window.global_subsessionID || res.subsessionid === window.global_subsessionID);
          } catch (e) {}
          if (onDone) onDone(ok);
        },
        () => { if (onDone) onDone(false); });
    });
  };

  const hasUnsavedEdits = () => {
    const editors = window.CKEDITOR && window.CKEDITOR.instances;
    if (editors && Object.values(editors).some((ed) => ed.checkDirty && ed.checkDirty())) return true;
    return [...document.querySelectorAll("textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])")]
      .some((el) => el.value !== el.defaultValue);
  };

  // Session expired: reload through CAS, unless that would lose typed work or we just tried.
  const recover = (fallback) => {
    let lastReload = 0;
    try { lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0; } catch (e) {}
    if (hasUnsavedEdits() || Date.now() - lastReload < 60 * 1000) {
      if (fallback) fallback();
      return;
    }
    try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch (e) {}
    location.reload();
  };

  const check = (fallback) => ping((ok) => { if (!ok) recover(fallback); });

  setInterval(() => {
    const now = Date.now();
    // A tick that arrives minutes late means the machine was asleep.
    const woke = now - lastTick > 5 * 60 * 1000;
    lastTick = now;
    if (woke || now - lastPing >= PING_MS) check();
  }, TICK_MS);

  const catchUp = () => { if (Date.now() - lastPing > 60 * 1000) check(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") catchUp(); });
  window.addEventListener("focus", catchUp);
  window.addEventListener("online", catchUp);

  // Intercept LearningSuite's own warning dialog: renew (or recover) instead of showing it,
  // and only fall through to the real dialog when recovering would discard unsaved edits.
  const patch = () => {
    if (!ready()) return;
    window.require(["core/loadScript"], (loader) => {
      const original = loader.loadDriverBuild;
      if (typeof original !== "function" || original.__docket) return;
      const patched = function (path, cb) {
        if (typeof path === "string" && path.includes("timeoutWarning")) {
          const args = arguments;
          check(() => original.apply(this, args));
          return;
        }
        return original.apply(this, arguments);
      };
      patched.__docket = true;
      loader.loadDriverBuild = patched;
    });
  };
  patch();
})();`;

export function startSessionKeepAlive(): void {
  const script = document.createElement("script");
  script.textContent = PAGE_SCRIPT;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}
