// Close prefs (Cancel) and identify the course-switcher trigger element.
const cancel = Array.from(document.querySelectorAll(".popupWrapper button")).find((b) => (b.textContent ?? "").trim() === "Cancel");
cancel?.click();
await new Promise((r) => setTimeout(r, 400));
const closed = !document.querySelector(".popupWrapper");
// Course dropdown trigger: find the element that toggles the coursedropdown container.
const cd = document.querySelector(".header-coursedropdown-dropdown");
let trigger = null;
if (cd) {
  const sibs = [cd.previousElementSibling, cd.parentElement?.querySelector("button"), cd.parentElement?.querySelector("[class*='trigger']")];
  trigger = sibs.filter(Boolean).map((el) => ({ tag: el.tagName, cls: el.className.toString().slice(0, 90), txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) }));
  // Also check parent chain for a click handler target with 'trigger' in class.
  let p = cd.parentElement;
  const chain = [];
  while (p && chain.length < 4) { chain.push(p.tagName + "." + p.className.toString().slice(0, 60)); p = p.parentElement; }
  return { closed, trigger, chain };
}
return { closed, trigger: "no coursedropdown container on this page" };
