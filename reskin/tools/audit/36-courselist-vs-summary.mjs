// Census usable on either Course List or Grade Summary: what shapes exist here?
const anchors = [...document.querySelectorAll("main a[href*='cid-']")];
const ps = [...document.querySelectorAll("main p.cursor-pointer")];
const clicky = [...document.querySelectorAll("main .clicky")];
// What kind of element wraps each cid anchor / p row? Grab 3 ancestor classes each.
const anc = (el) => {
  const out = [];
  let n = el;
  for (let i = 0; i < 4 && n && n !== document.body; i++) {
    n = n.parentElement;
    if (n) out.push(String(n.className).slice(0, 70));
  }
  return out;
};
return {
  url: location.pathname,
  cidAnchors: anchors.length,
  anchorTexts: anchors.map((a) => (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)),
  pCursorRows: ps.length,
  pTexts: ps.map((p) => (p.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)),
  clickyTiles: clicky.length,
  clickySample: clicky.slice(0, 3).map((e) => ({ cls: String(e.className).slice(0, 50), text: (e.textContent || "").trim().slice(0, 12) })),
  anchorAncestors: anchors.slice(0, 2).map(anc),
  pAncestors: ps.slice(0, 2).map(anc),
  mainH1: [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => (h.textContent || "").trim().slice(0, 40)),
};
