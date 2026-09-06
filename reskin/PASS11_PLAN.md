# Eleventh pass — implementation plan (not yet executed)

**Status: PLAN ONLY. Nothing in this file has been built.** This document is the synthesis of
three independent AI design critiques commissioned to answer one question: after ten passes of
Apple-HIG-flavored polish, why does the reskin still not look like "LearningSuite redesigned by
Apple's marketing team and About Google," and what specifically should change? All three
reviewers worked independently, without seeing each other's output, from the repo's own code,
fixtures, and screenshots, plus live research against real apple.com/about.google/Material 3
sources. This document is my (the coordinating agent's) synthesis of their findings into one
coherent, sequenced, buildable plan — resolving the places where their proposals differed and
discarding ideas that were interesting but not load-bearing.

**If you are the agent implementing this: read `ROADMAP.md` in full before touching anything.**
It documents ten prior passes and a number of hard-won constraints discovered by live-testing
against a real BYU account. This plan assumes that history; it does not repeat all of it. Where
this plan's guidance and ROADMAP.md's documented constraints ever conflict, ROADMAP.md wins —
flag the conflict rather than silently picking one.

## Why a plan file instead of just doing it

Three independent 200+ tool-call research passes turned up two categories of findings:

1. **Real functional/data bugs** the ten prior passes didn't intend and didn't notice, because
   they were evaluated on "does it look good" screenshots, not "does it still tell the truth."
   The worst one: **the Grades page currently shows no grades.**
2. **A coherent argument that the visual language ten passes converged on — translucent
   Apple-HIG app-chrome (grouped lists, SF-Symbols-style icons, shadowed cards) plus a pass-10
   gradient — is not what either apple.com or about.google actually looks like**, and a concrete,
   cross-referenced alternative grounded in real, fetched apple.com/about.google/Material 3
   design tokens (not memorized impressions).

Fix category 1 before touching category 2. A beautifully redesigned page that still tells a
student their 0%-because-ungraded course is failing, in red, is a worse product than the ugly
one that at least showed the real number.

## Non-negotiable constraints (compiled from ROADMAP.md — read the full file for the reasoning)

- Never override `flex-direction` on `.docket-nav-enhanced`.
- The nav column's *width* is set by the parent `.bg-left-nav` wrapper, never by `<nav>` itself.
- Bare `<button>` and bare `.bg-base` selectors are deliberately never touched sitewide (both are
  reused for things a blanket override would break — see `global.css`'s top-of-file comment).
  Phase 3 below adds one narrower, scoped exception to `.bg-base` and explains exactly why it's
  safe.
- Never fabricate data. Every visual change must render real content already present in
  LearningSuite's own DOM, copied via `textContent`, never `innerHTML` (see
  `docs/THREAT_MODEL.md`).
- Never break a real click handler, href, or form submission. Always re-fire the original
  element's own interaction (`element.click()`), never reimplement it.
- Theme comes only from `document.documentElement`'s real `class` (`html.dark`/`html.h-full`),
  surfaced as `data-docket-theme`. Never trust bare `prefers-color-scheme` — see `index.ts`'s
  `applyTheme()` doc comment for the exact, previously-live-reproduced failure mode.
- `overlayContent()`'s `MutationObserver` leak fix (`lib/dom.ts`) must survive intact — it's what
  stops LearningSuite's own progressively-rendered content from leaking back in unhidden.
- Zero network requests (`docs/PRIVACY.md`). Any new asset (a font swap, if attempted — see
  Phase 8) must be embedded as a base64 `data:` URI via the existing `tools/fetch-font.mjs`
  pipeline. **Do not add a live `<link>` to Google Fonts or any other CDN** — one of the source
  reports cites about.google's own `<link>` to `fonts.googleapis.com` as a reference; that is a
  reference for *type-scale values only*, never something to copy literally into this codebase.
- A selector never ships without being confirmed against the real DOM first. Every adapter and
  every rule in `global.css` documents exactly this discipline in its own comments — follow it,
  including for the new selectors this plan calls for. `reskin/tools/cdp.mjs` (commands: launch,
  open, inject, eval, eval-file, shot, hover, click, tabs) against the authenticated profile at
  `reskin/tools/.chrome-audit-profile` is the established tool for this.

## Sequencing

Six phases, in order. Do not skip ahead to Phase 4 (visual identity) before Phases 1–3 are done
and verified — restyling a page that's still lying about grades, or that flashes unstyled/
wrong-theme content on every navigation, wastes the visual work.

1. Correctness & data-integrity fixes
2. Accessibility floor
3. Paint-integrity fixes (the "fake canvas" + FOUC bugs) — prerequisite plumbing for Phase 4
4. Design system rewrite (tokens → typography → spacing/radius → motion)
5. Component rewrites (course card, nav, badges/chips, rows, page header)
6. Stretch / optional (icon simplification, hero-fact course cards, native-control restoration)

Then: verification checklist, then a ROADMAP.md entry documenting what actually shipped.

---

## Phase 1 — Correctness & data-integrity fixes

These are bugs, not taste calls. Each one was independently found by at least two of the three
reviewers, and I re-read the current source myself to confirm every citation below against the
real file contents (not the reviewers' possibly-stale line numbers).

### 1.1 The Grades page shows no scores

`reskin/src/adapters/assignmentsAdapter.ts`, `extractRows()` (~line 82) already parses the score
out of the row text:

```ts
const scoreMatch = afterDueForScore.match(/(\d+(?:\.\d+)?)?\s*\/\s*(\d+(?:\.\d+)?)/);
```

…and then only uses it to compute a `completed` boolean (line 84). The match itself — earned
points (`scoreMatch[1]`, may be absent if ungraded) and possible points (`scoreMatch[2]`) — is
discarded. `RowData` has no score field; `AssignmentCardData` (`components/assignmentCard.ts`)
has no score field. `gradesAdapter.ts` reuses this same `extractRows`/`buildCard` pair, so **the
one page whose entire purpose is showing a score renders none.**

Fix:
- Add `scoreEarned?: string; scorePossible?: string;` to `RowData` (assignmentsAdapter.ts) and to
  `AssignmentCardData` (assignmentCard.ts), populated straight from `scoreMatch[1]`/`scoreMatch[2]`
  — copy the matched substrings verbatim, don't reformat/recompute.
- `buildCard()` passes them through unchanged.
- `assignmentCard()` renders a trailing score readout when `scorePossible` is present — e.g.
  `"18/20"` when both are present, `"— / 20"` when only possible points exist (real, ungraded
  work — an em dash for "not yet earned," never a fabricated 0). Use tabular figures
  (`font-variant-numeric: tabular-nums`) so score columns align down a list.

### 1.2 Grade Summary renders "not yet graded" as a failing red badge

`reskin/src/adapters/gradeSummaryAdapter.ts`, `extractCourses()` reads only the two `.clicky`
percentage strings per row (line 36) and discards everything else LearningSuite renders next to
them — specifically the "N/M assignments scored" and "(X% of all points)" context that explains
*why* a course might legitimately show 0%. `gradeBadge()` (`components/gradeBadge.ts`) then bands
anything under 70 as `docket-badge-red` with no way to know "0% because nothing has been graded
yet" from "0% because you're failing."

Fix:
- **Live-verify first** (per the selector-discipline rule above): use `tools/cdp.mjs` against the
  real account's Grade Summary page to find the exact element(s) carrying the "N/M assignments
  scored" / "(X% of all points)" text and the two-sentence legend, and their relationship to the
  `.clicky` percent nodes already being read. Do not guess the selector.
- Extend `CourseGrade` with the real detail string(s) for each column (copied verbatim, never
  parsed into a second derived number — LearningSuite has already done that math).
- Change `gradeBadge()`'s signature to also accept that detail string (or a simple
  `hasBeenScored: boolean` derived from it) and, when nothing has been scored yet, return a
  **neutral** chip labeled "Not yet graded" — never the red/failing treatment. Only apply the
  90/80/70 banding once real scored work exists.
- Render the detail string as a small line under each percentage (this is exactly the context
  the native page has and the current build drops).
- Add the real legend text back, verified live, as a small disclosure/footnote under the grid
  rather than deleting it.
- Add a `.docket-toggle-original` escape hatch to this adapter (see 1.4 — it currently has none).

### 1.3 "Opens" dates render as red "Overdue" badges; completed items still show overdue

`components/dueBadge.ts` bands purely on `daysUntilDue < 0` → red, with no concept of whether the
dated item is a **deadline** ("Due …") or an **availability date** ("… Opens …"). On the Combined
Schedule (`homeAdapter.ts`), several real rows are of the second kind and currently render as
"Overdue by N days" in the most alarming color in the badge system.

Also, `assignmentsAdapter.ts`'s `RowData.completed` already exists and is passed through
`buildCard()` to `assignmentCard()`, but `assignmentCard()` never consults it before also
rendering `dueBadge(data.daysUntilDue)` — so a graded, completed assignment that happens to be
past its due date shows a green completion mark **and** a red "Overdue" badge on the same row,
contradicting itself.

Fix:
- At extraction time (wherever the row/item title is read — `assignmentsAdapter.extractRows()`
  and `homeAdapter.extractItems()`), detect an availability-style title (`/\bOpens\b/i`, matched
  as a whole word against the real title text — verify the exact real wording live, it may not
  always be capitalized "Opens") and carry that forward as e.g. `kind: "due" | "opens"` on the row
  data.
- In `assignmentCard()`/`dueBadge()`, an `"opens"`-kind item never renders as overdue regardless
  of the sign of `daysUntilDue` — render a neutral/upcoming badge with "Opens …" wording instead
  of feeding it through the same due-date urgency ladder.
- In `assignmentCard()`, when `data.completed === true`, suppress the overdue/urgency badge
  entirely (or replace it with a neutral "Submitted"/"Graded" state) — a completed item doesn't
  need an urgency scare-badge regardless of its due date.

### 1.4 Two adapters have no way back to the native page, and permanently hide real controls

Every adapter except `courseListAdapter.ts` and `gradeSummaryAdapter.ts` renders a
`.docket-toggle-original` button that calls `overlay?.setOriginalHidden(true)`, giving the
student a way to reach whatever real LearningSuite UI the overlay is hiding. These two don't have
one at all — and `overlayContent()` hides *every* child of the container it's given, so on
Course List that permanently hides the real term tab strip (Current/Future/Past/Development/
Communities), the "Refresh Course List" button, and the green "Combined Schedule" shortcut, with
zero way to reach any of them short of opening Settings → Compatibility Mode → full reload.

Fix (required minimum):
- Add the same `.docket-toggle-original` pattern already used in `assignmentsAdapter.ts`/
  `homeAdapter.ts`/`dashboardAdapter.ts` to `courseListAdapter.ts` and `gradeSummaryAdapter.ts`.

Fix (also required — a bug in the pattern itself, wherever it's used):
- `overlayContent`'s `setOriginalHidden` is already a real two-way toggle (`lib/dom.ts` — it just
  flips `hidden`), but every adapter's own button always calls `setOriginalHidden(true)` and never
  offers a way to call it with `false` again once pressed. Make the button itself stateful: track
  whether the native view is currently revealed, flip `setOriginalHidden(revealed)` each click,
  and change the label between "View original LearningSuite page" and "Back to redesigned view."
- Also fix `assignmentsAdapter.ts`'s `buildCard()` (~line 109) and `homeAdapter.ts`'s row-click
  handler (~line 124): both call `overlayRef()?.setOriginalHidden(false)` — note the argument is
  `false`, which by `overlayContent`'s own convention *reveals* the native content (`hidden =
  false`) — before re-firing the real click. That's intentional (the student needs to see
  LearningSuite's own detail panel after clicking through), but nothing ever re-hides it
  afterward, so after one row click the enhanced view and the full native page are both visible,
  permanently, stacked. Re-hide the enhanced view's native passthrough once the interaction
  completes (e.g. on the next successful adapter mount for that page, or via a short
  `MutationObserver`-driven completion signal) rather than leaving it exposed forever.
- Reposition the toggle-original control to the end of each view's children rather than between
  the header and the content list (it's currently the first focusable thing after the page title
  in `assignmentsAdapter.ts`/`homeAdapter.ts`) — it shouldn't be the first tab stop on the page.

Fix (optional, higher effort — see Phase 6): rebuild the hidden term tabs / Refresh / Combined
Schedule shortcut as real controls inside the redesigned Course List view, re-firing the actual
native elements, the same "wrap, don't replace" pattern every other adapter already uses. This is
the *better* fix but needs live DOM confirmation of the term-tab markup first; the toggle-original
escape hatch above is the required safety net regardless of whether this gets built.

### 1.5 `courseListAdapter.ts` strips section numbers; `gradeSummaryAdapter.ts` doesn't

`splitCodeTitle()` (`courseListAdapter.ts` ~line 21) does
`.replace(/\s*\(\d+\)\s*$/, "")` on the course code, dropping e.g. `(003)`. Grade Summary keeps
the full string. A student in two sections of the same course sees identical cards on Course List
and different labels on Grade Summary. Remove the strip (keep the section number) so both pages
agree, and so two sections of one course are distinguishable.

### 1.6 Dashboard adapter collapses multiple real links into inert text

`dashboardAdapter.ts`, `extractDays()` (~line 47):

```ts
const link = p.querySelector("a.cursor-pointer") as HTMLElement | null;
```

grabs only the *first* real anchor inside a day's paragraph. A single day's content paragraph
commonly contains several real links (e.g. a file download **and** a Zoom recording link) — only
the first survives as a working link; everything else, including other real anchors, is flattened
into the row's plain-text label via `(link ?? p).textContent`.

Fix: use `p.querySelectorAll("a.cursor-pointer")`. If more than one real anchor exists in a
paragraph, render each as its own independently-clickable chip/row (label = that anchor's own
trimmed text, activate = that anchor's `.click()`), with any remaining non-anchor text (e.g. an
"(Updated on …)" date) shown as plain meta text rather than concatenated into the same string as
a dead link label. Every real anchor in the source paragraph must remain independently clickable
in the enhanced view.

### 1.7 Course-accent colors collide, and disagree across pages

`components/courseCard.ts`'s `accentForCourse()` hashes a course code into a 7-color palette
(`hash % 7`). With 5 enrolled courses this collides often (confirmed in the pass-10 screenshots:
two different courses render the identical yellow dot) — and because it's a pure per-code hash,
`gradeSummaryAdapter.ts` never calls it at all (its cards have no `--docket-card-accent` set, so
every card falls back to plain blue), meaning a course's "color identity" is inconsistent between
Home/Course List and Grade Summary even where it exists.

Fix: create `reskin/src/lib/courseColor.ts` exporting a single function, something like:

```ts
export function assignCourseColors(codes: string[]): Map<string, string>
```

that assigns colors by **sorted index into a fixed, evenly-spaced palette** (not a hash), so
colors never collide up to the palette size, and are stable across reloads because the ordering
is deterministic (sort the actual enrolled code strings, don't rely on DOM order). Size the
palette generously (8–12 entries is enough for any real course load; fall back to hash-based
assignment only past that). Every adapter that wants a course color (`courseListAdapter.ts`,
`gradeSummaryAdapter.ts`, and optionally `homeAdapter.ts`/`assignmentsAdapter.ts` for a course-code
dot) must call this same function against the same extracted code list, so a course's color is
identical everywhere it appears. Delete `accentForCourse()` from `courseCard.ts` once nothing
calls it.

### 1.8 Combined Schedule opens scrolled ~120 days into the past

`homeAdapter.ts`'s `WINDOW_DAYS_PAST = 120` (line 30) means a page titled "Today & Upcoming" loads
with the earliest (most overdue) items first in document order and nothing anchoring the initial
scroll position to *today*. Fix (minimum, low-risk): after the first render only (guard with a
module-level flag so a later mutation-triggered re-render never re-triggers it — this is
independent of, and must not interact with, the existing accumulate-and-merge/`replaceChildren`
logic), find the first rendered day group whose `dateIso` is `>=` today and call
`.scrollIntoView({ block: "start" })` on it once. A larger IA restructuring (collapsed "Overdue
(N)" section, explicit Today/Upcoming split) is a reasonable stretch goal — see Phase 6 — but is
not required to fix the acute "opens on ancient history" problem.

### 1.9 Dead setting

`showUpcomingOnHome` (declared and exposed as a toggle in `components/settingsPanel.ts`) is never
read by any adapter — grep confirms zero consumers. Either wire it up (tie it to the Phase 6
"hero-fact course card" stretch goal, if built) or remove the dead control from
`settingsPanel.ts`/`core/settings.ts` if that stretch goal isn't attempted this pass. Don't ship a
setting that does nothing.

---

## Phase 2 — Accessibility floor

Independent of the visual redesign; mechanical, low-risk, high value. All of the following were
independently confirmed by grepping the actual source (zero `h("h1"…)`-style calls anywhere in
`adapters/*.ts` — every page title is a styled `<div>`, and the overlay hides LearningSuite's own
real `<h1>` along with everything else it hides).

- **Real headings.** Every adapter's `.docket-large-title` wrapper (`courseListAdapter.ts`,
  `homeAdapter.ts`, `assignmentsAdapter.ts`/`gradesAdapter.ts`, `gradeSummaryAdapter.ts`) currently
  renders `h("div", { class: "docket-large-title" }, [...])` for the page title — change the tag
  to `h("h1", ...)`, keep the class/CSS as-is. Day/category headers currently rendered as
  `h("div", { class: "docket-headline" }, [...])` (`homeAdapter.ts`, `dashboardAdapter.ts`,
  `gradeSummaryAdapter.ts`'s course name) become `h("h2", ...)` where they're a real section
  boundary. `dashboardAdapter.ts` already correctly leaves LearningSuite's own real `<h1>Dashboard
  </h1>` visible and unhidden — don't add a second one there.
- **List semantics.** `.docket-group`/`.docket-course-grid` containers get `role="list"`; their
  direct row/card children get `role="listitem"` (nest the existing interactive element — the
  `role="button"`/`role="link"` row/card — inside the listitem wrapper, don't replace one role
  with the other) so assistive tech announces "list, N items."
- **Correct roles on interactive rows.** `components/assignmentCard.ts` sets `role="button"`
  (line ~46) on rows whose activation *navigates* — change to `role="link"`. Per platform
  convention, a link activates on Enter only, not Space — remove the Space-key branch from its
  keydown handler (currently handles both). `components/courseCard.ts`'s hrefless fallback card
  (line ~34–42) has the identical problem: `role="link"` with Space bound in its keydown handler
  — remove the Space branch there too.
- **Skip link.** Add `h("a", { href: "#docket-main", class: "docket-skip" }, ["Skip to
  content"])` as the first child of each adapter's rendered view (or centrally in
  `adapters/shell.ts` if that's a cleaner single insertion point), with a matching `id` on the
  content container and a standard visually-hidden-until-`:focus` CSS treatment.
- **FAB tab order.** `adapters/shell.ts`'s `mountShell` appends the settings FAB bar to the end of
  `document.body` — on a long page (Combined Schedule can render ~300 rows) that makes it close
  to the very last tab stop. Insert it near the front of `<body>` instead
  (`document.body.insertBefore(fabBar, document.body.firstChild)`); `position: fixed` means this
  doesn't move it visually.
- **`.docket-checkbox` semantics.** `components/assignmentCard.ts` renders this on every row
  regardless of whether the source data has a real completion concept — on `dashboardAdapter.ts`
  rows (holidays, lesson notes with no `activate`), `data.completed` is simply `undefined`, which
  currently renders as an empty, unlabeled circle implying "not done" for something that was never
  a task. Only render `.docket-checkbox` when `data.completed !== undefined` (i.e. the source
  genuinely has a completion concept); when it is rendered, give it `role="img"` and a computed
  `aria-label` ("Completed" / "Not yet completed") rather than leaving it silent.
- **Wrap, don't truncate.** `styles/cards.css`'s `.docket-row-title`/`.docket-row-subtitle` use
  `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, which currently cuts real
  content mid-sentence (confirmed in the pass-10 schedule screenshot: a title truncates mid-word
  well before its actionable half). Replace with a 2-line clamp:
  `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`
  so content wraps to a real line boundary before it's cut off.

---

## Phase 3 — Paint-integrity fixes

These are prerequisites for Phase 4: there's no point building a careful opaque tonal-surface
system in Phase 4 if the page's real content column isn't actually painted by this reskin's
tokens in the first place.

### 3.1 The "one canvas" is not actually one canvas

`global.css`'s own top-of-file comment states `<main>` has no background of its own and is
"transparent over body," and that `html`/`body`/`header`/`.bg-top-nav`/`.bg-header`/
`.bg-left-nav:not(.docket-nav-enhanced)` share one `--docket-canvas` fill (lines 39–46). That
premise no longer matches what the shipped screenshots show: sampling the actual pass-10
screenshots gives **three different fill colors on the same screen** in both themes (e.g., in
dark mode: masthead/nav-wrapper `rgb(0,0,0)`, the `<nav>` island interior `rgb(53,53,53)`, and the
main content column `rgb(36,36,36)` — three surfaces, not one). In light mode the `<nav>` island
specifically renders the exact warm tan (`rgb(230,219,206)`-ish) that an earlier pass's own
comment claims was already fixed.

This is very likely `.bg-base` — the class `global.css`'s file comment deliberately, correctly
excludes sitewide because it's *also* reused for highlighted table rows (see
`assignmentsAdapter.ts`'s own `.bg-base.text-highlight` selector) — landing on some other,
non-table-row wrapper (a page-level content container, or something inside `<nav>` besides
`.navItem`) that a blanket exclusion also caught.

**Do not guess the fix.** This needs one live-verification pass before any CSS changes: use
`tools/cdp.mjs` against the real account to walk `getComputedStyle` from `body` down to the first
visibly-different-colored wrapper on Home, Combined Schedule, and a Grades page, in both themes,
and identify exactly which element/class is painting off-canvas. Do the same for the `<nav>`
island specifically (its `background-color: var(--docket-sidebar-bg) !important` in
`navigation.css` line 34 should already be winning — find out what's overriding it or painting on
top of it).

Once identified, add the *narrowest possible* selector override — following the exact
"confirmed live, scoped to exactly the observed compound class" discipline every other rule in
`global.css` already uses (e.g. the existing `.bg-left-nav:not(.docket-nav-enhanced)` pattern is
the right shape to imitate) — so the real content column and the real nav island are both
actually painted by this reskin's surface tokens. This is the single highest-leverage fix in the
whole plan: nothing in Phase 4/5 can look right until this is true.

### 3.2 Theme flash / FOUC on every navigation

`index.ts`'s `earlyInject()` (the `document-start` half of style injection) sets
`data-docket-reskin` and injects CSS immediately, but does **not** set `data-docket-theme` —
that only happens inside `applyTheme()`, called from `runAdapters()`, called from `boot()`, which
only runs at `DOMContentLoaded`. `tokens.css`'s un-attributed base block (i.e. before any
`data-docket-theme` is set) is the **light** palette (`--docket-canvas: #f2f2f7`, near-black
label). So for a dark-mode student, on every full-page navigation (LearningSuite navigates
between top-level sections with real page loads, not SPA routing), the viewport paints light
first, then snaps to dark once `boot()` runs.

Fix: in `earlyInject()`'s `tick()`, right after `injectStyles()` succeeds, synchronously check
`document.documentElement.classList.contains("h-full")` — if true, LearningSuite's own class has
already landed and `classList.contains("dark")` is reliable right there; set
`data-docket-theme` immediately from it (same logic `applyTheme()` already has, just hoisted
earlier). If `h-full` isn't present yet at that tick, keep the existing `setTimeout(tick, 0)` poll
going (extend it to keep checking theme, not just style-injection-presence) for a short bounded
time, then fall back to `getSetting("lastKnownDark", true)` exactly as `applyTheme()` does today.
`applyTheme()` inside `runAdapters()` remains the authoritative, continuously-reconciling pass
afterward — this change only removes the gap where *no* theme attribute is set at all during
initial load.

Also add a short ready-gate to prevent the "native content visible for one frame before hide"
flash on the content side (separate from the theme-color flash above): something like
`html[data-docket-reskin]:not([data-docket-ready]) main { visibility: hidden }` in `global.css`,
with `data-docket-ready` set at the end of the first successful `runAdapters()` call, and a
`~400ms` failsafe `setTimeout` registered inside `earlyInject()` that sets the attribute
unconditionally (so a native page with no matching adapter still becomes visible; never fail
permanently hidden).

---

## Phase 4 — Design-system rewrite

This is the core visual-identity work, and it's a genuine break from what shipped in pass 10.
The single biggest, best-corroborated finding across all three independent reports: **the
"signature" moves from pass 10 — a blue→purple→pink gradient on interactive fills, a blurred
radial "hero glow" behind page titles, a translucent shadow-heavy card treatment — are the
opposite of what apple.com and about.google actually do.** One reviewer fetched about.google's
real production CSS directly and found zero gradient usage anywhere in 598KB of stylesheet;
apple.com's own product-page CSS has exactly one shadow in the entire system, reserved for
photographed product renders, never UI chrome. All three reviewers, independently, arrived at the
same replacement model: **opaque tonal surface steps instead of translucent shadowed cards, one
flat interactive accent instead of a gradient, and a disciplined 400/600/700 type weight ladder
instead of 800-weight headlines.** The values below are synthesized from their real-source
citations (Apple's shipped CSS, about.google's shipped CSS, Material 3's published design
tokens), not invented.

### 4.1 Delete these entirely

- `--docket-accent-gradient`, `--docket-hero-glow` (`tokens.css`)
- `.docket-header::before` (`layout.css`) — the hero glow element
- `[data-docket-reskin] header::after` (`global.css`) — the 3px gradient masthead hairline;
  replace with nothing, or at most a 1px hairline in the new separator token if the masthead
  needs a visual bottom edge at all
- The `border-image: var(--docket-accent-gradient) 1` on `.docket-top-tab-active`
  (`navigation.css`)
- The `background: var(--docket-accent-gradient) !important` on `.docket-nav-item-active`
  (`navigation.css`) and on `.goBtn`/`.bg-action`/`button.bg-primary-dark` (`global.css`)
- `translateY(-4px)` hover lift on `.docket-course-card` (`layout.css`)
- `--docket-radius-xl: 28px` as a *card* radius (keep a large radius for the settings sheet only —
  see 4.4)

### 4.2 Surface tokens — opaque tonal steps, replacing the translucent-overlay model

The current `--docket-bg-elevated` is `rgba(0,0,0,0.045)` light / `rgba(255,255,255,0.08)` dark —
a translucent film over whatever's behind it. Composited against real measured backgrounds this
comes out at roughly 1.1–1.3:1 contrast against the page (i.e. barely visible), which is why cards
disappear in the light-mode screenshots and read as mud in dark mode. Replace with **opaque**
steps — the Material 3 "surface container" model, independently arrived at by more than one
reviewer and directly traceable to real, shipped `m3.material.io` token values:

```css
/* light */
--docket-canvas:        #ffffff;
--docket-surface-1:     #f8f9fa;   /* grouped-list ground, replaces translucent bg-elevated */
--docket-surface-2:     #f1f3f4;   /* card fill / hover state */
--docket-surface-3:     #e9eaee;   /* pressed / selected */
--docket-label:         #1f1f1f;   /* ~16.5:1 on canvas */
--docket-label-secondary: #444746; /* ~9.4:1 on canvas */
--docket-label-tertiary:  #6c6f70; /* ~5.7:1 — use sparingly, prefer secondary */
--docket-separator:     #dadce0;
--docket-fill:           #eceef0; /* hover fill on transparent-background rows/nav */

/* dark */
--docket-canvas:        #131314;
--docket-surface-1:     #1b1b1c;
--docket-surface-2:     #1f1f20;
--docket-surface-3:     #2a2a2c;
--docket-label:         #e3e3e3;   /* ~14.5:1 on canvas */
--docket-label-secondary: #c4c7c5; /* ~10.9:1 on canvas */
--docket-label-tertiary:  #9a9d9c; /* ~6:1 */
--docket-separator:     #444746;
--docket-fill:           #2a2a2c;
```

Rename every usage of `--docket-bg-elevated` across `cards.css`/`layout.css`/`global.css`/
`navigation.css` to `--docket-surface-1` or `--docket-surface-2` depending on which visual step
makes sense in context (grouped lists/tables → surface-1; individual cards, the popup sheet,
menus → surface-2), then delete the old token definition. Do not keep both names as aliases — the
whole point is that these are now opaque and the old name implied translucency.

Delete `--docket-shadow`/`--docket-highlight` as the *primary* depth mechanism. Depth now comes
from the surface-step difference plus a 1px `--docket-separator` border, matching how both real
references actually work (see the sourced comparison table in the discarded research — apple.com
ships exactly one shadow, on product photography only). Keep **one** shadow token, reserved for
genuinely floating chrome — the account/course dropdown menus and the Preferences sheet — since
those really do float over arbitrary page content:

```css
--docket-shadow-float: 0 1px 3px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.15); /* dark: same, alpha .5/.3 */
```

### 4.3 Accent — one interactive color, split into fill/text pairs, never a gradient

```css
/* light */
--docket-accent:        #0b57d0;
--docket-on-accent:     #ffffff;   /* text/icon color ON a --docket-accent-filled surface */
--docket-accent-container:    #d2e3fc;  /* nav active pill / secondary emphasis fill */
--docket-on-accent-container: #174ea6;  /* ~6.85:1 on the container above */

