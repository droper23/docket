import { JSDOM } from "jsdom";

/** Installs a fresh jsdom document as the global DOM for one test — call once per test. */
export function setupDom(html: string, url = "https://learningsuite.byu.edu/"): void {
  const dom = new JSDOM(html, { url });
  const w = dom.window as unknown as typeof globalThis;
  (globalThis as unknown as Record<string, unknown>)["window"] = w;
  (globalThis as unknown as Record<string, unknown>)["document"] = w.document;
  (globalThis as unknown as Record<string, unknown>)["location"] = w.location;
  (globalThis as unknown as Record<string, unknown>)["HTMLElement"] = w.HTMLElement;
  (globalThis as unknown as Record<string, unknown>)["Element"] = w.Element;
  (globalThis as unknown as Record<string, unknown>)["Node"] = w.Node;
  (globalThis as unknown as Record<string, unknown>)["MutationObserver"] = w.MutationObserver;
  // homeAdapter now fires a due-times fetch on every mount (see homeAdapter.ts's auto-trigger) —
  // give every test a safe, instant no-op default so a test that never touches due times doesn't
  // send a real request to learningsuite.byu.edu. Tests that care about the real flow still
  // install their own globalThis.fetch mock and restore it themselves.
  globalThis.fetch = (async () => ({ text: async () => "" }) as Response) as typeof fetch;
}
