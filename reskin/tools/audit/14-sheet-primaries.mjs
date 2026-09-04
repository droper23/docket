const sheet = document.querySelector(".popupWrapper .minMax");
if (!sheet) return { error: "no sheet open" };
const prim = Array.from(sheet.querySelectorAll(".bg-primary-dark")).map((el) => ({
  tag: el.tagName,
  cls: el.className.toString().slice(0, 110),
  txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50),
}));
// All cursor-pointer rows that are NOT timezone options (no text-primary class).
const headers = Array.from(sheet.querySelectorAll("div[class*='cursor-pointer']"))
  .filter((el) => !el.className.includes("text-primary"))
  .map((el) => ({ cls: el.className.toString().slice(0, 100), txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) }));
return { bgPrimaryDarkInSheet: prim, sectionHeaders: headers };
