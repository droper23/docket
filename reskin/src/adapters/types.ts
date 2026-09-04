/**
 * One adapter per LearningSuite page type. `mount()` may throw — the
 * registry catches it, calls `unmount()`, and leaves LearningSuite's native
 * UI exactly as it was (spec §27: a broken adapter must never destroy the
 * page). `matches()` must be cheap and side-effect-free; it's called on
 * every full page load and every debounced mutation pass.
 */
export interface Adapter {
  readonly id: string;
  matches(): boolean;
  mount(compatibilityMode: boolean): void;
  unmount(): void;
}
