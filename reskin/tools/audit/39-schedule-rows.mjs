// Deep-dive: week content rows + grid data rows, to design the Schedule restyle.
const weekContent = [...document.querySelectorAll("main .bg-gray1.px-4.py-2")].map((h) => h.nextElementSibling).filter(Boolean)[1];
const contentTree = weekContent
  ? [...weekContent.children].slice(0, 3).map((day) => ({
      cls: (day.className || "").toString().slice(0, 80),
      rect: { w: Math.round(day.getBoundingClientRect().width), h: Math.round(day.getBoundingClientRect().height) },
      bg: getComputedStyle(day).backgroundColor,
      kids: [...day.children].slice(0, 3).map((c) => ({
        cls: (c.className || "").toString().slice(0, 80),
        txt: c.textContent.trim().slice(0, 50),
        bg: getComputedStyle(c).backgroundColor,
        kids: [...c.children].slice(0, 4).map((g) => ({
          cls: (g.className || "").toString().slice(0, 60),
          txt: g.textContent.trim().slice(0, 40),
        })),
      })),
    }))
  : null;
// Grid (Table view) data rows: rows following the .grid.bg-accent header
const gridHeader = [...document.querySelectorAll("main .bg-accent")].find((e) => e.textContent.includes("Column 1"));
let gridDataRows = null;
if (gridHeader) {
  const gridWrap = gridHeader.parentElement;
  gridDataRows = {
    wrapCls: gridWrap.className,
    rows: [...gridWrap.children].slice(2, 5).map((r) => ({
      cls: (r.className || "").toString().slice(0, 90),
      txt: r.textContent.trim().slice(0, 60),
      bg: getComputedStyle(r).backgroundColor,
      borderBottom: getComputedStyle(r).borderBottom,
      kids: [...r.children].slice(0, 4).map((c) => ({ cls: (c.className || "").toString().slice(0, 60), txt: c.textContent.trim().slice(0, 30) })),
    })),
  };
}
return { contentTree, gridDataRows };
