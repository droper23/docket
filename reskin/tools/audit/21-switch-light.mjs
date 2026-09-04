// Open Preferences, expand General, switch LearningSuite's real theme to light, Save.
const trig = document.querySelector("button.header-userdropdown-trigger");
if (document.querySelector(".header-userdropdown-dropdown")?.className.includes("invisible") ?? true) {
  trig?.click();
  await new Promise((r) => setTimeout(r, 400));
}
const links = Array.from(document.querySelectorAll(".header-userdropdown-dropdown a"));
const prefs = links.find((a) => (a.textContent ?? "").includes("Preferences"));
if (!prefs) return { error: "no prefs link" };
prefs.click();
let wrapper = null;
for (let i = 0; i < 50; i++) {
  wrapper = document.querySelector(".popupWrapper");
  if (wrapper && !(wrapper.textContent ?? "").includes("Loading")) break;
  await new Promise((r) => setTimeout(r, 200));
}
// Expand the General accordion (collapsed headers are div.text-primary.bg-gray1).
const general = Array.from(wrapper?.querySelectorAll("div.bg-gray1") ?? []).find((el) => /^General$/.test((el.textContent ?? "").trim()));
general?.click();
await new Promise((r) => setTimeout(r, 600));
const radios = Array.from(wrapper?.querySelectorAll("input[type='radio']") ?? []);
const light = radios.find((r) => r.value === "light");
if (!light) return { error: "no light radio", radios: radios.map((r) => r.value) };
light.click();
await new Promise((r) => setTimeout(r, 300));
const save = Array.from(wrapper?.querySelectorAll("button") ?? []).find((b) => (b.textContent ?? "").trim() === "Save");
save?.click();
await new Promise((r) => setTimeout(r, 900));
return {
  themeNow: document.documentElement.classList.contains("dark") ? "dark" : "light",
  prefsStillOpen: !!document.querySelector(".popupWrapper"),
};
