/**
 * In-memory only, reset on every page load — never persisted, never
 * transmitted. Deliberately holds counts/status, never assignment titles or
 * any LearningSuite-sourced text (spec §43: diagnostics must not leak
 * sensitive academic content).
 */
export interface DiagnosticsState {
  pageKind: string;
  shellMounted: boolean;
  activeAdapterId?: string;
  adapterError?: string;
  transformCount: number;
}

export const diagnostics: DiagnosticsState = {
  pageKind: "unknown",
  shellMounted: false,
  transformCount: 0,
};

/**
 * Called at the start of every `runAdapters()` pass — including ones
 * triggered by a debounced DOM mutation, not just the initial page load.
 * `shellMounted` is deliberately NOT reset here: `mountShell()` only runs
 * once at boot (src/index.ts), so resetting it on every later pass made the
 * Diagnostics panel wrongly report "Navigation shell: Not applied" after
 * the very first mutation-triggered re-run, even though the nav restyle
 * was still actually in effect — a real bug caught by injecting this
 * script into a live, authenticated LearningSuite session and watching the
 * reported state diverge from the actual DOM.
 */
export function resetDiagnostics(): void {
  diagnostics.pageKind = "unknown";
  diagnostics.activeAdapterId = undefined;
  diagnostics.adapterError = undefined;
  diagnostics.transformCount = 0;
}
