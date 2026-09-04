// Confirm every .bg-primary-dark element on this page is an action-style button
// (i.e. safe to remap onto the Apple-blue pill alongside .bg-action/.goBtn), and
// that none of them are passive triggers/menus.
const hits = Array.from(document.querySelectorAll(".bg-primary-dark")).map((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    type: el.getAttribute("type"),
    cls: el.className.toString().slice(0, 110),
    txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
    at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    color: s.color,
    font: s.fontFamily.split(",")[0],
    // A button that opens something (menu/dialog) usually has aria-expanded/haspopup;
    // none of these should.
    ariaExp: el.getAttribute("aria-expanded"),
    ariaPop: el.getAttribute("aria-haspopup"),
  };
});
return { count: hits.length, hits };
