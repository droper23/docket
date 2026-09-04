// Close any open dropdowns first.
for (const trig of document.querySelectorAll("button.header-coursedropdown-trigger, button.header-userdropdown-trigger")) {
  const panel = trig.closest(".header-coursedropdown, .header-userdropdown")?.querySelector("[class*='-dropdown']");
  // Only click if it looks open (no 'invisible').
  if (panel && !panel.className.includes("invisible")) trig.click();
}
await new Promise((r) => setTimeout(r, 200));

const apple = ["-apple-system", "SF Pro", "Helvetica Neue", "Arial", "sans-serif"];
const first = (el) => (getComputedStyle(el).fontFamily.split(",")[0] ?? "").replace(/["']/g, "").trim();

// 1) True first-family census on visible, non-empty elements.
const byFamily = {};
for (const el of document.querySelectorAll("body *")) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || !(el.textContent ?? "").trim()) continue;
  const f = first(el);
  byFamily[f] = (byFamily[f] ?? 0) + 1;
}

// 2) All visible elements carrying the font-metro class: their own computed first family
//    (does the class actually win over inheritance?) and their class list.
const metroSamples = [];
let metroNonApple = 0;
for (const el of document.querySelectorAll(".font-metro")) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) continue;
  const f = first(el);
  if (!apple.includes(f)) metroNonApple++;
  if (metroSamples.length < 12) metroSamples.push({ cls: el.className.toString().slice(0, 100), tag: el.tagName, family: f, txt: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) });
}

// 3) What does LearningSuite's stylesheet declare for .font-metro and generic font-* rules?
const fontRules = [];
for (const sheet of document.styleSheets) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    continue;
  }
  for (const rule of rules) {
    if ((rule.selectorText ?? "").includes("font-metro")) {
      fontRules.push({ sel: rule.selectorText, font: rule.style.fontFamily, weight: rule.style.fontWeight });
    }
  }
}

return {
  url: location.href,
  bodyFamily: first(document.body),
  families: Object.entries(byFamily).sort((a, b) => b[1] - a[1]),
  metroVisibleCount: document.querySelectorAll(".font-metro").length,
  metroNonAppleRendering: metroNonApple,
  metroSamples,
  fontMetroRules: fontRules,
};