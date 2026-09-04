/**
 * Settings persistence. Tries the userscript manager's GM_getValue/GM_setValue
 * grants first (isolated per-script storage, the better home for this), and
 * falls back to a namespaced key in the page's own localStorage — still
 * purely on-device, never transmitted anywhere (spec: no backend, nothing
 * leaves the device). GM_* availability/sync-vs-async behavior varies by
 * userscript manager version, so every call is wrapped defensively; this has
 * not yet been verified against a real install of the Userscripts app — see
 * reskin/README.md's install notes.
 */

declare const GM_getValue: ((key: string, defaultValue?: unknown) => unknown) | undefined;
declare const GM_setValue: ((key: string, value: unknown) => void) | undefined;

const PREFIX = "docket-reskin:";

export function getSetting<T>(key: string, defaultValue: T): T {
  try {
    if (typeof GM_getValue === "function") {
      const v = GM_getValue(key, undefined);
      // A Promise here would mean this GM implementation is async-only — this call site is
      // synchronous by design (settings are read during page mount, before there's a DOM to
      // await against), so an async GM_getValue is treated as "unavailable" and we fall
      // through to localStorage rather than returning a pending Promise as if it were a value.
      if (v !== undefined && !(v instanceof Promise)) return v as T;
    }
  } catch {
    // GM API not granted in this context — fall through to localStorage.
  }
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Ignore — worst case, settings just don't persist this run.
  }
  return defaultValue;
}

export function setSetting<T>(key: string, value: T): void {
  try {
    if (typeof GM_setValue === "function") {
      GM_setValue(key, value);
      return;
    }
  } catch {
    // fall through
  }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore — worst case, settings just don't persist this run.
  }
}
