/**
 * Debounced MutationObserver wrapper for LearningSuite's Vue-rendered
 * widgets (accordions, the schedule's list view) that change DOM after the
 * initial page load without a full navigation — see learningsuite-handoff.md
 * §1.1. `applying` prevents the classic feedback loop where an adapter's own
 * DOM writes (inserting cards, marking nodes processed) re-trigger the same
 * observer; `debounceMs` collapses a burst of unrelated mutations (e.g. an
 * accordion opening several rows at once) into one re-run.
 */
export function observeMutations(
  target: Node,
  callback: () => void,
  options: MutationObserverInit = { childList: true, subtree: true },
  debounceMs = 150,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let applying = false;

  const run = () => {
    timer = undefined;
    if (applying) return;
    applying = true;
    try {
      callback();
    } finally {
      applying = false;
    }
  };

  const observer = new MutationObserver(() => {
    if (applying) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
  });
  observer.observe(target, options);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    observer.disconnect();
  };
}
