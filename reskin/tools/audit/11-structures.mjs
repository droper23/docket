// Exact class inventory for the three surfaces about to be styled.
const dump = (el) => {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    cls: typeof el.className === "string" ? el.className : "",
    at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    radius: s.borderRadius,
    shadow: s.boxShadow === "none" ? "none" : s.boxShadow.slice(0, 80),
    backdrop: s.backdropFilter || s.webkitBackdropFilter || "none",
  };
};

// 1. popupWrapper uniqueness + full ancestry of the sheet
const wrappers = Array.from(document.querySelectorAll(".popupWrapper"));
const wrapper = wrappers[0];
const sheet = wrapper?.querySelector(".minMax");
const sheetAncestry = [];
let n = sheet;
while (n && n !== document.body) { sheetAncestry.push(dump(n)); n = n.parentElement; }

// 2. Header dropdown panels: container, inner ul, rows
const courseDd = document.querySelector(".header-coursedropdown-dropdown");
const userDd = document.querySelector(".header-userdropdown-dropdown");
const panelRows = (panel) => Array.from(panel?.querySelectorAll("li, a") ?? []).slice(0, 8).map((row) => {
  const s = getComputedStyle(row);
  return { tag: row.tagName, cls: row.className.toString().slice(0, 140), txt: (row.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40), color: s.color, bg: s.backgroundColor };
});
const courseUl = courseDd?.querySelector("ul");
const userUl = userDd?.querySelector("ul");

// 3. What does the reskin currently see (is our bundle injected?)
const reskin = !!document.querySelector("ls-reskin, [data-ls-reskin]") || !!window.__lsReskin;

return {
  url: location.href,
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  popupWrapperCount: wrappers.length,
  wrapper: dump(wrapper),
  sheetAncestry,
  coursePanel: { container: dump(courseDd), ul: dump(courseUl), rows: panelRows(courseDd) },
  userPanel: { container: dump(userDd), ul: dump(userUl), rows: panelRows(userDd) },
  reskinInjected: reskin,
};
