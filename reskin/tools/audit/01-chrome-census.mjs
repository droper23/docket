const q = (s, root = document) => Array.from(root.querySelectorAll(s));
const sum = (el, depth = 0) => {
  if (!el || depth > 3) return null;
  const txt = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    id: el.id || undefined,
    cls: typeof el.className === "string" ? el.className : el.className?.baseVal ?? "",
    txt: txt.slice(0, 140),
    txtLen: txt.length,
    kids: el.children.length,
    visible: r.width > 0 && r.height > 0,
    fixed: getComputedStyle(el).position === "fixed" || getComputedStyle(el).position === "absolute",
    at: `(${Math.round(r.left)},${Math.round(r.top)}) ${Math.round(r.width)}x${Math.round(r.height)}`,
  };
};

// Where the reskin already knows chrome lives, plus anything topmost that looks structural.
const chrome = q("header, .bg-top-nav, .bg-header, [class*='top-nav'], [class*='app-bar'], [role='banner']")
  .filter((el) => el.children.length > 0 || (el.textContent ?? "").trim().length > 0)
  .slice(0, 25)
  .map((el) => sum(el));

// Term/account switchers: LearningSuite renders these as clickable text; find by content.
const triggers = q("div, button, span, a, p")
  .filter((el) => {
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
    const t = el.textContent ?? "";
    return /fall|winter|spring|summer|term|course/i.test(own) && /▾|⌄|▸|chevron|arrow/i.test(t + (el.className ?? "")) || (/fall|winter|spring|summer/i.test(own) && el.children.length <= 3 && t.length < 160);
  })
  .slice(0, 15)
  .map((el) => sum(el, 1));

const accountish = q("[class*='avatar' i], [class*='user' i], [class*='account' i], [class*='profile' i], [class*='name' i], [class*='person' i]")
  .slice(0, 15)
  .map((el) => sum(el, 1));

// Popup-shaped elements currently in the DOM (dropdowns often render only when opened).
const popupish = q("body *")
  .filter((el) => /dropdown|popover|popup|menu|dialog|panel|select|modal|listbox/i.test(el.className ?? "") && (el.textContent ?? "").length < 4000 && el.children.length < 60)
  .slice(0, 25)
  .map((el) => sum(el, 1));

// Fonts census: which [class*="font-"] utilities exist and how many elements carry each.
const fontCounts = {};
for (const el of q("[class*='font-']")) {
  for (const c of el.className.split(/\s+/)) {
    if (c.includes("font-")) fontCounts[c] = (fontCounts[c] ?? 0) + 1;
  }
}

// Elements whose computed font-family is NOT the reskin's Apple stack (a proxy for "still in a non-Apple font").
const apple = ["-apple-system", "SF Pro", "Helvetica Neue", "Arial"];
const nonApple = {};
for (const el of q("body *")) {
  const ff = getComputedStyle(el).fontFamily;
  if (apple.some((a) => ff.includes(a))) continue;
  const key = ff.split(",")[0];
  if (!nonApple[key]) nonApple[key] = { count: 0, sample: "" };
  nonApple[key].count++;
  if (!nonApple[key].sample) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (el.textContent ?? "").trim()) nonApple[key].sample = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  }
}

return {
  url: location.href,
  htmlClass: document.documentElement.className,
  chrome,
  triggers,
  accountish,
  popupish,
  fontCounts,
  nonAppleFonts: nonApple,
};
