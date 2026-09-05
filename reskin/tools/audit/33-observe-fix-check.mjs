// Same harness as 32, with the candidate fix: discard records queued by our
// own writes inside run()'s finally, and ignore empty-record deliveries.
const results = { callbackRuns: 0, selfTriggeredRun: false, emptyDeliveries: 0 };
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
      target.appendChild(document.createElement("span"));
    }
  } finally {
    applying = false;
    observer.takeRecords(); // discard self-triggered records before their microtask runs
  }
};
const observer = new MutationObserver((mutations) => {
  if (mutations.length === 0) { results.emptyDeliveries++; return; }
  if (applying) return;
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(run, 150);
});
observer.observe(target, { childList: true, subtree: true });
target.appendChild(document.createElement("b")); // external trigger
await new Promise((r) => setTimeout(r, 500));
// second external trigger to prove external mutations still get through after the fix
target.appendChild(document.createElement("i"));
await new Promise((r) => setTimeout(r, 500));
results.selfTriggeredRun = results.callbackRuns > 2;
results.externalStillWorks = results.callbackRuns === 2;
observer.disconnect();
target.remove();
return results;
