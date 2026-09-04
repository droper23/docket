// Restore LearningSuite's real theme to dark (courtesy to the user), then close prefs.
const wrapper = document.querySelector(".popupWrapper");
if (!wrapper) return { error: "prefs not open" };
const dark = Array.from(wrapper.querySelectorAll("input[type='radio']")).find((r) => r.value === "dark");
dark?.click();
await new Promise((r) => setTimeout(r, 300));
const save = Array.from(wrapper.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === "Save");
save?.click();
await new Promise((r) => setTimeout(r, 900));
const stillOpen = !!document.querySelector(".popupWrapper");
if (stillOpen) {
  const cancel = Array.from(document.querySelectorAll(".popupWrapper button")).find((b) => (b.textContent ?? "").trim() === "Cancel");
  cancel?.click();
  await new Promise((r) => setTimeout(r, 500));
}
return {
  themeNow: document.documentElement.classList.contains("dark") ? "dark" : "light",
  prefsStillOpen: !!document.querySelector(".popupWrapper"),
};
