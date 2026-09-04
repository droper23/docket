await new Promise((r) => setTimeout(r, 900));

const ul = document.querySelector(".header-userdropdown-dropdown > ul");
const r = ul?.getBoundingClientRect();
const cs = (el) => (el ? getComputedStyle(el) : null);
const accPanel = ul && { rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`, bg: cs(ul).backgroundColor, radius: cs(ul).borderTopLeftRadius, shadow: cs(ul).boxShadow, transform: cs(ul).transform };

// Dump every declared rule mentioning the dropdown components or bg-accent.
const findRules = (needle) => {
  const hits = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if ((rule.selectorText ?? "").includes(needle)) {
        const style = rule.style;
        hits.push({
          sel: rule.selectorText,
          color: style.color,
          bg: style.backgroundColor,
          radius: style.borderRadius || style.borderTopLeftRadius,
          shadow: style.boxShadow,
          border: style.border,
          font: style.fontFamily,
          fontWeight: style.fontWeight,
        });
      }
    }
  }
  return hits;
};

// Custom color properties used by chrome classes.
const trig = document.querySelector(".header-coursedropdown-trigger");
const cstrig = getComputedStyle(trig);
const props = ["--ti", "--tip", "--t1", "--tg1", "--t2", "--ta", "--accent"];
const propVals = {};
for (const p of props) propVals[p] = cstrig.getPropertyValue(p).trim() || undefined;
// Where do these --ti/--tip get defined? find rules setting them.
const varRules = [];
for (const sheet of document.styleSheets) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    continue;
  }
  for (const rule of rules) {
    const s = rule.style;
    if (s && (s.getPropertyValue("--ti") || s.getPropertyValue("--tip"))) {
      varRules.push({ sel: rule.selectorText, ti: s.getPropertyValue("--ti").trim(), tip: s.getPropertyValue("--tip").trim() });
    }
  }
}

return {
  url: location.href,
  accPanel,
  coursedropdownRules: findRules("coursedropdown").slice(0, 30),
  userdropdownRules: findRules("userdropdown").slice(0, 30),
  bgAccentRules: findRules("bg-accent").filter((x) => x.sel.includes("bg-accent")).slice(0, 10),
  textGray1Rule: findRules("text-gray1").slice(0, 5),
  propVals,
  varDefs: varRules,
};