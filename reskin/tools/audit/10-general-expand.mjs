const wrapper = document.querySelector(".popupWrapper");
const generalRow = Array.from(wrapper?.querySelectorAll("div[class*='cursor-pointer']") ?? []).find((el) => /^General$/.test((el.textContent ?? "").trim()));
if (!generalRow) return { error: "no General row" };

// The row is likely a click-to-expand accordion header.
generalRow.click();
await new Promise((r) => setTimeout(r, 700));

const radios = Array.from(wrapper?.querySelectorAll("input[type='radio']") ?? []);
const radioInfo = radios.map((r) => {
  const label = r.closest("label") ?? r.parentElement;
  return {
    name: r.name,
    value: r.value,
    checked: r.checked,
    label: (label?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    cls: r.className,
  };
});

// Any text mentioning display/theme now visible?
const displayText = Array.from(wrapper?.querySelectorAll("*") ?? [])
  .filter((el) => /display|theme|light|dark|detect|classic/i.test(el.textContent ?? "") && (el.textContent ?? "").length < 60 && el.children.length === 0)
  .map((el) => el.textContent.trim())
  .slice(0, 10);

// Find whatever the theme control actually is (radios, segmented buttons, select...).
const themeControls = Array.from(wrapper?.querySelectorAll("input, select, button, [role='radio'], [role='switch']") ?? [])
  .filter((el) => {
    const label = el.closest("label") ?? el.parentElement;
    const t = (label?.textContent ?? "") + " " + (el.textContent ?? "") + " " + el.className;
    return /light|dark|detect|display|theme|classic/i.test(t);
  })
  .slice(0, 12)
  .map((el) => ({
    tag: el.tagName,
    cls: el.className.toString().slice(0, 80),
    type: el.getAttribute("type"),
    checked: el.checked,
    text: (el.textContent ?? "").trim().slice(0, 40),
  }));

return {
  theme: document.documentElement.className.includes("dark") ? "dark" : "light",
  radios: radioInfo,
  displayText,
  themeControls,
};