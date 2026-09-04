// Close the course dropdown if open (click its trigger toggles), then open the account one.
const courseTrig = document.querySelector("button.header-coursedropdown-trigger");
const coursePanel = document.querySelector(".header-coursedropdown-dropdown");
if (coursePanel && !coursePanel.className.includes("invisible")) courseTrig?.click();
await new Promise((r) => setTimeout(r, 300));

const trig = document.querySelector("button.header-userdropdown-trigger");
if (!trig) return { error: "no userdropdown trigger" };
trig.click();
await new Promise((r) => setTimeout(r, 500));

const panel = document.querySelector(".header-userdropdown-dropdown");
const ul = panel?.querySelector(":scope > ul");
const cs = (el) => {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    cls: el.className,
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    bg: s.backgroundColor,
    color: s.color,
    radius: s.borderTopLeftRadius,
    shadow: s.boxShadow,
    backdrop: s.backdropFilter || s.webkitBackdropFilter,
    font: s.fontFamily,
  };
};

// Resolve LearningSuite's own declared rule for hover rows + anchor colors from its stylesheets.
const findRule = (needle) => {
  const hits = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.selectorText && rule.selectorText.includes(needle)) {
        hits.push({ sel: rule.selectorText, color: rule.style.color, bg: rule.style.backgroundColor });
      }
    }
  }
  return hits;
};

const rows = Array.from(ul?.querySelectorAll("li") ?? []).map((li) => ({
  cls: li.className,
  txt: (li.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
  li: cs(li),
  a: cs(li.querySelector("a")),
}));

return {
  url: location.href,
  triggerCls: trig.className,
  containerCls: panel?.className,
  panel: cs(ul),
  rows,
  hoverBgAccentRule: findRule("hover:bg-accent").slice(0, 5),
  aColorRules: findRule("a").filter((r) => r.color).slice(0, 5),
  textTopNavIconRule: findRule("text-top-nav-icon").slice(0, 5),
};
