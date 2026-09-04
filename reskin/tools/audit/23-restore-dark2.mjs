// Reopen prefs if needed, expand General, set dark, Save.
let wrapper = document.querySelector(".popupWrapper");
if (!wrapper) {
  const trig = document.querySelector("button.header-userdropdown-trigger");
  trig?.click();
  await new Promise((r) => setTimeout(r, 400));
  const links = Array.from(document.querySelectorAll(".header-userdropdown-dropdown a"));
  links.find((a) => (a.textContent ?? "").includes("Preferences"))?.click();
  for (let i = 0; i < 50; i++) {
    wrapper = document.querySelector(".popupWrapper");
    if (wrapper && !(wrapper.textContent ?? "").includes("Loading")) break;
    await new Promise((r) => setTimeout(r, 200));
  }
}
let radios = Array.from(wrapper.querySelectorAll("input[type='radio']"));
if (radios.length === 0) {
  const general = Array.from(wrapper.querySelectorAll("div.bg-gray1")).find((el) => /^General$/.test((el.textContent ?? "").trim()));
  general?.click();
  await new Promise((r) => setTimeout(r, 600));
  radios = Array.from(wrapper.querySelectorAll("input[type='radio']"));
}
const dark = radios.find((r) => r.value === "dark");
if (!dark) return { error: "no dark radio", radioVals: radios.map((r) => r.value) };
dark.click();
await new Promise((r) => setTimeout(r, 300));
const save = Array.from(wrapper.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === "Save");
save?.click();
await new Promise((r) => setTimeout(r, 900));
if (document.querySelector(".popupWrapper")) {
  const cancel = Array.from(document.querySelectorAll(".popupWrapper button")).find((b) => (b.textContent ?? "").trim() === "Cancel");
  cancel?.click();
  await new Promise((r) => setTimeout(r, 500));
}
return {
  themeNow: document.documentElement.classList.contains("dark") ? "dark" : "light",
  prefsStillOpen: !!document.querySelector(".popupWrapper"),
};
