import type { AcademicSnapshot } from "../core/types.js";
import type { AgendaItem, CourseWorkload } from "../core/academicViews.js";
import type { DiagnosticsReport } from "../core/diagnostics.js";
import type { ChangeLogEntry } from "../core/types.js";
import { daysBetween, todayInSchoolTimeZone } from "../core/schoolTime.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const NAV = [
  ["/", "Today"],
  ["/upcoming", "Upcoming"],
  ["/courses", "Courses"],
  ["/changes", "What Changed"],
  ["/diagnostics", "Diagnostics"],
  ["/connect", "Connect"],
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#171614">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Docket">
<title>Docket — ${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f5f2; color: #1c1b19; }
  @media (prefers-color-scheme: dark) { body { background: #171614; color: #ece9e3; } }
  header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 24px; padding-top: max(14px, env(safe-area-inset-top)); border-bottom: 1px solid rgba(120,110,90,0.25); flex-wrap: wrap; }
  .brand { font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
  .brand small { font-weight: 400; opacity: 0.6; font-size: 12px; display: block; }
  nav { display: flex; gap: 4px; flex-wrap: wrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .nav-link { padding: 7px 12px; border-radius: 8px; text-decoration: none; color: inherit; font-size: 13px; opacity: 0.7; white-space: nowrap; }
  .nav-link.active { background: rgba(120,110,90,0.15); opacity: 1; font-weight: 600; }
  main { max-width: 760px; margin: 0 auto; padding: 28px 20px calc(80px + env(safe-area-inset-bottom)); }
  @media (max-width: 480px) {
    header { padding: 12px 16px; }
    main { padding: 20px 14px 60px; }
    h1 { font-size: 20px; }
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { opacity: 0.6; font-size: 13px; margin: 0 0 24px; }
  .section-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.55; margin: 28px 0 10px; }
  .day-group { margin: 18px 0 8px; }
  .day-group:first-of-type { margin-top: 4px; }
  .day-header {
    font-size: 13px; font-weight: 700; padding: 9px 14px; background: rgba(120,110,90,0.14);
    border-radius: 8px; cursor: pointer; list-style: none; position: relative;
    display: flex; align-items: center; gap: 8px; -webkit-tap-highlight-color: transparent;
  }
  .day-header::-webkit-details-marker { display: none; }
  .day-header::marker { content: ""; }
  .day-header::after { content: "›"; position: absolute; right: 12px; top: 50%; transform: translateY(-50%) rotate(90deg); font-size: 18px; opacity: 0.45; transition: transform 0.15s ease; }
  .day-group:not([open]) .day-header::after { transform: translateY(-50%) rotate(0deg); }
  .day-header:hover { background: rgba(120,110,90,0.2); }
  .day-count { opacity: 0.55; font-weight: 600; font-size: 11.5px; }
  .day-items { padding-top: 8px; }
  .card { background: rgba(120,110,90,0.08); border: 1px solid rgba(120,110,90,0.16); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; overflow: hidden; }
  /* Cancels the parent .card's own padding so this fills the full tile — then re-applies
     matching padding on .card-summary/.card-body below. Only affects cards that opt into
     the expandable structure (agendaCard); every other plain .card usage elsewhere on the
     site is untouched, since they have no .card-expand child to trigger this rule. */
  .card-expand { margin: -14px -16px; }
  .card-summary { cursor: pointer; list-style: none; position: relative; padding: 14px 40px 14px 16px; }
  .card-summary::-webkit-details-marker { display: none; }
  .card-summary::marker { content: ""; }
  .card-summary::after { content: "›"; position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 20px; opacity: 0.4; transition: transform 0.15s ease; }
  .card-expand[open] .card-summary::after { transform: translateY(-50%) rotate(90deg); }
  .card-summary:hover { background: rgba(120,110,90,0.07); }
  .card-summary:focus-visible { outline: 2px solid #8a6d3b; outline-offset: -2px; }
  .card-title { font-weight: 600; font-size: 14.5px; margin: 0 0 2px; }
  .card-meta { font-size: 12.5px; opacity: 0.65; display: flex; gap: 10px; flex-wrap: wrap; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 999px; font-weight: 600; }
  .badge-urgent { background: #f4d7d3; color: #8a2f23; }
  @media (prefers-color-scheme: dark) { .badge-urgent { background: #4a2620; color: #f4b6ab; } }
  .badge-estimate { background: rgba(120,110,90,0.18); }
  .badge-category { background: #d9e6d0; color: #33511f; }
  @media (prefers-color-scheme: dark) { .badge-category { background: #2b3a20; color: #c3dcae; } }
  .card-body { padding: 0 16px 14px; font-size: 12.5px; border-top: 1px solid rgba(120,110,90,0.14); padding-top: 10px; }
  .card-description { opacity: 0.85; line-height: 1.5; margin: 0 0 10px; white-space: pre-wrap; }
  .card-hint { opacity: 0.55; line-height: 1.5; margin: 0; font-style: italic; }
  .link-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .link-chip { display: inline-block; font-size: 11.5px; padding: 4px 9px; border-radius: 8px; background: rgba(120,110,90,0.12); border: 1px solid rgba(120,110,90,0.25); text-decoration: none; }
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
  .connect-body { font-size: 13.5px; line-height: 1.5; opacity: 0.85; max-width: 60ch; }
  .bookmarklet-btn { display: inline-block; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 10px; background: #8a6d3b; color: #fff; text-decoration: none; cursor: grab; }
  a { color: inherit; }
  main a:not(.bookmarklet-btn):not(.nav-link) { color: #8a6d3b; }
  @media (prefers-color-scheme: dark) { main a:not(.bookmarklet-btn):not(.nav-link) { color: #d8b878; } }
  .tabs { display: flex; gap: 6px; margin: 20px 0 4px; border-bottom: 1px solid rgba(120,110,90,0.2); }
  .tab-btn { background: none; border: none; border-bottom: 2px solid transparent; border-radius: 0; padding: 8px 4px; margin-right: 16px; font-size: 14px; font-weight: 600; opacity: 0.55; cursor: pointer; }
  .tab-btn.active { opacity: 1; border-bottom-color: #8a6d3b; }
  .setup-steps { font-size: 13.5px; line-height: 1.6; opacity: 0.9; padding-left: 20px; max-width: 60ch; }
  .setup-steps li { margin-bottom: 4px; }
  .script-box { margin: 10px 0 4px; }
  .script-source { width: 100%; max-width: 60ch; height: 70px; font-family: ui-monospace, monospace; font-size: 10.5px; padding: 8px; border-radius: 8px; border: 1px solid rgba(120,110,90,0.3); background: rgba(120,110,90,0.06); color: inherit; resize: vertical; box-sizing: border-box; }
  .copy-btn { display: block; margin: 6px 0 2px; font-weight: 600; }
  .script-fallback { font-size: 11px; opacity: 0.5; margin: 2px 0 0; }
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

/** "Due in 3 days" / "Due today" / "Overdue by 2 days" — the countdown itself, not just a due-date string, is what makes it obvious what needs doing now vs. later. */
function dueCountdown(daysUntilDue: number | undefined): string | undefined {
  if (daysUntilDue === undefined) return undefined;
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

/** "Today" / "Tomorrow" / "Wednesday, September 3" — mirrors LearningSuite's own Combined Schedule day headers. */
function dayLabel(dateStr: string): string {
  // daysBetween anchors "today" to BYU's own timezone (src/core/schoolTime.ts), not the
  // server's — this is the same class of bug that made most assignments show up as "due
  // today," now fixed in one shared place both the countdown and this label go through.
  const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  // UTC here is deliberate, not a shortcut: dateStr is a bare calendar date with no
  // time-of-day, so parsing/formatting it consistently in one fixed zone (rather than
  // whichever zone the server happens to be running in) is what keeps "September 4"
  // from ever silently becoming "September 3" or "September 5" depending on server TZ.
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Groups already-sorted agenda items by due date so the page can show day
 * headers — see docs/ARCHITECTURE.md §8: LearningSuite's own Combined
 * Schedule (the closest thing it has to a "Today" view) always groups by
 * day, and a flat list made it hard to tell "due today" apart from "due
 * later" at a glance. Items are assumed pre-sorted chronologically
 * (academicViews.ts already does this) — this only groups, never re-sorts.
 */
function groupByDueDate(items: AgendaItem[]): { date: string; items: AgendaItem[] }[] {
  const groups: { date: string; items: AgendaItem[] }[] = [];
  for (const item of items) {
    const date = item.assignment.dueDate?.value ?? "unknown";
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.items.push(item);
    } else {
      groups.push({ date, items: [item] });
    }
  }
  return groups;
}

function agendaCard(item: AgendaItem, urgent: boolean): string {
  const a = item.assignment;
  const due = a.dueDate?.value ?? "no due date";
  const time = a.dueTime?.value;
  const countdown = dueCountdown(item.daysUntilDue);
  // Prefer the real, course-specific category (from the Assignments page) over the
  // generic derived type guess — see docs/ARCHITECTURE.md §12.
  const categoryLabel = a.category?.value ?? a.type?.value;
  const categoryReal = !!a.category?.value;

  const linkChips = (a.links?.value ?? [])
    .map((l) => `<a class="link-chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.text || "Link")} ↗</a>`)
    .join("");
  const description = a.description?.value;
  // The whole tile is the click target — the title/meta live inside <summary> itself,
  // not a separate "Details" link, so this behaves like clicking an assignment in
  // LearningSuite rather than requiring you to find a small secondary link. Every card
  // expands, even with nothing captured yet: silently showing nothing when a click does
  // nothing reads as broken, not as "no data" — see docs/ARCHITECTURE.md §8 for how this
  // detail gets captured (a one-click bookmarklet, run per course) and why most
  // assignments won't have it until that's been run for their course.
  const body =
    description || linkChips
      ? `${description ? `<p class="card-description">${esc(description)}</p>` : ""}${linkChips ? `<div class="link-chips">${linkChips}</div>` : ""}`
      : `<p class="card-hint">No extra detail synced yet for this item. On <a href="/connect">Connect</a>, run "Sync Grades &amp; Due Times" on ${esc(item.course?.code.value ?? a.courseId)}'s Assignments page to pull in its real description and links.</p>`;

  return `<div class="card">
  <details class="card-expand">
    <summary class="card-summary">
      <div class="card-title">${esc(a.title.value)}</div>
      <div class="card-meta">
        <span>${esc(item.course?.code.value ?? a.courseId)}</span>
        <span>Due ${esc(due)}${time ? " " + esc(time) : ""}</span>
        ${categoryLabel ? `<span class="badge ${categoryReal ? "badge-category" : "badge-estimate"}">${esc(categoryLabel)}</span>` : ""}
        <span class="badge badge-estimate">~${item.estimatedMinutes} min (estimate)</span>
        ${countdown ? `<span class="badge ${urgent ? "badge-urgent" : "badge-estimate"}">${esc(countdown)}</span>` : ""}
      </div>
    </summary>
    <div class="card-body">${body}</div>
  </details>
</div>`;
}

/** Renders items grouped into day sections with headers, matching LearningSuite's own Combined Schedule layout. */
function renderDayGroups(items: AgendaItem[]): string {
  return groupByDueDate(items)
    .map(
      (group) => `<details class="day-group" open>
  <summary class="day-header">${esc(dayLabel(group.date))} <span class="day-count">${group.items.length}</span></summary>
  <div class="day-items">${group.items.map((i) => agendaCard(i, (i.daysUntilDue ?? 99) <= 1)).join("")}</div>
</details>`,
    )
    .join("");
}

export function renderToday(items: AgendaItem[]): string {
  const list = items.length ? renderDayGroups(items) : `<div class="empty">Nothing urgent. Nice.</div>`;
  return layout(
    "/",
    "Today",
    `<h1>Today</h1>
<p class="subtitle">${new Date(`${todayInSchoolTimeZone()}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>
<form class="sync-form" method="post" action="/sync"><button type="submit">Sync now</button></form>
<div class="section-label">Needs attention</div>
${list}
<p class="provenance-note">Due dates and titles: real, from LearningSuite. Time estimates: derived, Docket's guess — not fact.</p>`,
  );
}

export function renderUpcoming(items: AgendaItem[]): string {
  const list = items.length ? renderDayGroups(items) : `<div class="empty">Nothing in the next two weeks.</div>`;
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

export interface PhoneAccessInfo {
  lan: string[];
  tailscale: string[];
  localHostname?: string;
  port: number;
}

export function renderDiagnostics(report: DiagnosticsReport, phone?: PhoneAccessInfo, deployed?: boolean): string {
  const row = (label: string, value: string, ok: boolean) =>
    `<div class="diag-row"><span class="${ok ? "diag-ok" : "diag-warn"}">${esc(label)}</span><span>${esc(value)}</span></div>`;

  const phoneSection = deployed
    ? `<div class="section-label">Phone access</div>
<div class="card"><div class="card-title">✓ Reachable from anywhere</div><div class="card-meta">This is a deployed instance — open this same URL on your phone any time, on any network. Nothing needs to be running on your computer.</div></div>`
    : phone
      ? `<div class="section-label">Phone access</div>
${
  phone.lan.length > 0
    ? `<div class="card"><div class="card-title">Same Wi-Fi (no install needed)</div><div class="card-meta">Open this on your phone: <strong>http://${esc(phone.localHostname ?? "")}:${phone.port}</strong></div></div>`
    : `<div class="card"><div class="card-title">No Wi-Fi address detected</div><div class="card-meta">Restart the server while connected to Wi-Fi to get a phone-accessible address.</div></div>`
}
${
  phone.tailscale.length > 0
    ? `<div class="card"><div class="card-title">Tailscale detected</div><div class="card-meta">Also reachable from anywhere (off Wi-Fi too) at: http://${esc(phone.tailscale[0] ?? "")}:${phone.port}</div></div>`
    : `<div class="card"><div class="card-meta">This only works while your computer is on and this server is running. For access from anywhere, any time — no laptop needed — <a href="https://github.com/droper23/docket#deploying-so-it-works-from-anywhere">deploy it</a> (free). Or, for same-Wi-Fi reliability in the meantime: install <a href="https://tailscale.com/download">Tailscale</a> (free) on this computer and your phone.</div></div>`
}`
      : "";

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
${phoneSection}
${row("Changes in last 24h", `${report.recentChangeCount}`, true)}
<form class="sync-form" method="post" action="/sync" style="margin-top:20px"><button type="submit">Sync now</button></form>
<form method="post" action="/reset" onsubmit="return confirm('Delete all local Docket data? This does not touch your actual LearningSuite account.');"><button type="submit">Delete all Docket data</button></form>`,
  );
}

export function renderConnect(opts: {
  courseListHref: string;
  assignmentsHref: string;
  courseListSource: string;
  assignmentsSource: string;
  knownCourseCount: number;
}): string {
  const status =
    opts.knownCourseCount > 0
      ? `<div class="card"><div class="card-title">✓ ${opts.knownCourseCount} course${opts.knownCourseCount === 1 ? "" : "s"} connected</div><div class="card-meta">Re-run step 1 any time your enrollment changes — it always reflects your current course list, it never accumulates old semesters.</div></div>`
      : `<div class="card"><div class="card-title">No courses connected yet</div><div class="card-meta">Follow the steps below — pick whichever tab matches what you're on right now.</div></div>`;

  const copyBlock = (id: string, label: string, source: string) => `
<div class="script-box">
  <textarea id="${id}" class="script-source" readonly onclick="this.select()">${esc(source)}</textarea>
  <button type="button" class="copy-btn" onclick="copyScript('${id}', this)">${label}</button>
  <p class="script-fallback">If the button doesn't work: tap the box above to select the text, then copy it manually.</p>
</div>`;

  return layout(
    "/connect",
    "Connect",
    `<h1>Connect LearningSuite</h1>
<p class="subtitle">No password, ever. This only ever reads your own already-signed-in LearningSuite tab, on your own device.</p>
${status}

<div class="tabs">
  <button type="button" class="tab-btn active" onclick="showTab('phone')">📱 On your phone</button>
  <button type="button" class="tab-btn" onclick="showTab('computer')">💻 On a computer</button>
</div>

<div id="tab-phone" class="tab-panel">
  <div class="section-label">One-time setup (about a minute, iPhone/iPad)</div>
  <ol class="setup-steps">
    <li>Open the <strong>Shortcuts</strong> app (built into iOS) → <strong>+</strong> to create a new shortcut.</li>
    <li>Tap <strong>Add Action</strong>, search for <strong>"Run JavaScript on Web Page"</strong>, and add it.</li>
    <li>Tap the copy button below, then paste it into that action's text box.</li>
    <li>Name the shortcut "Connect LearningSuite" and turn on <strong>Show in Share Sheet</strong> (in the shortcut's settings, ⓘ icon).</li>
  </ol>
  ${copyBlock("script-courses-mobile", "📋 Copy the course-finder script", opts.courseListSource)}

  <div class="section-label">Every time after that (one tap)</div>
  <p class="connect-body">Open LearningSuite in Safari, sign in, go to <strong>Home → Course List</strong>, tap <strong>Share</strong>, then tap <strong>Connect LearningSuite</strong>. That's it — no typing, no links to copy, works from anywhere your phone does.</p>

  <div class="section-label">Optional: real grades &amp; due times</div>
  <p class="connect-body">Same idea, second shortcut — run it on a course's <strong>Assignments</strong> page instead. The ICS schedule only has dates, not exact times or grades.</p>
  ${copyBlock("script-assignments-mobile", "📋 Copy the grades/due-time script", opts.assignmentsSource)}

  <div class="section-label">Android</div>
  <p class="connect-body">Chrome doesn't have an equivalent built-in automation app. Use the "On a computer" tab's bookmarklet from Chrome's address bar: bookmark any page, edit that bookmark's URL to the code below, then type the bookmark's name in the address bar and select it while on the right LearningSuite page.</p>
</div>

<div id="tab-computer" class="tab-panel" hidden>
  <div class="section-label">Step 1 — Find your courses (one click, run it once per semester)</div>
  <p class="connect-body">Drag this button to your bookmarks bar. Then, while signed into LearningSuite, open <strong>Home → Course List</strong> and click it.</p>
  <p><a class="bookmarklet-btn" href="${opts.courseListHref}" onclick="alert('Drag this to your bookmarks bar instead of clicking it — bookmarklets only work as bookmarks, not as a normal click here.'); return false;">📚 Connect LearningSuite</a></p>

  <div class="section-label">Step 2 — Add real grades &amp; due times (optional, run per course)</div>
  <p class="connect-body">Open a course's <strong>Assignments</strong> tab, then click this to pull real due times and grades in too — safe to re-run any time, it only updates matching assignments, never creates duplicates.</p>
  <p><a class="bookmarklet-btn" href="${opts.assignmentsHref}" onclick="alert('Drag this to your bookmarks bar instead of clicking it.'); return false;">🎯 Sync Grades &amp; Due Times</a></p>
</div>

<div class="section-label">What this does and doesn't do</div>
<div class="card"><div class="card-meta">Reads the page you're already on — your course list or one course's assignment table. Sends only course codes/titles/IDs or assignment titles/due-times/scores to Docket. Never reads or sends a password, cookie, or session ID — see <a href="https://github.com/droper23/docket/blob/main/docs/THREAT_MODEL.md">the threat model</a> for the full analysis. The script is plain, readable JavaScript, the same one in both tabs — <a href="https://github.com/droper23/docket/blob/main/src/connectors/bookmarklet.ts">view the source</a> before you trust it.</div></div>

<div class="section-label">After connecting</div>
<form class="sync-form" method="post" action="/sync"><button type="submit">Sync now</button></form>
<script>
function copyScript(id, btn) {
  var el = document.getElementById(id);
  var label = btn.textContent;
  var settled = false;
  var done = function (ok) {
    if (settled) return; // the clipboard call and the timeout race — only the first to arrive wins
    settled = true;
    btn.textContent = ok ? 'Copied!' : 'Select the box above and copy manually';
    setTimeout(function () { btn.textContent = label; }, 2000);
  };
  // Some contexts (permission dialogs that never resolve, restrictive webviews) leave
  // writeText's promise pending forever instead of rejecting — never leave the button
  // silently unresponsive because of that.
  setTimeout(function () {
    if (!settled) { el.select(); done(false); }
  }, 1200);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(el.value).then(function () { done(true); }, function () {
      el.select();
      done(false);
    });
  } else {
    el.select();
    done(false);
  }
}
function showTab(name) {
  document.getElementById('tab-phone').hidden = name !== 'phone';
  document.getElementById('tab-computer').hidden = name !== 'computer';
  document.querySelectorAll('.tab-btn').forEach(function(b, i) {
    b.classList.toggle('active', (name === 'phone') === (i === 0));
  });
}
</script>`,
  );
}

export function renderImportResult(kind: "courses" | "assignments", body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Docket — Connected</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #171614; color: #ece9e3; padding: 32px 24px; }
  @media (prefers-color-scheme: light) { body { background: #f6f5f2; color: #1c1b19; } }
  h1 { font-size: 18px; }
  a { color: #c9a86a; }
  ul { padding-left: 18px; }
  .close-note { opacity: 0.6; font-size: 13px; margin-top: 24px; }
</style></head>
<body>
<h1>${kind === "courses" ? "Courses connected" : "Grades & due times synced"}</h1>
${body}
<p class="close-note">You can close this tab and go back to Docket.</p>
</body></html>`;
}