/* dark */
--docket-accent:        #a8c7fa;
--docket-on-accent:     #062e6f;   /* dark text on the light-blue fill — NOT white */
--docket-accent-container:    #0e2a4d;
--docket-on-accent-container: #aecbfa;
```

Use `--docket-accent`/`--docket-on-accent` for real primary actions (`.goBtn`, `.bg-action`,
`button.bg-primary-dark`, links via `.clicky`/`.text-action` etc. — same selectors already in
`global.css`, just swap the fill/text values, no gradient). Use `--docket-accent-container`/
`--docket-on-accent-container` for the active nav pill and active top-tab — a flat, quieter fill
so it doesn't visually compete with real primary buttons on the same screen. **Important:** dark
mode's `--docket-on-accent` is *dark* text on a *light* accent fill, not white — a naive
"always white text on the accent" rule fails contrast in dark mode, since dark mode's accent
itself is a light blue. Verify both pairs hit ≥4.5:1 during Phase 7 verification; if either
measured value comes up short, darken/lighten within the same hue rather than picking an
unrelated color.

### 4.4 Status roles — container/on-container pairs, replacing the badge system

`components/gradeBadge.ts`/`components/dueBadge.ts` currently derive both a chip's fill *and* its
text from the *same* raw system-tint hue (`cards.css`'s `.docket-badge-red` etc: a ~16% tint of
`--docket-red` as background, the full-strength `--docket-red` as text) — mathematically this
cannot guarantee contrast in both themes at once, and independently-computed contrast checks in
all three source reports find every single badge color failing WCAG AA in at least one theme (the
worst: red/"Overdue" text in light mode, computed at roughly 2.3–2.6:1 depending on which
reviewer's sampling — all agree it's a real, serious failure). Replace with explicit
container/on-container pairs — a dark, saturated tone as text, paired with a pale tint as
background (or the inverse in dark mode), the same structural fix all three reports converged on:

```css
/* light */
--docket-status-overdue-bg:  #fce8e6;  --docket-status-overdue-fg:  #a50e0e;
--docket-status-soon-bg:     #fef7e0;  --docket-status-soon-fg:     #b06000;
--docket-status-upcoming-bg: #e8f0fe;  --docket-status-upcoming-fg: #174ea6;
--docket-status-done-bg:     #e6f4ea;  --docket-status-done-fg:     #0d652d;
--docket-status-neutral-bg:  #f1f3f4;  --docket-status-neutral-fg:  #3c4043;

