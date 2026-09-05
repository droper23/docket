// Early-DOM census right after navigating to Grade Summary: does a transient
// loading state ever present main p.cursor-pointer rows (courseList detector shape)?
const samples = [];
for (let i = 0; i < 10; i++) {
  samples.push({
    t: i * 250,
    readyState: document.readyState,
    pCursor: document.querySelectorAll("main p.cursor-pointer").length,
    cidAnchors: document.querySelectorAll("main a[href*='cid-']").length,
    clicky: document.querySelectorAll("main .clicky").length,
    bodyCls: document.body.className.slice(0, 80),
  });
  await new Promise((r) => setTimeout(r, 250));
}
return samples;
