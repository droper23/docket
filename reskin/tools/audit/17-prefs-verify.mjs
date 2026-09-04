// Open the Preferences dialog via the account menu and measure the styled chrome.
const trig = document.querySelector("button.header-userdropdown-trigger");
if (!trig) return { error: "no account trigger" };
if (document.querySelector(".header-userdropdown-dropdown")?.className.includes("invisible")) {
  trig.click();
  await new Promise((r) => setTimeout(r, 400));
}
const links = Array.from(document.querySelectorAll(".header-userdropdown-dropdown a"));
const prefs = links.find((a) => (a.textContent ?? "").includes("Preferences"));
if (!prefs) return { error: "no prefs link", links: links.map((a) => (a.textContent ?? "").trim()) };
prefs.click();
// Wait for the wrapper to appear and content to load.
let wrapper = null;
for (let i = 0; i < 50; i++) {
  wrapper = document.querySelector(".popupWrapper");
  if (wrapper && !(wrapper.textContent ?? "").includes("Loading")) break;
  await new Promise((r) => setTimeout(r, 200));
}
const cs = (el) => {
  if (!el) return null;
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow === "none" ? "none" : s.boxShadow.slice(0, 60), blur: s.backdropFilter || s.webkitBackdropFilter || "none" };
};
const sheet = wrapper?.querySelector(".minMax");
const save = wrapper?.querySelector("button.bg-primary-dark");
const general = wrapper?.querySelector("div.bg-primary-dark");
return {
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  wrapperCls: wrapper?.className?.slice(0, 80),
  scrim: cs(wrapper),
  sheet: cs(sheet),
  save: cs(save),
  general: general ? { bg: getComputedStyle(general).backgroundColor, color: getComputedStyle(general).color } : null,
};
