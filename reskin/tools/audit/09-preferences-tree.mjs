// Wait for the prefs popup to finish loading (up to ~8s).
let wrapper = document.querySelector(".popupWrapper");
for (let i = 0; i < 40; i++) {
  if (wrapper && !(wrapper.textContent ?? "").includes("Loading")) break;
  await new Promise((r) => setTimeout(r, 200));
  wrapper = document.querySelector(".popupWrapper");
}

const node = (el, depth) => {
  if (!el || depth > 6) return null;
  const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
  const r = el.getBoundingClientRect();
  const out = {
    tag: el.tagName,
    cls: (typeof el.className === "string" ? el.className : "") || undefined,
    ownTxt: own.replace(/\s+/g, " ").trim().slice(0, 90) || undefined,
    vis: r.width > 0 && r.height > 0,
    at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
  };
  const kids = Array.from(el.children).slice(0, 14).map((c) => node(c, depth + 1)).filter(Boolean);
  if (kids.length) out.children = kids;
  return out;
};

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

const csW = (sel) => {
  const el = wrapper?.querySelector(sel);
  if (!el) return null;
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, radius: s.borderTopLeftRadius || s.borderRadius, shadow: s.boxShadow, blur: s.backdropFilter || s.webkitBackdropFilter, font: s.fontFamily };
};

return {
  url: location.href,
  theme: document.documentElement.className.includes("dark") ? "dark" : "light",
  wrapperCls: wrapper?.className,
  wrapper: node(wrapper?.querySelector(":scope > div") ?? wrapper, 0),
  radios: radioInfo,
  sheet: csW(":scope > div > div"),
  dialog: csW(":scope [class*='dialog' i]"),
  popupTitle: wrapper?.querySelector("h1, h2, h3, [class*='title' i]")?.textContent?.trim().slice(0, 60),
};