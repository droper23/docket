const trig = document.querySelector("button.header-userdropdown-trigger");
if (!trig) return { error: "no user trigger" };
trig.click();
await new Promise((r) => setTimeout(r, 500));

const prefsLink = document.querySelector(".header-userdropdown-dropdown a");
// Preferences is the 2nd row (Messages, Preferences, Help, Logout).
const links = Array.from(document.querySelectorAll(".header-userdropdown-dropdown a"));
const prefs = links.find((a) => (a.textContent ?? "").includes("Preferences")) ?? links[1];
if (!prefs) return { error: "no preferences link", links: links.map((a) => (a.textContent ?? "").trim()) };
prefs.click();
await new Promise((r) => setTimeout(r, 1200));

const modals = Array.from(document.querySelectorAll("body *"))
  .filter((el) => /modal|dialog|popup|overlay|preference/i.test(el.className ?? "") && el.children.length < 30 && (el.textContent ?? "").length < 6000)
  .slice(0, 15);
const modalInfo = modals.map((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    cls: el.className.toString().slice(0, 120),
    txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    pos: s.position,
    z: s.zIndex,
  };
});
return {
  url: location.href,
  modalCount: modals.length,
  modalInfo,
  openWindows: window.length, // number of child windows (0 unless a popup opened)
  bodyChildren: Array.from(document.body.children).map((c) => c.tagName + (c.className ? "." + c.className.toString().slice(0, 40) : "")).slice(0, 10),
};