# Twelfth pass — implementation plan (not yet executed)

**Status: PLAN ONLY. Nothing in this file has been built.** This is the coordinating session's
synthesis of three independent AI design critiques of the reskin as it stands after the eleventh
pass (commit `ebdd323`, Sep 2026). All three reviewers worked independently — no visibility into
each other's output — from the repo's own code and history, a fresh set of live screenshots
(`tools/shots/pass12/`, captured this session against the real authenticated account, both native
and reskinned, for Course List/Combined Schedule/Grade Summary/course Dashboard/Assignments/
Gradebook/Settings), and their own independent research against real apple.com/about.google/
design.google/Material 3 sources. Every claim below that originated with a reviewer was
independently re-verified by the coordinating session directly against the current source before
being included here — file:line citations are re-confirmed, not copied on trust.

**If you are the agent implementing this: read `ROADMAP.md` in full before touching anything.** It
documents eleven prior passes and a number of hard-won constraints discovered by live-testing
against a real BYU account. Read `PASS11_PLAN.md` too — it's the direct precedent for this
document's own format and rigor, and several open items it deferred to a "Phase 6 stretch goal"
are independently re-raised as higher priority below, now that three separate reviewers landed on
them without being told to. Where this plan and ROADMAP.md's documented constraints conflict,
ROADMAP.md wins — flag the conflict rather than silently picking one.

## The one thing to internalize before reading further

All three independent reviewers, unprompted, converged on the same structural critique of *how
this project has been evaluating itself*, not just what it built: **apple.com and about.google are
marketing pages** — a product-shopping hero, a corporate announcement splash — and this reskin is a
**dense, comparative, scannable-list productivity tool** (a 171-row gradebook, a 300-item semester
schedule, a 5-course grid). A marketing page has no list to show and no lesson to teach about how
either company actually handles dense list content. The real, much closer reference class is
Apple's own **Reminders, Mail, Calendar, and Settings**, and Google's own **Gmail, Calendar,
Classroom, and Material 3's documented application components** — not their marketing sites. This
reframes several of the eleventh pass's own citations (which correctly measured real values off
real pages, but off the wrong *kind* of page) and is the throughline behind most of what follows.
Two of three reviewers, independently, also concluded the token system pass 11 already shipped is,
in substance, a **Material 3** system (surface-container steps, container/on-container status
pairs) that the codebase's own comments still describe as "Apple HIG" — recommendation: commit to
that lineage explicitly rather than continuing to describe it as something else (see Phase 4.1).

## Non-negotiable constraints (compiled from ROADMAP.md and docs/THREAT_MODEL.md — read the full
files for the reasoning)