/* dark */
--docket-status-overdue-bg:  #4a1512;  --docket-status-overdue-fg:  #f6aea9;
--docket-status-soon-bg:     #42320a;  --docket-status-soon-fg:     #fde293;
--docket-status-upcoming-bg: #0f2c52;  --docket-status-upcoming-fg: #aecbfa;
--docket-status-done-bg:     #0e2d1b;  --docket-status-done-fg:     #a8dab5;
--docket-status-neutral-bg:  #2b2b2f;  --docket-status-neutral-fg:  #c4c7c5;
```

Rewrite `.docket-badge-*` in `cards.css` to consume these pairs instead of the raw
`--docket-red`/`--docket-orange`/etc. system colors (keep those raw hues for course-accent dots
only — see 1.7 — not for status chips). Rewire `gradeBadge()`/`dueBadge()` to select a *role*
(`overdue`/`soon`/`upcoming`/`done`/`neutral`) rather than picking a raw color directly, and wire
the `neutral` role to the new "not yet graded" state from Phase 1.2 and the "opens" state from
Phase 1.3. Chip text drops from 700 to 600 weight and from 12px to 13–14px (see 4.5) — Google's
real chip components never bold small text; the weight discipline itself carries the emphasis.

### 4.5 Typography — drop weight 800, add the missing "lead" tier, raise the size floor

Both real references cap headline weight at 600 (Apple) or use 400 for anything above 16px
(Google) — 800-weight, -0.03em-tracked headlines (the current `.docket-large-title` and the
sitewide native `h1`/`h2`/`h3` override in `global.css`) belong to neither. Both references also
hold a size floor around 13–14px minimum for real content — the current 11px `.docket-caption`
and 12px `.docket-footnote`, independently measured by all three reviewers, land at roughly
1.7–3.3:1 contrast, which is why the day-item counts and course-code subtitles read as nearly
invisible in the screenshots.

Replace `typography.css` with:

```css
.docket-scope { font-family: var(--docket-font); color: var(--docket-label); -webkit-font-smoothing: antialiased; }

