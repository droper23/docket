// Cross-page census: do Schedule-specific class compounds appear elsewhere?
// Determines whether compound-scoped CSS is safe or a page-level scope is needed.
const counts = {
  weekHeader: document.querySelectorAll("main .bg-gray1.px-4.py-2").length,
  innerBox: document.querySelectorAll("main .innerBox").length,
  outerBox: document.querySelectorAll("main .outerBox").length,
  gridBox: document.querySelectorAll("main .bg-base.p-1.pt-4").length,
  gridHeader: document.querySelectorAll("main .bg-accent.text-highlight").length,
  bgBaseAny: document.querySelectorAll("main .bg-base").length,
  docketUi: document.querySelectorAll("[class*='docket-']").length,
};
return { url: location.href.replace(/https:\/\/learningsuite\.byu\.edu\//, ""), h1: document.querySelector("h1")?.textContent?.trim().slice(0, 30), counts };