- Never fabricate data. Every visual change renders real LearningSuite content via `textContent`/
  DOM builders (`lib/dom.ts`'s `h()`), never `innerHTML`.
- Zero network requests beyond `learningsuite.byu.edu` itself. Any new asset must be a base64
  `data:` URI, never a CDN `<link>`.
- Never break a real click handler, href, or form submission — always re-fire the original
  element's own interaction, never reimplement it.
- `<nav>`'s own column *width* is set by its parent `.bg-left-nav` wrapper, never by `<nav>`
  itself — documented independently by the third, fifth, and ninth passes. Any IA change that
  touches sidebar width (Phase 5.3 below) must live-verify this before promising anything.
- Never override `flex-direction` on `.docket-nav-enhanced`.
- A selector never ships without being confirmed against the real DOM first
  (`reskin/tools/cdp.mjs`, against the authenticated profile at `reskin/tools/.chrome-audit-profile`
  — note this session's login had expired and needed a fresh human 2FA login; budget for that).
- A broken adapter must never take down the page — the existing try/catch/unmount fallback in
  `index.ts`'s `runAdapters()` already guarantees this; don't weaken it.

## Sequencing

1. Correctness & data-integrity fixes (real bugs, several newly found this pass)
2. Functional-parity gaps (a new category this pass: real, working native functionality with no
   redesigned equivalent at all — found independently by all three reviewers, not previously
   tracked as its own class of problem in ROADMAP.md)
3. Settings-panel design-system migration (one file left behind by four passes of token rewrites)
4. Visual-identity re-grounding (re-anchor the reference class, then the resulting token/type/
   color changes)
5. Information architecture (higher-risk, spike-first, sequenced last — same discipline PASS11
   used for its own IA stretch goals)
6. Verification

---

## Phase 1 — Correctness & data-integrity fixes

Each item below was found independently by at least two of the three reviewers, or confirmed
directly against the current source by the coordinating session (noted per item). Live-verify each
against the real DOM before fixing, per this project's own standing discipline — none of these were
checked against a live browser this session (the review agents were explicitly kept off the
authenticated Chrome session to avoid conflicting with it).

### 1.1 Course Dashboard silently drops an entire real content column on multi-column days

**Independently found by two reviewers; confirmed directly by the coordinating session.**
`dashboardAdapter.ts:35-72`, `extractDays()`:

```ts
const list = bar.nextElementSibling;
```

reads exactly **one** sibling element after each day's date bar. `native-dashboard.png`'s Tuesday,
September 8 shows two labeled sub-groups — "Column 1" (three real assignment items) and "Column 2"
(a real BYU calendar item, "Devotional: President and Sister Reese"). `reskinned-dashboard.png`'s
same day shows only Column 1's three items — the Devotional entry is completely absent, with no
error, no diagnostic count change, nothing a student could notice without comparing to the native
page directly. The function's own comment (lines 23-24) already documents that a day is "grouped
into one or more 'Column N' sub-sections that this adapter flattens" — but the code only ever reads
the first one. This is the same *shape* of bug the eleventh pass already fixed one level down (a
paragraph with multiple real anchors, only the first kept, lines 46-67 of this same function) — it
recurs one level up, in the same file, and the anchor-level fix's presence made it easy to assume
the day-level walk was already exhaustive.

Fix: confirm live whether LearningSuite renders "Column N" groups as multiple siblings after one
date bar (the likely shape, per the code's own comment) or some other structure, then walk **all**
matching siblings, not just the first, merging their items into one day's list.

### 1.2 The "View original LearningSuite page" escape hatch has inverted reveal/hide logic

**Found by one reviewer; independently re-derived and confirmed by the coordinating session
directly against the code — this is not in doubt.** `lib/dom.ts:144-158`, `createOverlayToggle()`:

```ts
const setRevealed = (next: boolean): void => {
  revealed = next;
  overlayRef()?.setOriginalHidden(next);
  btn.textContent = next ? hideLabel : revealLabel;
};
```

`setOriginalHidden(hidden: boolean)` does exactly what its name says (`lib/dom.ts:101-104`): `true`
hides native content, `false` reveals it. The overlay mounts with native content already hidden
(`hidden = !compatibilityMode`, i.e. `true`). Trace a first click, starting from `revealed = false`:
`setRevealed(!false)` → `setRevealed(true)` → `overlayRef()?.setOriginalHidden(true)` — the same
value the overlay already had. **Nothing becomes visible.** The button's label flips to "← Back to
redesigned view" anyway — a false affordance claiming a state change that didn't happen. A second
click calls `setOriginalHidden(false)`, which *does* reveal native content — now stacked underneath
the still-fully-visible enhanced view, since nothing ever hides the enhanced view itself. This
reproduces, on demand, the exact "the original page just moved lower, all the original stuff is
still there" symptom the ninth pass's own `overlayContent()` `MutationObserver` fix was built to
eliminate — except this time triggered by the toggle's own inverted call, on the one control whose
entire job is letting a confused student recover. It's shared by all six adapters that call
`createOverlayToggle()`. It also silently breaks `reveal()` (`lib/dom.ts:131-133,157`), called by
`assignmentsAdapter.ts` and `homeAdapter.ts` right before re-firing a native row's own click "so its
real detail panel is visible" — same inverted call, so it doesn't reveal anything (likely masked in
practice if LearningSuite renders that detail panel outside the overlaid container, but the stated
intent and the actual behavior disagree). Zero test coverage exists for this (`grep` in `test/`
confirms zero references to `setOriginalHidden`/`createOverlayToggle`/`.reveal(`).

Fix: `overlayRef()?.setOriginalHidden(next)` should be `overlayRef()?.setOriginalHidden(!next)` —
`revealed = true` must mean native content is *shown* (`hidden = false`). Add a real test for this
(mount an overlay, click the toggle, assert the original nodes' `.hidden` state matches the label).
This is a three-line, high-confidence, low-risk fix — do it before anything else in this plan.

### 1.3 Combined Schedule never got the multi-anchor-splitting fix Dashboard already has

**Independently found by all three reviewers, citing the identical screenshot evidence.**
`reskinned-schedule.png`, Wednesday September 9, one row's title reads verbatim: *"Chapter 2.1
04-Information Storage.pdf Download (Updated on 09/01/2026) Zoom Recording (05/01/26)"* — a
filename, a download label, an update date, and a Zoom-recording label concatenated into one
unbroken title. `homeAdapter.ts:62` reads one anchor's full `textContent` with no splitting logic
at all — the exact shape `dashboardAdapter.ts:46-67` (see 1.1 above) was already rewritten to
handle for the Dashboard's own paragraphs (split multiple real anchors into independent rows,
capture leftover meta text separately). That fix was scoped only to `dashboardAdapter.ts`;
`homeAdapter.ts`'s own `extractItems()` has the same real-world content shape and was never
audited for it.

Fix: apply the identical anchor-splitting logic from `dashboardAdapter.ts:46-67` to
`homeAdapter.ts`'s row extraction. One reviewer additionally suggests collapsing parenthetical
suffixes like `(Updated on …)` into a secondary meta line rather than leaving them concatenated
even after anchor-splitting, since LearningSuite's own native page truncates this same content to
one line and never shows the full mess — worth doing if low-risk, not required to close this item.

### 1.4 Grade Summary's "Total course progress" badge reads as a false failing alarm for
essentially the entire semester

**Independently found by all three reviewers — the strongest convergent finding in this round.**
`gradeBadge()` (`components/gradeBadge.ts:20-33`, confirmed) has exactly one `hasBeenScored` branch
distinguishing "nothing graded yet" (neutral) from "banded 90/80/70/else" — there is no distinction
between what "Current progress" and "Total course progress" actually *mean*. `reskinned-
gradesummary.png` shows MATH 113 real data: "Current 100%" (green, correct — 5 of 5 graded
assignments scored perfectly) directly next to "**Total 0.71%**" in a **red**, "failing"-role badge.
LearningSuite's own legend text (rendered verbatim by this same adapter) explains "Total course
progress" is earned points over *all possible points in the class*, meaning every one of the
remaining 166 not-yet-due assignments counts as a zero by construction — this number is
mathematically guaranteed to look catastrophic for nearly the whole semester regardless of the
student's actual standing. `native-gradesummary.png` renders this same figure as plain, unstyled,
blue-tinted text — LearningSuite's own designers evidently already understood this number isn't a
performance judgment. This is the same false-alarm shape the eleventh pass already fixed for the
*zero-scored* case (Phase 1.2, "not yet graded" neutral chip) — this is one step further down the
same curve: *partially* graded, early in term, still misreads as failing.

Fix: "Total course progress" should not use the same performance-banding ladder as "Current
progress" at all — it isn't a performance signal, it's a term-progress signal. Render it with the
neutral role unconditionally (or band it against how much of the term/points has actually elapsed,
if that's derivable from data already in hand — the simpler neutral-always treatment is lower-risk
and matches what the native page itself does). `gradeSummaryAdapter.ts`'s `statBlock()` calls
`gradeBadge()` identically for both columns today; give it a parameter distinguishing the two.

### 1.5 Course-accent palette: two adjacent-in-use hues read as the same color at a glance

**Independently found by two reviewers; palette values confirmed directly.** `lib/courseColor.ts`'s
`PALETTE` (lines 15-28) assigns by sorted index — a real fix over the old hash-based collision bug
— but doesn't check *perceptual* distance between the hues actually selected. This account's real 5
sorted courses land on indices 0-4: `#0b57d0` (blue), `#b3261e` (red), `#146c2e` (green),
`#7b3ff2` (purple), `#c4370a` (orange). Index 1 (red) and index 4 (orange) are both warm,
similarly-saturated, similarly-light hues — in the actual 4px course-card top-edge rule rendered in
`reskinned-courselist.png`, both reviewers independently had to sample the pixels side by side to
be sure they weren't identical. The de-collision guarantee (no two courses share an *identical*
color up to 12) is real and correct; "no exact collision" and "visually distinguishable at a
glance" are different guarantees, and the second is what a student scanning a card grid quickly
actually needs.

Fix: live-check the rendered palette's pairwise perceptual distance (a simple hue/lightness/chroma
distance is enough; CIEDE2000 if convenient) for every prefix length 1 through 12 — not just
array-index uniqueness — and reorder/re-pick hex values so the first several slots (most commonly
used, since most students have 4-8 courses) are maximally spread. Extend the existing exhaustive
`courseColor` test to assert a minimum distance, not just distinctness.

