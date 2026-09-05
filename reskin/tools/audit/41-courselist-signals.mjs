// Disambiguation signals for looksLikeCourseListPage (#5): what real DOM signal
// separates the true Course List from Grade Summary, which also carries cid- anchors?
return {
  url: location.href.replace(/https:\/\/learningsuite\.byu\.edu\//, "").slice(0, 60),
  h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
  activeTab: document.querySelector(".bg-top-nav-highlight")?.textContent?.trim() ?? null,
  hasTopTabs: !!document.querySelector(".bg-top-nav-highlight"),
  cidAnchors: [...document.querySelectorAll("main a[href*='cid-']")]
    .slice(0, 8)
    .map((a) => ({ cls: a.className.toString().slice(0, 60), href: (a.getAttribute("href") || "").slice(0, 50), txt: a.textContent.trim().slice(0, 30), inDocketGrid: !!a.closest("[class*='docket-']") })),
  pCursorRows: [...document.querySelectorAll("main p.cursor-pointer")].slice(0, 4).map((p) => ({ cls: p.className, txt: p.textContent.trim().slice(0, 30) })),
  navLinks: [...document.querySelectorAll("nav a, .nav a")].length,
};
