// Computed-style census on the course-scoped Schedule page with the reskin active:
// which global.css selectors land here, and on what elements?
const census = {};
const probe = (name, sel) => {
  const els = [...document.querySelectorAll(sel)];
  if (!els.length) { census[name] = 0; return; }
  census[name] = els.length;
  census[name + "__sample"] = els.slice(0, 3).map((e) => {
    const cs = getComputedStyle(e);
    return {
      tag: e.tagName,
      cls: String(e.className).slice(0, 70),
      text: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      bg: cs.backgroundColor,
      color: cs.color,
      font: cs.fontFamily.slice(0, 40),
      radius: cs.borderRadius,
    };
  });
};
probe("bgPrimary", ".bg-primary");
probe("bgAccent", ".bg-accent");
probe("bgGray1", ".bg-gray1");
probe("textPrimary", ".text-primary");
probe("clicky", ".clicky");
probe("borderBare", "main .border");
probe("h1", "main h1");
probe("h2", "main h2");
probe("h3", "main h3");
probe("tables", "main table");
probe("goBtn", ".goBtn");
probe("bgAction", ".bg-action");
probe("fontMetro", ".font-metro");
probe("bgBaseTextHighlight", ".bg-base.text-highlight");
return census;