### 1.6 Course/term switcher truncates on every course-scoped page in the reskinned build

**Independently found by two reviewers, reproduced across three separate screenshots.**
`native-dashboard.png`, `native-assignments.png`, and `native-gradebook.png` all show the masthead
course switcher rendering in full ("MATH 113 – Calculus 2"); the identical pages in
`reskinned-dashboard.png`, `reskinned-assignments.png`, and `reskinned-gradebook.png` all truncate
it to "MATH 113 – Calc…", with visible empty space to its right. One reviewer's working hypothesis:
the Inter font substitution (`tokens.css`, sixth pass) is measurably wider per character than
LearningSuite's native Metropolis/SF stack at the same size, and if the wrapped native element
carries its own `truncate`-style class (plausible — `homeAdapter.ts:48` already references a real
`.truncate` class elsewhere in this codebase's own selectors), a wider typeface at the same
character budget truncates sooner. Unconfirmed — this needs a live check, not a guess.

Fix: live-verify the actual cause (inspect the native element's classes and computed width live)
before changing anything. This is a real, reproducible regression in the one piece of chrome
present on every single page inside a course — a student sees *less* information about which
course they're in than the native page shows them.

### 1.7 Live-reproduce and fix the "Student View / Back to Instructor View" banner

**Found by two reviewers, with disagreement on its exact current visual state — resolve by live
observation, don't guess which description is right.** Every reskinned top-level screenshot
(`reskinned-courselist.png`, `reskinned-schedule.png`, `reskinned-gradesummary.png`) carries a
banner directly under the masthead for any account with instructor access. One reviewer describes
it as completely unstyled, raw saturated yellow (LearningSuite's own native color, untouched); the
other describes it as a muddy, half-styled olive-brown (touched by some sitewide color rule but not
designed). The fifth pass's own ROADMAP entry already tried to fix this class (`.bg-attention`) and
noted it "could not be reproduced" in that session's account — it reproduces now, in this account,
on every top-level page. Either way it's the loudest, most visually inconsistent element in an
otherwise disciplined opaque-surface palette.

Fix: live-inspect the actual current computed style and class name on this element first (don't
assume either reviewer's screenshot-based read is exactly right), then give it a real, designed
treatment — likely as a genuine warning/attention role using this project's own status-role token
system (`--docket-status-*` pairs), not a bespoke color.

---

## Phase 2 — Functional-parity gaps

A new category this pass, not previously tracked as its own class of problem: **real, working
native functionality that has no equivalent anywhere in the redesigned view**, distinct from a
visual regression or a data bug. All three reviewers independently hit this same theme hard enough
that it deserves its own phase, sequenced right after correctness fixes since it's also about
honesty and completeness, not taste.

### 2.1 Combined Schedule has lost real, one-click native functionality with no substitute

**Independently found by all three reviewers.** `native-schedule.png`'s right rail — a Month/Week/
List view switcher, a `◀ Sep 7–11 ▶` date-range navigator, a real "**+ Item**" button (adds a
personal reminder — genuine, mutating LearningSuite functionality), and a filter panel (per-type
checkboxes: Assignments/Exams/My text items/Instructor text items/Completed items/Path items/
University dates, plus a per-course/org show-hide checklist covering more entries — including
non-course orgs like "Leadership Certificate" — than the 5-course grid shown anywhere else in this
reskin) — none of it survives into `reskinned-schedule.png`. `overlayContent()` hides all of it, and
`homeAdapter.ts` never rebuilds any equivalent. With 1.2's fix, the escape hatch at least now
actually works as a way back to all of this — but "abandon the entire redesigned view to hide
completed items or filter to one course" is a real capability regression this pass should reduce,
not just make technically reachable again.

Fix (minimum, this pass): once 1.2 is fixed, confirm live that reaching the native filter panel via
the now-working escape hatch is a clean, working path (no double-rendering, no confusion). Fix
(fuller, matches Phase 5.4 below): rebuild at least the per-course and "hide completed" filters as
real controls inside the redesigned view.

### 2.2 Assignments/Grades' per-row "Statistics" icon has no equivalent

**Independently found by two reviewers.** `native-assignments.png`/`native-gradebook.png` show a
small bar-chart icon per row opening a class-average comparison modal for that specific assignment.
`extractRows()` (`assignmentsAdapter.ts:61-115`) never reads or preserves it; `assignmentCard()`
has no slot for a secondary per-row action. Accept as a known gap for this pass (reachable via the
now-fixed escape hatch) unless time permits adding a real secondary-action affordance to
`AssignmentCardData`/`assignmentCard()`.

### 2.3 Assignments' collapsible category accordion is gone, flattening a 171-row gradebook into
one continuous scroll

**Found by one reviewer, high-confidence given the real gradebook size ROADMAP already
documents.** `native-assignments.png` shows a real, collapsible "Video Quizzes" category header;
`extractRows()` flattens every category into one list, repeating the category name as plain
subtitle text on every single row instead. For a real 171-row, 7-category gradebook, that's a
single un-collapsible scroll of over a hundred rows to reach a later category — strictly worse
scanability than the native page for exactly the courses where this matters most. Tracked as an IA
rebuild in Phase 5.5, not a quick fix — flattening was a deliberate simplification, restoring real
disclosure needs its own adapter-level work.

### 2.4 The same real assignment shows two different "Opens" date formats on two pages

**Found by one reviewer, precisely root-caused.** MATH 113's "Video Quiz 7.2" reads "Opens
Wednesday" on Combined Schedule and "Opens Sep 9" on the course's own Assignments/Grades page — the
identical real item, same day. `homeAdapter.ts:142` formats via `dueDateLabel()` (relative-day
wording); `assignmentsAdapter.ts:95`'s regex capture is passed verbatim as an absolute date string
to `dueBadge()` (`components/dueBadge.ts:28`). Neither is wrong alone, but a student cross-checking
one page against the other has no way to confirm they're the same date without doing the math.

Fix: share one formatting function between both adapters so the same real date always renders the
same way regardless of which page it's viewed from. Absolute-date wording is probably the safer
shared default (unambiguous on a re-visit days later), but either choice is fine as long as it's
consistent.

### 2.5 "Actionable now" collapses into the same generic affordance as "not yet open"

**Found by one reviewer.** `native-assignments.png` shows a solid green "**Begin**" button for an
open, actionable quiz — a clear one-glance signal distinct from "Opens Sep 9" three rows below it.
The reskinned card renders both as the same row shape with only a due-date badge and a bare
chevron. `AssignmentCardData` (`components/assignmentCard.ts:4-20`) has no field for this state.
Lower priority than Phase 1/2.1-2.2 — note as a real, currently-unaddressed loss of a genuinely
useful native signal; add an "actionable" field and a corresponding visual treatment if time
permits this pass, otherwise defer explicitly rather than silently drop it from tracking.

### 2.6 Every settings change, including purely cosmetic ones, triggers a full page reload

**Found by one reviewer, independently traceable in the code.** `index.ts`'s `mountShell` callback
calls `location.reload()` unconditionally on every settings change (`index.ts:199`) — a Background
swatch click or the Reduce Motion toggle doesn't structurally need a full navigation the way
`useCompanionNav`/`compatibilityMode` genuinely do (those need adapters to cleanly mount/unmount).
The reload discards scroll position and, on Combined Schedule specifically, resets `homeAdapter.ts`'s
module-level accumulator and `scrolledToToday` flag — so a student previewing background colors
gets yanked back to today's schedule position even if they'd scrolled elsewhere.

Fix: only reload for settings that actually require adapter remount; apply cosmetic settings
(background, appearance, reduced motion) live via attribute/style updates on the existing DOM,
matching how `data-docket-theme`/`data-docket-background` already work as live-toggleable
attributes elsewhere in the codebase.

---

## Phase 3 — Settings panel design-system migration

**Found by one reviewer; independently confirmed directly by the coordinating session — this is
real and currently shipping.** `panel.css` (the Settings/Diagnostics Shadow-DOM panel's own
stylesheet) was never migrated off the pre-eleventh-pass translucent-glass/iOS identity everything
else in the app moved away from:

- `panel.css:29-31`: `background: rgba(242,242,247,0.82)` + `backdrop-filter: saturate(180%)
  blur(24px)` — the exact translucent, shadow-heavy material the eleventh pass's own plan says
  both real references reject, and that this app's every other surface has since dropped.
- `panel.css:59`, `84`: focus rings and the selected-swatch ring hardcode `#007aff` — iOS system
  blue, a different hue from this app's actual current accent (`--docket-accent: #0b57d0`).
- `panel.css:102`, `108`: the toggle-on state and a diagnostics "ok" color both hardcode `#34c759`
  (iOS system green), never reconciled with `--docket-green` used everywhere else in the app.
- `panel.css:35`: `box-shadow: 0 24px 70px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.12)` — far
  heavier than the one surviving `--docket-shadow-float` token the rest of the app now uses.

`reskinned-settings-panel.png` is the one screenshot in this whole set that reads as a visibly
different, older-generation product than the pages around it — softer, blurrier, more saturated-
blue. The file's own comment (lines 1-6) explains this as "a Shadow root's styles can't leak,"
which is only half true: **CSS custom properties are explicitly excluded from what the `all`
shorthand resets** (`:host { all: initial; }`, line 14, does not clear them), and they inherit into
a shadow tree from the host element's own inherited value — this is a real, standard web-platform
behavior, not something this project needs to work around. `settingsPanel.ts:148-149` already
threads `data-docket-theme`/`data-docket-reduced-motion` from `document.documentElement` onto the
Shadow host at panel-open time; the same technique can thread the half-dozen real custom properties
this file actually needs.

Fix: at panel-open time (`settingsPanel.ts`/`diagnosticsPanel.ts`), read the current computed
values of `--docket-surface-2`, `--docket-accent`, `--docket-on-accent`, `--docket-separator`,
`--docket-green`, and `--docket-shadow-float` off `document.documentElement` and set them as inline
custom properties on the Shadow host, then reference them via `var(--docket-accent, #0b57d0)` etc.
in `panel.css`, keeping the current hardcoded value only as a fallback. **Live-verify this actually
renders correctly** before committing to it as the approach — the spec-level reasoning above is
sound but this project's own discipline is to confirm every claim about how the DOM actually
behaves, not reason about it in the abstract.

---

## Phase 4 — Visual-identity re-grounding

Per the framing note at the top of this document: re-anchor "what does Apple/Google actually look
like" on their real list-based *application* products, not marketing pages, before making further
token changes.

### 4.1 Commit the token system to its real lineage

Two of three reviewers independently noted that `tokens.css`'s surface-container steps and
container/on-container status pairs are, in substance, Material 3 constructs, while code comments
elsewhere (`tokens.css`, `layout.css`'s course-card comment) still describe the project's aim as
"Apple HIG." Recommendation: extend the current three-step surface model
(`--docket-surface-1/2/3`) to Material 3's own named five-step role stack (`surface`,
`surface-dim`, `surface-bright`, `surface-container-low/DEFAULT/high/highest`) — this app genuinely
needs more depth relationships than three steps can express today (`.docket-group`'s grouped-list
ground and `.docket-course-card`'s individual card fill currently share one token and are told
apart only by a border). Most existing hex values survive as a starting point; this is a rename-
and-extend, not a redesign. Keep, unconditionally, the one deliberate Apple borrowing all three
reviewers converged on: the grouped-list/Reminders idiom (`.docket-group`/`.docket-row`, a rounded
card of hairline-divided rows, no shadow, no per-row card) for agenda-shaped content specifically
(Combined Schedule, Dashboard day-groups) — this is already correctly implemented and is the
strongest, most-recognizable part of the current system.

### 4.2 Type scale — two independent, compatible fixes

- **Give `.docket-display` alone a 700 weight**, leaving every smaller tier at ≤600. Grounded in
  fresh, direct observation: `ref-apple-mac.png`'s "Mac" and `ref-google-design.png`'s "Code is a
  Design Material" both render visibly heavier than a 600-weight cut at their respective sizes
  (note: `ref-google-about.png`'s own hero is lighter, closer to 400 — this is not a fixed rule
  even within Google's own family, just evidence the current blanket 600-weight-for-the-biggest-
  headline choice is a defensible middle, not "the" answer, and a single-tier bump costs nothing).
- **Use `.docket-display` only for genuine top-level/root screens; downgrade to `.docket-title-1`
  (already defined, currently unused as a page-header size) for one-level-deep, course-scoped page
  headers** (Assignments, Grades, Grade Summary as currently structured). This directly fixes the
  observation that a marketing-hero-scaled headline immediately followed by a dense data grid reads
  as oversized for what follows it — a page-shape mismatch, not a bad pixel value. Mechanical,
  low-risk: a class-name swap at each adapter's existing page-header call site.

### 4.3 Course-card color as a stronger identity signal

Widen the course-color treatment from the current 4px top-edge rule to a fuller header-band
treatment (closer to Google Classroom's own full-width colored class-card header) — this project
already computes the correct, de-collided color per course (once 1.5 is fixed); it's under-using
it. Use the perceptually-fixed palette from Phase 1.5.

### 4.4 A density toggle for long lists

Add a Settings row ("Compact rows" or similar) that swaps `.docket-row`'s padding and
`.docket-row-title`'s size for a denser variant on request — matching Gmail's/Drive's own real,
shipped Comfortable/Compact density control, and directly serving the two genuinely long lists this
app has (a 300-item Combined Schedule, a 171-row gradebook) without hardcoding a denser default
that would hurt the 5-item Course List grid. Additive to the existing settings surface and storage
pattern; no new adapter risk.

### 4.5 Iconography — a genuine three-way split, not resolved here

Two reviewers independently reconfirmed against fresh screenshots that neither apple.com's nor
about.google's own top navigation pairs icons with text labels, and recommend dropping icons from
the primary sidebar nav entirely. The third reviewer's counter-argument is that this is, again, the
wrong reference class — Apple's own list-based apps (Reminders, Mail) *do* use leading icons in
their sidebars, which is the actually-comparable pattern for a productivity sidebar, not a
marketing top-nav. This is a genuine disagreement about which real Apple product is the right
comparison, not a resolved question — implementer's call, but make it a deliberate one, not a
drive-by change, and note the reasoning either way in the ROADMAP entry this pass produces. Lower
priority than anything above regardless of which way it's decided.

Independent of that debate, one icon bug is unambiguous and already flagged (PASS11_PLAN Phase 6,
still unfixed): `components/icons.ts`'s `navIconByLabel` maps both `"Syllabus"` and `"Library
Resources"` to the same `book` glyph. Fix this regardless of the icon-removal question above — give
Syllabus its own glyph, or none.

---

## Phase 5 — Information architecture (spike-first, sequenced last)

All three reviewers independently concluded that the current shape — a masthead course-switcher, a
vertical sidebar, and (inside a course) a separate horizontal top-tab bar, all three present
simultaneously on every course-scoped page — is not what either company's own IA instincts would
produce for "5 courses × assignments/grades/schedule/announcements." Each proposed a different
specific mechanism; none of the three specific mechanisms should be treated as a guaranteed
deliverable, per ROADMAP's own repeated caution that nav-width/structural changes carry more DOM
risk than this project usually takes on. Stage as live-verification-first spikes.

### 5.1 Build the cross-course "hero fact" home surface

**Independently re-proposed by all three reviewers, unprompted** — this is the strongest signal in
this whole review that a previously-deferred idea should actually get built this pass.
`PASS11_PLAN.md`'s own Phase 6 already scoped this exact feature ("hero-fact course cards": each
course card gains a real, computed "2 due this week" or current-grade line, sourced from a small
persisted-in-session cache populated by whichever adapter — Combined Schedule, Grade Summary — last
ran) and deferred it. Build it this pass: it directly reduces how often a student needs to visit
Combined Schedule/Grade Summary separately, and turns Course List from "a directory" into the
actual first screen a student would want to land on. The real constraint (LearningSuite's
full-page-reload navigation means one page's data isn't present in the DOM while another is
showing) is the same one PASS11 already flagged; the session-cache answer is the honest, buildable
fix, not a live cross-adapter merge.

### 5.2 Don't build a second course-picker

The native masthead dropdown and this reskin's own Course List page currently do the same job
("pick a course") in two different UI idioms. Treat the masthead as authoritative for course-
switching and let 5.1 turn Course List into a term-overview home surface rather than a redundant
second picker.

### 5.3 Sidebar/top-tab redundancy inside a course — spike, don't commit

Live-verify (per this project's own standing width-ownership caution) whether the horizontal
top-tab bar can reasonably become the sole primary in-course navigation surface, with the vertical
sidebar's own items folded into or hidden behind it, before promising this as a deliverable. This
is the highest-risk item in this plan — treat it as a timeboxed spike with a clear "confirmed
feasible" or "confirmed not worth the DOM risk this pass" outcome, not an open-ended rebuild.

### 5.4 Combined Schedule — collapsed sections, and a real home for the lost filters

Restructure into Overdue/Today/This Week/Later collapsed sections (`PASS11_PLAN.md` Phase 6,
already fully scoped, now elevated given Phase 2.1's finding that the flat list plus the vanished
filter sidebar makes the current shape actively worse for per-course filtering than before the
reskin existed). Use this restructuring as the natural place to reintroduce at least the per-course
and "hide completed" filters as real, redesigned controls, not only reachable via the escape hatch.

### 5.5 Restore real category disclosure on Assignments/Grades

Matching Material 3's own expandable-list-group pattern (a collapsed group shows a count and
aggregate stat, exactly what the native page's own accordion header already shows), fixing Phase
2.3's scanability regression on large gradebooks.

---

## Phase 6 — Verification

1. `npm run typecheck && npm run build && npm test` inside `reskin/`. Add tests for: the fixed
   `createOverlayToggle()` reveal/hide semantics (1.2); the Dashboard multi-column extraction
   (1.1); `homeAdapter.ts`'s new anchor-splitting (1.3); `gradeBadge()`'s Current-vs-Total
   distinction (1.4); `courseColor.ts`'s perceptual-distance guarantee (1.5), extending the existing
   exhaustive N=1..12 test rather than replacing it.
2. Live-verify against the real, authenticated account (`tools/cdp.mjs` — budget time for a fresh
   human login; this session's saved profile had expired) in both Dark and Light mode: the
   Dashboard multi-column fix, the escape hatch's actual reveal/hide behavior on every adapter that
   uses it, Combined Schedule's anchor-splitting, Grade Summary's Total-progress badge, the
   course-switcher truncation fix, and the Student-View banner's real current state before
   redesigning it.
3. `tools/cdp.mjs` still has no viewport-resize command (a gap ROADMAP has flagged for several
   passes) — add one before attempting Phase 5.3's width-risk spike; don't reason about narrow-
   viewport behavior from a fixed 1440px capture alone.
4. Update `ROADMAP.md` with a new top-of-file entry ("## Twelfth pass: …"), same voice and detail
   level as the existing entries — what shipped, what was live-verified and how, and an explicit
   "Explicitly deferred" list for anything in Phase 5 not attempted or not confirmed feasible. Note
   explicitly which of this document's claims (several were confirmed against the code but not yet
   against a live render) were live-verified this pass versus inherited from this plan's own
   research.
