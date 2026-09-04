const t = document.querySelector("button.header-coursedropdown-trigger");
if (!t) return { error: "no coursedropdown trigger" };
t.click();
await new Promise((r) => setTimeout(r, 600));

const panel = document.querySelector(".header-coursedropdown-dropdown");
const ul = panel?.querySelector(":scope > ul");
const cs = (el) => {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    cls: el.className,
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    color: s.color,
    borderColor: s.borderTopColor,
    radius: s.borderTopLeftRadius,
    shadow: s.boxShadow,
    backdrop: s.backdropFilter || s.webkitBackdropFilter,
    font: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    zIndex: s.zIndex,
  };
};
const rows = Array.from(ul?.querySelectorAll("li") ?? []).map((li) => ({
  cls: li.className,
  txt: (li.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
  a: cs(li.querySelector("a") ?? li.children[0]),
}));

return {
  url: location.href,
  trigger: cs(t),
  containerCls: panel?.className,
  panel: cs(ul),
  liCount: ul?.children.length,
  rows: rows.slice(0, 12),
};
