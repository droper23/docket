const q = (s, root = document) => Array.from(root.querySelectorAll(s));
const apple = ["-apple-system", "SF Pro", "Helvetica Neue", "Arial"];

// Which [class*="font-"] utilities exist and how many elements carry each (visible only).
const fontCounts = {};
for (const el of q("[class*='font-']")) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) continue;
  for (const c of el.className.split(/\s+/)) {
    if (c.startsWith("font-")) fontCounts[c] = (fontCounts[c] ?? 0) + 1;
  }
}

// Visible elements rendering in a non-Apple font, grouped by family, with a sample element's
// class list (not its text — diagnostics hygiene: never surface content).
const nonApple = {};
for (const el of q("body *")) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) continue;
  if (!(el.textContent ?? "").trim()) continue;
  const ff = getComputedStyle(el).fontFamily;
  if (apple.some((a) => ff.includes(a))) continue;
  const key = ff.split(",")[0];
  if (!nonApple[key]) nonApple[key] = { count: 0, sampleCls: [] };
  nonApple[key].count++;
  if (nonApple[key].sampleCls.length < 3) nonApple[key].sampleCls.push(el.className.toString().slice(0, 120));
}

// Color-utility classes present on this page (the classes global.css may need to consider).
const colorUtils = {};
for (const el of q("[class*='text-'], [class*='bg-'], [class*='border-']")) {
  for (const c of el.className.split(/\s+/)) {
    if (/^(text|bg|border)-/.test(c)) colorUtils[c] = (colorUtils[c] ?? 0) + 1;
  }
}
const topUtils = Object.entries(colorUtils).sort((a, b) => b[1] - a[1]).slice(0, 60);

return {
  url: location.href,
  theme: document.documentElement.className.includes("dark") ? "dark" : "light",
  fontCounts,
  nonAppleFonts: Object.fromEntries(Object.entries(nonApple).map(([k, v]) => [k, { count: v.count, sampleCls: v.sampleCls }])),
  topColorUtils: topUtils,
};
