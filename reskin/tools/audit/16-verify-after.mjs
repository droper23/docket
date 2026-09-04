// Verify: is the reskin on, and do the styled surfaces compute as intended?
const cs = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow === "none" ? "none" : s.boxShadow.slice(0, 60), blur: s.backdropFilter || s.webkitBackdropFilter || "none" };
};
// Open the account dropdown for measurement.
const trig = document.querySelector("button.header-userdropdown-trigger");
const wasOpen = !document.querySelector(".header-userdropdown-dropdown")?.className.includes("invisible");
if (trig && !wasOpen) { trig.click(); await new Promise((r) => setTimeout(r, 400)); }
const reskin = {
  attr: document.documentElement.getAttribute("data-docket-reskin"),
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
};
const prefsOpen = !!document.querySelector(".popupWrapper");
return {
  reskin,
  prefsOpen,
  accountUl: cs(".header-userdropdown-dropdown > ul"),
  accountHoverRow: (() => {
    const li = document.querySelector(".header-userdropdown-dropdown li.hover\\:bg-accent");
    if (!li) return null;
    li.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return getComputedStyle(li).backgroundColor;
  })(),
  saveBtn: cs(".popupWrapper button.bg-primary-dark"),
  sheet: cs(".popupWrapper .minMax"),
  scrim: cs(".popupWrapper"),
  generalHeader: (() => {
    const el = document.querySelector(".popupWrapper div.bg-primary-dark");
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, radius: s.borderRadius };
  })(),
};
