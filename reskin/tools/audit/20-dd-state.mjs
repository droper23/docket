// Report open/closed state of both header dropdowns.
const dd = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return "absent";
  return el.className.includes("invisible") ? "closed" : "open";
};
return {
  user: dd(".header-userdropdown-dropdown"),
  course: dd(".header-coursedropdown-dropdown"),
  prefs: !!document.querySelector(".popupWrapper"),
};
