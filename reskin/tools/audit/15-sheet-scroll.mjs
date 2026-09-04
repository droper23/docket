// Scroll the Preferences sheet's inner content to enumerate ALL section headers,
// confirming whether every accordion header shares the div.bg-primary-dark pattern.
const sheet = document.querySelector(".popupWrapper .minMax");
if (!sheet) return { error: "no sheet open" };
// Find the scrollable descendant(s).
const scrollers = Array.from(sheet.querySelectorAll("*")).filter((el) => {
  const s = getComputedStyle(el);
  return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 40;
});
const found = [];
for (const sc of scrollers) {
  for (let y = 0; y <= sc.scrollHeight; y += sc.clientHeight * 0.8) {
    sc.scrollTop = y;
    await new Promise((r) => setTimeout(r, 150));
    const headers = Array.from(sheet.querySelectorAll("div.bg-primary-dark")).map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
    );
    for (const h of headers) if (!found.includes(h)) found.push(h);
  }
  sc.scrollTop = 0;
}
return { scrollerCount: scrollers.length, scrollerCls: scrollers.map((s) => s.className.toString().slice(0, 80)), allSectionHeaders: found };
