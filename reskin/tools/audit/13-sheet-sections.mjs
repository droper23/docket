// Enumerate every section-header-ish row inside the open Preferences sheet,
// so a scoped .popupWrapper .bg-primary-dark rule can't half-style the dialog.
const sheet = document.querySelector(".popupWrapper .minMax");
if (!sheet) return { error: "no sheet open" };
const rows = Array.from(sheet.querySelectorAll("div[class*='cursor-pointer'], [role='button'], h1, h2, h3, h4")).map((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    cls: el.className.toString().slice(0, 110),
    txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50),
    at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    radius: s.borderRadius,
  };
});
// And all bg-primary-dark hits inside the sheet specifically.
const primaries = Array.from(sheet.querySelectorAll(".bg-primary-dark")).map((el) => ({
  tag: el.tagName,
  cls: el.className.toString().slice(0, 110),
  txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50),
}));
return { sectionRows: rows, bgPrimaryDarkInSheet: primaries };
