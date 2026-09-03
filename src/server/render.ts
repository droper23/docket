import type { AcademicSnapshot } from "../core/types.js";
import type { AgendaItem, CourseWorkload } from "../core/academicViews.js";
import type { DiagnosticsReport } from "../core/diagnostics.js";
import type { ChangeLogEntry } from "../core/types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const NAV = [
  ["/", "Today"],
  ["/upcoming", "Upcoming"],
  ["/courses", "Courses"],
  ["/changes", "What Changed"],
  ["/diagnostics", "Diagnostics"],
] as const;

function layout(activePath: string, title: string, body: string): string {
  const navHtml = NAV.map(
    ([href, label]) =>
      `<a class="nav-link${href === activePath ? " active" : ""}" href="${href}">${label}</a>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Docket — ${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f5f2; color: #1c1b19; }
  @media (prefers-color-scheme: dark) { body { background: #171614; color: #ece9e3; } }
  header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid rgba(120,110,90,0.25); }
  .brand { font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
  .brand small { font-weight: 400; opacity: 0.6; font-size: 12px; display: block; }
  nav { display: flex; gap: 4px; }
  .nav-link { padding: 6px 12px; border-radius: 8px; text-decoration: none; color: inherit; font-size: 13px; opacity: 0.7; }
  .nav-link.active { background: rgba(120,110,90,0.15); opacity: 1; font-weight: 600; }
  main { max-width: 760px; margin: 0 auto; padding: 28px 20px 80px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { opacity: 0.6; font-size: 13px; margin: 0 0 24px; }
  .section-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.55; margin: 28px 0 10px; }
  .card { background: rgba(120,110,90,0.08); border: 1px solid rgba(120,110,90,0.16); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .card-title { font-weight: 600; font-size: 14.5px; margin: 0 0 2px; }
  .card-meta { font-size: 12.5px; opacity: 0.65; display: flex; gap: 10px; flex-wrap: wrap; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 999px; font-weight: 600; }
  .badge-urgent { background: #f4d7d3; color: #8a2f23; }
  @media (prefers-color-scheme: dark) { .badge-urgent { background: #4a2620; color: #f4b6ab; } }
  .badge-estimate { background: rgba(120,110,90,0.18); }
  .empty { opacity: 0.55; font-size: 14px; padding: 20px 0; }
  .workload-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
  .workload-course { width: 110px; flex-shrink: 0; font-weight: 600; }
  .workload-bar-track { flex: 1; height: 10px; background: rgba(120,110,90,0.15); border-radius: 6px; overflow: hidden; }
  .workload-bar-fill { height: 100%; background: #8a6d3b; border-radius: 6px; }
  .diag-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(120,110,90,0.14); font-size: 14px; }
  .diag-ok::before { content: "✓ "; color: #2f8a4f; }
  .diag-warn::before { content: "⚠ "; color: #b8801a; }
  .provenance-note { font-size: 11px; opacity: 0.5; margin-top: 24px; }
  form.sync-form { margin-bottom: 20px; }
  button { font: inherit; padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(120,110,90,0.35); background: rgba(120,110,90,0.1); cursor: pointer; }
</style>
</head>
<body>
<header>
  <div class="brand">Docket <small>a productivity layer for LearningSuite</small></div>
  <nav>${navHtml}</nav>
</header>
<main>
${body}
</main>
</body>
</html>`;
}

function agendaCard(item: AgendaItem, urgent: boolean): string {
  const due = item.assignment.dueDate?.value ?? "no due date";
  const time = item.assignment.dueTime?.value;
  return `<div class="card">
  <div class="card-title">${esc(item.assignment.title.value)}</div>
  <div class="card-meta">
    <span>${esc(item.course?.code.value ?? item.assignment.courseId)}</span>
    <span>Due ${esc(due)}${time ? " " + esc(time) : ""}</span>
    <span class="badge badge-estimate">~${item.estimatedMinutes} min (estimate)</span>
    ${urgent ? '<span class="badge badge-urgent">Due soon</span>' : ""}
  </div>
</div>`;
}

export function renderToday(items: AgendaItem[]): string {
  const list = items.length
    ? items.map((i) => agendaCard(i, (i.daysUntilDue ?? 99) <= 1)).join("")
    : `<div class="empty">Nothing urgent. Nice.</div>`;
  return layout(
    "/",
    "Today",
    `<h1>Today</h1>
<p class="subtitle">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
<form class="sync-form" method="post" action="/sync"><button type="submit">Sync now</button></form>
<div class="section-label">Needs attention</div>
${list}
<p class="provenance-note">Due dates and titles: real, from LearningSuite. Time estimates: derived, Docket's guess — not fact.</p>`,
  );
}

export function renderUpcoming(items: AgendaItem[]): string {
  const list = items.length
    ? items.map((i) => agendaCard(i, false)).join("")
    : `<div class="empty">Nothing in the next two weeks.</div>`;
  return layout("/upcoming", "Upcoming", `<h1>Upcoming</h1><p class="subtitle">Next 14 days</p>${list}`);
}

export function renderCourses(snapshot: AcademicSnapshot, workload: CourseWorkload[]): string {
  const workloadRows = workload.length
    ? (() => {
        const max = Math.max(...workload.map((w) => w.estimatedMinutes), 1);
        return workload
          .map(
            (w) => `<div class="workload-row">
  <div class="workload-course">${esc(w.course.code.value)}</div>
  <div class="workload-bar-track"><div class="workload-bar-fill" style="width:${Math.round((w.estimatedMinutes / max) * 100)}%"></div></div>
  <div>${w.itemCount} item${w.itemCount === 1 ? "" : "s"}, ~${Math.round(w.estimatedMinutes / 60)}h</div>
</div>`,
          )
          .join("")
      })()
    : `<div class="empty">No workload this week.</div>`;

  const courseCards = snapshot.courses
    .map(
      (c) => `<div class="card">
  <div class="card-title">${esc(c.code.value)} — ${esc(c.title.value)}</div>
  <div class="card-meta"><span>${esc(c.instructor?.value ?? "")}</span><span>${esc(c.term?.value ?? "")}</span></div>
</div>`,
    )
    .join("");

  return layout(
    "/courses",
    "Courses",
    `<h1>Courses</h1>
<div class="section-label">Estimated workload — this week</div>
${workloadRows}
<div class="section-label">Enrolled</div>
${courseCards || `<div class="empty">No courses yet. Run a sync, or add your real courses in data/courses.config.json.</div>`}`,
  );
}

export function renderChanges(entries: ChangeLogEntry[]): string {
  const list = entries.length
    ? entries
        .map(
          (e) => `<div class="card">
  <div class="card-title">${esc(e.detail)}</div>
  <div class="card-meta"><span>${esc(e.kind.replace(/_/g, " "))}</span><span>${new Date(e.occurredAt).toLocaleString()}</span></div>
</div>`,
        )
        .join("")
    : `<div class="empty">Nothing changed in the last 24 hours.</div>`;
  return layout("/changes", "What Changed", `<h1>What Changed</h1><p class="subtitle">Since yesterday</p>${list}`);
}

export function renderDiagnostics(report: DiagnosticsReport): string {
  const row = (label: string, value: string, ok: boolean) =>
    `<div class="diag-row"><span class="${ok ? "diag-ok" : "diag-warn"}">${esc(label)}</span><span>${esc(value)}</span></div>`;

  return layout(
    "/diagnostics",
    "Diagnostics",
    `<h1>Diagnostics</h1>
<p class="subtitle">${esc(report.message)}</p>
${row("Connection", report.connectionHealthy ? "Healthy" : "Needs attention", report.connectionHealthy)}
${row("Last sync attempt", report.lastSyncAttemptAt ? new Date(report.lastSyncAttemptAt).toLocaleString() : "never", !!report.lastSyncAttemptAt)}
${row("Last successful sync", report.lastSyncSuccessAt ? new Date(report.lastSyncSuccessAt).toLocaleString() : "never", !!report.lastSyncSuccessAt)}
${row("Courses", `${report.courseCount}`, report.courseCount > 0)}
${row("Active assignments", `${report.activeAssignmentCount}`, true)}
${row("Archived (no longer reported)", `${report.archivedAssignmentCount}`, true)}
${row("Changes in last 24h", `${report.recentChangeCount}`, true)}
<form class="sync-form" method="post" action="/sync" style="margin-top:20px"><button type="submit">Sync now</button></form>
<form method="post" action="/reset" onsubmit="return confirm('Delete all local Docket data? This does not touch your actual LearningSuite account.');"><button type="submit">Delete all Docket data</button></form>`,
  );
}
