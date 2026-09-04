const groups = {};
let total = 0;
for (const el of document.querySelectorAll(".font-metro")) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) continue;
  total++;
  const cls = el.className.toString();
  groups[cls] = (groups[cls] ?? 0) + 1;
}
return {
  url: location.href,
  totalVisible: total,
  groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([cls, n]) => ({ n, cls: cls.slice(0, 160) })),
};