.docket-display  { font-size: clamp(34px, 4vw, 52px); line-height: 1.1;  font-weight: 600; letter-spacing: -0.02em;  margin: 0 0 4px; }
.docket-title-1  { font-size: 26px; line-height: 1.2;  font-weight: 600; letter-spacing: -0.015em; margin: 0 0 2px; }
.docket-title-2  { font-size: 20px; line-height: 1.3;  font-weight: 600; letter-spacing: -0.01em;  margin: 0; }
.docket-lead     { font-size: 19px; line-height: 1.4;  font-weight: 400; margin: 0; color: var(--docket-label-secondary); }
.docket-body     { font-size: 16px; line-height: 1.5;  font-weight: 400; margin: 0; }
.docket-body-sm  { font-size: 14px; line-height: 1.45; font-weight: 400; margin: 0; color: var(--docket-label-secondary); }
.docket-label    { font-size: 13px; line-height: 1.3;  font-weight: 600; margin: 0; }
.docket-eyebrow  { font-size: 12px; line-height: 1.3;  font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin: 0; color: var(--docket-label-secondary); }
```

Delete `.docket-caption` (the 11px/tertiary tier) entirely; anywhere it was used, use
`.docket-eyebrow` instead, and check it's paired with `--docket-label-secondary` or better, never
`--docket-label-tertiary`, at that size. Map old class names to new ones across every `.ts`
component (`.docket-large-title` → `.docket-display`, `.docket-title` → `.docket-title-1`,
`.docket-headline` → `.docket-title-2`, `.docket-body`/`.docket-subhead`/`.docket-footnote` →
`.docket-body`/`.docket-body-sm` as appropriate) — grep for every current class name across
`components/*.ts` and `adapters/*.ts` and update each call site; don't leave a dangling
`.docket-footnote` rule with no consumers.

In `global.css`, change the native `h1`/`h2`/`h3` override (lines ~103–117) from 800-weight to
600-weight, and retarget the sizes to `.docket-display`/`.docket-title-1`/`.docket-title-2`'s
values (via a shared CSS custom property or just matching numbers) so pages without a dedicated
adapter (Announcements, Class Info, etc.) match the adapter-rendered pages' hierarchy instead of
looking like an older design generation next to them.

### 4.6 Spacing, content width, and radius

- Widen `.docket-page`'s `max-width` from 960px to **1120px** (`layout.css`) — apple.com's real
  content column is ~980px, about.google's is ~1024px; 1120 gives the wider column real
  multi-column data (a future gradebook grid, wider course grids) room without also being so wide
  that a single paragraph of prose reads poorly. If `.instructorText.font-nunito` (the rendered
  rich-text card) ever needs its own narrower reading measure, cap that specific element at
  ~720px rather than narrowing the whole page.
- Replace the radius scale:
  ```css
  --docket-radius-xs: 6px;
  --docket-radius-sm: 10px;
  --docket-radius-md: 14px;   /* cards, groups, tables — the new default */
  --docket-radius-lg: 20px;   /* sheets/modals only */
  --docket-radius-pill: 999px; /* nav pills, buttons only, unchanged */
  ```
  Delete `--docket-radius-xl` (28px). Every current `var(--docket-radius-xl)` usage
  (`.docket-course-card` in `layout.css`, `.popupWrapper .minMax` in `global.css`) moves to
  `--docket-radius-md` (course card) or `--docket-radius-lg` (modal sheet) respectively. Every
  current `var(--docket-radius-md)`/`var(--docket-radius-lg)` usage elsewhere needs re-auditing
  against the new scale (some 12px→14px moves are fine as-is, some 20px table/gridColsStyle
  radii should probably drop to `--docket-radius-md` too — use judgment, but the new default for
  "a card or grouped surface" is 14px, not 20 or 28).

### 4.7 Motion

Replace the single `cubic-bezier(0.16, 1, 0.3, 1)` curve used everywhere (13 occurrences across
`layout.css`/`cards.css`/`navigation.css`/`global.css`) with role-specific tokens:

```css
--docket-ease-standard: cubic-bezier(0.2, 0, 0, 1);
--docket-ease-enter:    cubic-bezier(0.05, 0.7, 0.1, 1);
--docket-ease-exit:     cubic-bezier(0.3, 0, 0.8, 0.15);
--docket-dur-fast:   120ms;
--docket-dur-medium: 220ms;
--docket-dur-slow:   320ms;
```

Hover/focus/pressed state transitions use `--docket-ease-standard` at `--docket-dur-fast`;
anything that reveals/expands new content uses `--docket-ease-enter` at `--docket-dur-medium`;
anything collapsing/dismissing uses `--docket-ease-exit` at `--docket-dur-fast`. Both existing
reduced-motion gates in `tokens.css` (the `prefers-reduced-motion` media query and the explicit
`data-docket-reduced-motion="true"` attribute) already force all transition/animation durations to
near-zero regardless of which curve is used — leave both exactly as they are, they don't need to
change.

Replace `.docket-course-card:hover`'s `translateY(-4px)` lift with a state-layer overlay (works
correctly on the new opaque surfaces, doesn't move the click target out from under the cursor):

```css
.docket-course-card { position: relative; overflow: hidden; /* ...existing... */ }
.docket-course-card::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: currentColor; opacity: 0; pointer-events: none;
  transition: opacity var(--docket-dur-fast) var(--docket-ease-standard);
}
.docket-course-card:hover::after   { opacity: .06; }
.docket-course-card:focus-visible::after { opacity: .08; }
.docket-course-card:active::after  { opacity: .10; }
.docket-course-card:active { transform: scale(0.985); }
```

Optional, cheap, genuinely distinctive detail worth adding here (sourced directly from
about.google's own real, shipped CSS — its image tiles do exactly this on hover): an asymmetric
corner-radius morph as the hover signature, replacing the lift:

```css
.docket-course-card { border-radius: var(--docket-radius-md); transition: border-radius var(--docket-dur-medium) var(--docket-ease-enter), /* ...existing transitions... */; }
.docket-course-card:hover, .docket-course-card:focus-visible { border-radius: 4px var(--docket-radius-lg) var(--docket-radius-lg) var(--docket-radius-lg); }
```

---

## Phase 5 — Component rewrites

Apply the Phase 4 tokens to the specific components the reports flagged as weakest.

### 5.1 Course card (`layout.css` `.docket-course-card`, `components/courseCard.ts`)

Replace the `linear-gradient(135deg, color-mix(...) ...)` wash (`layout.css` ~line 62–72) — a
20%-hue mix into a translucent overlay that measured out to near-invisible in light mode and
muddy/desaturated in dark mode in every reviewer's pixel sampling — with a flat, opaque,
committed color field using the Phase 1.7 de-collided course color:

```css
.docket-course-card {
  background: var(--docket-surface-1);
  border: 1px solid var(--docket-separator);
  border-radius: var(--docket-radius-md);
  padding: 22px;
  /* no box-shadow */
}
.docket-course-card::before {
  /* the one place the course's own color appears, full strength */
  content: ""; position: absolute; inset: 0 0 auto 0; height: 4px;
  background: var(--docket-card-accent, var(--docket-accent));
}
```

`courseCard.ts` already sets `--docket-card-accent` per-card via inline style (line ~28) — keep
that mechanism, just feed it from the new `courseColor.ts` (Phase 1.7) instead of the old
`accentForCourse()` hash. Keep the `.docket-dot` glow ring treatment if it still reads well
against the new flat surface, or fold the per-course color entirely into the top-edge rule above
and drop the dot — implementer's call once it's actually rendered live; both are reasonable, the
important fix is the underlying color source and opacity, not the exact micro-shape.

### 5.2 Navigation (`navigation.css`)

Keep every structural constraint from ROADMAP.md exactly as documented (no `flex-direction`
override, width owned by the parent wrapper). Change only fill/shape:

- `.docket-nav-enhanced`: fill from `--docket-surface-1` (opaque, not the old
  `--docket-sidebar-bg`/`--docket-canvas` alias that Phase 3.1 found isn't actually reaching the
  element cleanly), drop `backdrop-filter` (the element already paints an opaque background, so
  the blur buys nothing but GPU cost — keep `backdrop-filter` only on the account/course dropdown
  menus and the modal scrim, which really do float over other content), radius from
  `--docket-radius-xl`(28px) down to `--docket-radius-lg`(20px) or `-md`(14px) — try both once
  live, pick whichever reads better against the new opaque fill.
- `.docket-nav-item-active`: flat `--docket-accent-container`/`--docket-on-accent-container` fill
  (Phase 4.3), not the gradient.
- `.docket-top-tab-active`: flat `--docket-accent` underline via `border-bottom-color`, not
  `border-image`/gradient.

### 5.3 Page header (`layout.css` `.docket-header`)

Delete the glow pseudo-element (Phase 4.1). Replace with the plain eyebrow → display-title → lead
stack the new typography scale already supports:

```html
<div class="docket-header">
  <div class="docket-eyebrow">Course List</div>      <!-- optional, page-dependent -->
  <h1 class="docket-display">Courses</h1>
  <div class="docket-lead">5 courses this term</div>  <!-- optional, only where there's a real fact to state, never filler -->
