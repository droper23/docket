// Dump the Schedule page's view switcher + dropdown menu + one week block in
// full structural detail, to design a DOM-traceable restyle (issue #6).
const pick = (el, depth) => {
  if (!el || depth < 0) return null;
  return {
    tag: el.tagName,
    cls: (el.className || "").toString(),
    txt: el.children.length === 0 ? el.textContent.trim().slice(0, 50) : undefined,
    kids: [...el.children].slice(0, 8).map((c) => pick(c, depth - 1)),
  };
};
// 1. The view switcher trigger (confirmed: .innerBox.border.px-2)
const trigger = document.querySelector("main .innerBox");
const triggerCtx = trigger ? pick(trigger.parentElement.parentElement, 3) : null;
// 2. The dropdown menu (confirmed: .bg-base.border-gray3.rounded)
const menu = document.querySelector("main .bg-base.border-gray3");
const menuCtx = menu ? pick(menu.parentElement, 2) : null;
// 3. One week block: header row + its following content rows
const weekHeader = [...document.querySelectorAll("main .bg-gray1.px-4.py-2")][1];
let weekBlock = null;
if (weekHeader) {
  const parent = weekHeader.parentElement;
  weekBlock = {
    parentCls: parent.className,
    parentKidCount: parent.children.length,
    kids: [...parent.children].slice(0, 6).map((k) => ({
      cls: (k.className || "").toString().slice(0, 90),
      txt: k.textContent.trim().slice(0, 60),
      rect: { w: Math.round(k.getBoundingClientRect().width), h: Math.round(k.getBoundingClientRect().height) },
      border: getComputedStyle(k).border,
    })),
  };
}
// 4. The Table-view grid header ("Date Column 1 Column 2") + one data row
const gridHeader = [...document.querySelectorAll("main .bg-accent")].find((e) => e.textContent.includes("Column 1"));
let gridRows = null;
if (gridHeader) {
  const rows = [...gridHeader.parentElement.children].slice(0, 4);
  gridRows = rows.map((r) => ({
    cls: (r.className || "").toString().slice(0, 90),
    txt: r.textContent.trim().slice(0, 70),
    bg: getComputedStyle(r).backgroundColor,
  }));
}
// 5. Is .innerBox present anywhere else on this page?
const innerBoxCount = document.querySelectorAll(".innerBox").length;
return { triggerCtx, menuCtx, weekBlock, gridRows, innerBoxCount };
