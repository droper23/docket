// Reproduce observe.ts's exact pattern in isolation, live in the page.
// Claim under test: records for writes made inside callback() are delivered
// in a microtask AFTER run()'s finally cleared `applying`, so the
// `if (applying) return;` guard in the observer callback never suppresses
// self-triggered records.
const results = { callbackRuns: 0, selfTriggeredRun: false };
const target = document.createElement("div");
document.body.appendChild(target);
let applying = false;
let timer;
const run = () => {
  timer = undefined;
  if (applying) return;
  applying = true;
  try {
    results.callbackRuns++;
    if (results.callbackRuns === 1) {
      // Our own DOM write, same as an adapter's replaceChildren.
      target.appendChild(document.createElement("span"));
    }
  } finally {
    applying = false;
  }
};
const observer = new MutationObserver(() => {
  if (applying) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(run, 150);
});
observer.observe(target, { childList: true, subtree: true });
target.appendChild(document.createElement("b")); // external trigger
await new Promise((r) => setTimeout(r, 500));
results.selfTriggeredRun = results.callbackRuns > 1;
observer.disconnect();
target.remove();
return results;