</div>
```

Only add the eyebrow/lead lines where there's genuinely real data to put in them (e.g. a course
count, an item-due count already computed elsewhere in the adapter) — never ship empty/filler
copy just to fill the pattern. A bare `<h1 class="docket-display">` with no eyebrow/lead is a
perfectly fine, correct use of this header on pages where there's nothing else true to say yet.

### 5.4 Grouped rows and chips (`cards.css`)

- `.docket-group`: `background: var(--docket-surface-1)` (was the translucent `--docket-bg-
  elevated`), border-radius `--docket-radius-md`, drop the shadow, add a 1px
  `--docket-separator` border for edge definition on surfaces that don't otherwise contrast
  against canvas.
- `.docket-row`: unchanged structurally; ensure `.docket-row-title`/`.docket-row-subtitle` use
  the Phase 2 line-clamp fix and the new `.docket-body-sm`/`.docket-label` type tokens (13–14px
  floor, not 11–12).
- `.docket-badge` family: consume the Phase 4.4 status role pairs; drop font-weight from 700 to
  600, bump font-size from 12px to 13–14px.

---

## Phase 6 — Optional / stretch (do only after Phases 1–5 are solid and verified)

These are good ideas from the source reports that are either higher-risk, higher-effort, or not
required to satisfy the stated goal (fix real bugs + deliver a genuine Apple/Google-inspired
visual identity). Attempt them only with time/budget to spare, and never at the expense of
skipping verification on Phases 1–5.

- **Hero-fact course cards.** Give each course card on Course List a real fourth line — "2 due
  this week" or a current-grade figure — instead of just code + name + color. This requires
  cross-adapter data sharing: Combined Schedule and Grade Summary each already parse
  cross-course data, but only while their own page is mounted; Course List would need to read a
  small persisted-in-session cache (via the existing `lib/storage.ts` pattern) populated by
  whichever of those adapters last ran. Wire the currently-dead `showUpcomingOnHome` setting
  (1.9) to this if built.
- **Rebuild the hidden Course List controls as real re-fired native elements** (term tabs,
  Refresh, Combined Schedule shortcut) instead of relying solely on the toggle-original escape
  hatch from 1.4. Needs live DOM confirmation of the term-tab markup first.
- **Restructure Combined Schedule's IA** into explicit collapsed-Overdue / Today / Upcoming
  sections rather than the flat chronological list the Phase 1.8 scroll-to-today fix leaves in
  place. Bigger change to `homeAdapter.ts`'s render logic; the one-time-scroll fix is sufficient
  to resolve the acute bug on its own.
- **Icon simplification in the primary sidebar nav.** Neither apple.com's nor about.google's
  primary navigation uses icons next to text labels — removing them from `.docket-nav-item`
  entirely (keeping the leading-edge active indicator as the sole visual anchor) is arguably more
  on-brief, but it's a visible feature removal worth a deliberate decision rather than a drive-by
  change. If kept, at minimum fix `components/icons.ts`'s `navIconByLabel` mapping both
  `"Syllabus"` and `"Library Resources"` to the same `book` glyph (two distinct destinations, one
  icon) — give Syllabus its own glyph or none.
- **Font swap to a variable font with an optical-size axis** (e.g. Google Sans Flex, OFL-licensed
  per its Google Fonts metadata at the time of the source research, and reportedly smaller than
  the currently-bundled Inter woff2). **Do not attempt this without first independently
  re-verifying the license** (check the actual `google/fonts` repo for an `ofl/` directory
  entry, don't trust a cached metadata lookup from a prior research pass) and re-running
  `tools/fetch-font.mjs`'s existing offline-embedding pipeline — never add a live font `<link>`.
  This is a nice-to-have; the Phase 4.5 weight-discipline changes capture most of the typographic
  benefit regardless of typeface.

---

## Phase 7 — Verification

1. `npm run typecheck && npm run build && npm test` inside `reskin/` — the existing 34-test suite
   must still pass; add/update tests for: score plumbing (extend `test/fixtures/assignments.html`/
   `grades.html`-based assertions), `gradeBadge`'s new neutral "not yet graded" state, `dueBadge`'s
   "opens" no-longer-overdue case, `dashboardAdapter`'s multi-link preservation (extend
   `test/fixtures/dashboard.html` with a multi-anchor-paragraph case if the current fixture
   doesn't already have one), and `courseColor.ts`'s de-collision guarantee (pure function, easy
   to exhaustively test for N=1..12 codes asserting no two share a color within the palette size).
2. Live-verify against the real, authenticated BYU account via `tools/cdp.mjs`, in **both** Dark
   Mode and Light Mode (toggle live via the account's own real Preferences control, screenshot,
   then restore the original setting afterward — same discipline every prior pass has used), on
   at minimum: Home/Course List, Combined Schedule (confirm the today-anchor scroll and the
   no-longer-false "Overdue" labels), a real course Dashboard (confirm every real link survived),
   Grades (confirm scores are visible), Grade Summary (confirm no false-red "0%", confirm the
   toggle-original escape hatch exists), and Settings/Preferences.
3. `tools/cdp.mjs` currently has no viewport-resize command — ROADMAP.md already flags this gap,
   and it means **no prior pass has ever captured a real narrow-width screenshot.** Add one before
   closing out Phase 4.6/responsive work, then capture and review at minimum 375px, 768px, 1024px,
   and 1440px in both themes. Don't ship the responsive changes on reasoning alone if this
   tooling gap can be closed cheaply.
4. Spot-check computed contrast on the new token pairs directly in the live session (e.g. via a
   `tools/cdp.mjs eval` snippet that reads `getComputedStyle` background/foreground pairs and
   computes relative-luminance contrast) rather than trusting the values in this document as
   final — they're sourced from the reviewers' own independent calculations against real
   third-party design systems, not verified against this codebase's actual rendered output.
5. Update `ROADMAP.md` with a new top-of-file entry ("## Eleventh pass: …"), in the same voice and
   level of detail as the existing nine entries — what shipped, what was verified live and how,
   and an explicit "Explicitly deferred" list for anything in Phase 6 not attempted. Only claim
   "verified live" for things actually screenshotted/confirmed against the real account this
   pass — don't inherit that claim from this plan document, which has not been verified against
   anything live.
