// Grade Summary DOM census: does it really render main p.cursor-pointer rows?
const ps = [...document.querySelectorAll("main p.cursor-pointer")];
return {
  url: location.pathname,
  pCursorCount: ps.length,
  pSamples: ps.slice(0, 6).map((p) => ({
    text: (p.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    cls: p.className.slice(0, 120),
    parentCls: p.parentElement?.className?.slice(0, 120) ?? null,
  })),
  activeTab: document.querySelector(".bg-top-nav-highlight")?.textContent?.trim() ?? null,
  topTabs: [...document.querySelectorAll(".bg-top-nav a")].map((a) => (a.textContent || "").trim()),
  cidInUrl: /cid-/.test(location.pathname),
  mainTables: document.querySelectorAll("main table").length,
};
