const node = (el, depth) => {
  if (!el || depth > 7) return null;
  const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
  const r = el.getBoundingClientRect();
  const out = {
    tag: el.tagName,
    cls: (typeof el.className === "string" ? el.className : "") || undefined,
    ownTxt: own.replace(/\s+/g, " ").trim().slice(0, 80) || undefined,
    vis: r.width > 0 && r.height > 0,
    at: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
  };
  const kids = Array.from(el.children).slice(0, 12).map((c) => node(c, depth + 1)).filter(Boolean);
  if (kids.length) out.children = kids;
  return out;
};

const header = document.querySelector("header");
return {
  url: location.href,
  theme: document.documentElement.className,
  header: node(header, 0),
};
