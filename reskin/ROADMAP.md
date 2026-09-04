# LearningSuite Reskin — Roadmap

## Fourth live pass: top-bar dropdowns, modal chrome, and the real font story (Sep 2026)

This pass targeted the seams the third pass explicitly left behind: the top bar's own
dropdown panels, the Preferences dialog's outer chrome, and remaining font coverage.
Method unchanged from prior passes — a real authenticated `learningsuite.byu.edu` account
in Chrome, driven over the DevTools protocol (`reskin/tools/cdp.mjs`, a dependency-free
custom driver this pass; audit snippets in `tools/audit/`, screenshots in `tools/shots/`).
The built bundle was verified by stripping its `==UserScript==` metadata and evaluating the
rest in the live tab (the established loop), re-injected after every full-page navigation.
Every selector below was dumped from the live DOM before any CSS was written.

1. **Header dropdown panels (the requested top-bar fix).** Both menus — the account menu
   (Messages/Preferences/Help/Logout, from the user's name top-right) and the course/term
   switcher — live in named containers (`div.header-userdropdown-dropdown`,
   `div.header-coursedropdown-dropdown`) wrapping a `ul ... bg-base border-info (sm|lg):rounded`.
   Natively each rendered a solid `rgb(36,36,36)` box, 4px radius, **no shadow, no blur**
   floating over an otherwise-redesigned page — exactly the seam predicted. Both now get the
   translucent-menu treatment (canvas at 85% via `color-mix` with an opaque-canvas fallback
   for engines without it, `--docket-radius-md`, the two-layer `--docket-shadow` plus glass
   edge, saturate/blur backdrop), in `navigation.css` next to `.docket-nav-enhanced`, whose
   recipe they reuse. The course-scoped term switcher and the top-level "All courses" menu
   were confirmed to be the *same component* (identical container class on Combined Schedule
   and on the top-level Course List page) — one fix covers both, as hoped but not assumed.
2. **Preferences dialog chrome.** Confirmed live: a full-screen scrim `div.popupWrapper`
   (note: the class is *named* `bg-blur` but its computed `backdrop-filter` is `none` — the
   blur has to come from us) wrapping the sheet `div.minMax.bg-base.height-Lg` — solid
   `rgb(36,36,36)`, 0px radius, no shadow. The scrim gets `rgba(0,0,0,0.35)` + real backdrop
   blur; the sheet gets `--docket-canvas`, `--docket-radius-lg`, and the shadow token —
   deliberately opaque, not glass: a modal sheet floats over a dimmed page, and translucency
   here would let the dimmed content bleed through the text. Inside it, the accordion
   section headers were confirmed in both states — collapsed
   `div.text-primary.bg-gray1` (already covered by the existing `.bg-gray1` rule) and
   expanded `div.text-white.bg-primary-dark` (newly scoped rule, fill + label colors). The
   Display radios are real native `input[name=typeSelector]` radios — already covered by the
   radio restyle from the third pass.
3. **`.bg-primary-dark` is NOT a safe blanket target — census before styling paid off.** On
   the schedule page it fills four unrelated things: the **active top tab**
   (`a.bg-primary-dark.bg-top-nav-highlight`, owned by `.docket-top-tabs`), the Preferences
   accordion header (a `div`), and two real action buttons (the schedule's "+ Item", the
   prefs "Save", both bare `<button>`s with `hover:bg-primary-alt`). A blanket class remap
   would have fought the first two. Instead only `button.bg-primary-dark` joined the
   `.goBtn`/`.bg-action` action-button group, and only `.popupWrapper div.bg-primary-dark`
   gets the accordion-header treatment.
4. **The real font story (supersedes the third pass's census).** The earlier "only 4
   sitewide `.font-metro` elements" figure was taken on the Grades page alone. Re-run on
   Combined Schedule: 76 visible elements compute Metropolis as their first family, and 76
   carry `.font-metro` directly — because a class rule always beats an *inherited* font, the
   `body` remap never reached any of them (74 were `.bg-action` buttons already covered by
   their own rule; the one true gap was the `bg-primary-dark` buttons above). Fix: remap the
   class itself (`[data-docket-reskin] .font-metro`) — it is LearningSuite's own semantic
   "branded UI text" signal, and a font-family remap cannot change layout behavior the way a
   color/background remap could. Confirmed live post-fix that a `.font-metro` trigger now
   computes `-apple-system`. Course List's census (8 hits, all covered) found no new gaps.
5. **Row hover in menus, scoped not sitewide.** Menu rows are `li.hover\:bg-accent` (header
   dropdowns) and the Preferences timezone-picker options are
   `div.cursor-pointer.text-primary.hover\:bg-accent`; natively they hover-fill
   LearningSuite's raw accent. Remapped to `--docket-fill` for exactly those three confirmed
   surfaces. A sitewide `.hover\:bg-accent` remap was considered and deliberately deferred —
   it is a Tailwind-style utility that could sit on unconfirmed non-menu elements.

Verified with computed-style assertions AND real mouse events (synthetic `.click()` cannot
produce `:hover`): hovered menu rows compute `rgba(255,255,255,0.1)` in dark and
`rgba(120,120,128,0.12)` in light — exactly `--docket-fill` in each theme. Both themes were
toggled via LearningSuite's own real Preferences radios, never simulated, and restored
afterwards. Before/after screenshots (both themes, dropdowns open, prefs open) are in
`tools/shots/` (00–12). `npm run typecheck` and `npm test` (13/13) pass; as always, they
cover adapter/detection logic only — the CSS additions above have no automated coverage and
were verified live, visually, and via computed styles.

**Still open after this pass:** the never-audited page types (Email, Exams, Syllabus, the
real Announcements page, Schedule's Table/Calendar views and their Vue mini-calendar
widget, Groups, Library Resources, Class Info, Copyright Resources, Prioritizer, Grade
Summary, What If Calculator — the latter likely the next good, bounded target for native
number inputs); the Grades "Course Progress" stat panel (still no non-generic hook — do not
invent a structural selector); the sitewide `.hover\:bg-accent` question; and the real
Safari Userscripts install flow (unchanged, see below).

## Third live pass: theme correctness + real canvas/sidebar unity (Sep 2026)

A design review tested the second-pass build live (real account, Chrome, both LearningSuite
themes) and found it still read as "LearningSuite with a dark theme," plus a reproducible
bug making pages nearly illegible. Root causes, all confirmed against the real DOM before
being fixed (not guessed):

1. **Theme detection bug, reproduced and fixed.** `applyTheme()` OR'd LearningSuite's own
   `html.dark` class with `prefers-color-scheme`. Live repro: LearningSuite in native light
   mode (`html.className === "h-full"`) with the OS set to dark painted this reskin's dark
   canvas over LearningSuite's light content — white-on-white, beige-on-black. Confirmed live
   that the `dark` class is *always* present-or-absent (never ambiguous), so there is nothing
   for `prefers-color-scheme` to be a fallback for — it's now never consulted. Also added a
   second `MutationObserver` watching `class` attribute changes on `<html>` (the original one
   only watched `body` childList/subtree, so flipping LearningSuite's own toggle didn't
   re-trigger anything until an unrelated content mutation happened to fire).
2. **Settings/Diagnostics panels now thread the page's real theme explicitly** — the shadow
   host gets `data-docket-theme`/`data-docket-reduced-motion` attributes copied from the exact
   values `applyTheme()`/`runAdapters()` just computed on `<html>`, and `panel.css` keys off
   those instead of its own independent `prefers-color-scheme` query.
3. **The "one canvas" seam, root-caused via live DOM audit, not guessed.** Confirmed live
   (both themes): each sidebar row (Dashboard/Announcements/Assignments/...) is wrapped in a
   `<div class="navItem ... bg-primary lg:bg-base ...">` one level inside the `<nav>` this
   reskin restyles — the SAME shade `.bg-base` gives the header, distinct from `<nav>`'s own
   `.bg-left-nav` shade — so every row painted as its own mismatched solid box. Separately,
   `<nav>` itself carries `.bg-left-nav`, which the old canvas rule flattened to solid opaque
   `--docket-canvas`, `!important`-clobbering `.docket-nav-enhanced`'s own translucent
   material (also non-`!important`, so it always lost). Fixed: `.bg-left-nav` no longer
   appears in global.css's canvas group (body still gets canvas via the bare `body` selector);
   `nav .navItem` is forced transparent; `.docket-nav-enhanced` gets its own
   `!important` translucent background. Result: header/top-tabs/sidebar/main all read as one
   canvas, with the sidebar as a genuine translucent material panel, not an accidental
   mismatch — verified with zoomed screenshots in both themes, no visible seam.
4. **Sidebar active-row pill was silently dead on every page, confirmed live and fixed.**
   Every page carries `<base href="/">`; `restyleNav()`'s active-item check resolved each
   link's `href` against `location.href` (not the page's actual base), which for these
   relative, no-leading-slash hrefs produced a doubled-up, nonsensical path that could never
   match `location.pathname` — so `.docket-nav-item-active` never applied, on any page, ever.
   Fixed by resolving against `document.baseURI` instead; confirmed live the correct item
   (e.g. "Assignments" on the Assignments page) now gets the blue pill.
5. **Badge urgency bands**: `dueBadge()` only had two bands (overdue/red, ≤1 day/orange,
   everything else gray) — a card due in 2 days and one due in 105 days looked identical.
   Now five bands (red / red-orange / orange / yellow / neutral gray), verified visually.
6. **Assignments cards now show each category's "% of grade"** (read off the same category
   header LearningSuite itself shows it on, `children[2]`'s "of Grade: NN%" text) in the card
   subtitle — confirmed live against a real weighted-category course.
7. **`reducedMotion` wired up**: a real "Reduce Motion" switch now exists in Settings: writes
   `data-docket-reduced-motion` onto `<html>` (main page) and onto each panel's shadow host,
   both consumed by CSS rules that zero out transition/animation duration. Verified live that
   toggling it actually changes a live element's computed `transitionDuration`.

All of the above were verified against a real, authenticated `learningsuite.byu.edu` account
(Chrome browser automation — Safari's Userscripts app itself still not exercised, see below)
across Dashboard, Course List, and Assignments, in both LearningSuite's native light and dark
modes (toggled via LearningSuite's own real Preferences control, not simulated), including the
native "back to card view" → real native detail panel fallback.

## Second live pass: from "islands" to a full-page skin (Sep 2026)

The first live pass (below) built isolated widgets (course grid, assignment cards) but left
LearningSuite's own header, sidebar, top tab bar, and typography completely untouched —
real user feedback against actual screenshots: "most of the website looks the exact same...
just a big black box in the middle." Two root causes, both fixed:

1. **Inserted content painted its own opaque background** (`--docket-bg`, solid black/white)
   next to LearningSuite's own differently-colored chrome, reading as a mismatched box
   rather than blended content. Fixed: `.docket-page` is now transparent; cards use a
   translucent overlay tint (`--docket-bg-elevated`) that reads as "slightly raised" against
   whatever is actually behind it, and a new `--docket-canvas` token is instead applied
   *globally* (`src/styles/global.css`) to LearningSuite's own real chrome containers
   (`body`, `header`, `.bg-left-nav`, `.bg-top-nav`, `.bg-header`) so the whole page shares
   one background rather than several native panels each keeping their own slightly
   different gray.
2. **Only two components were ever restyled** (the sidebar nav, and whatever a page adapter
   inserted) — everywhere else kept LearningSuite's native look entirely. Fixed with
   `src/styles/global.css`, a sitewide stylesheet that remaps LearningSuite's own real
   Tailwind-esque utility classes (confirmed live: `text-primary`, `text-primary-alt`,
   `text-action`, `text-highlight`, `text-info`, `.goBtn`, `.bg-action`, `.bg-accent`,
   `.bg-gray1`, `[class*="border-gray"]`) onto the Apple palette, plus a new
   `restyleTopTabs()` in `adapters/shell.ts` for the course-level tab strip
   (`.bg-top-nav` — Home/Content/Exams/Grades/Schedule/Syllabus), styled as an
   Apple-tab-bar underline instead of LearningSuite's solid highlight block. This means
   pages with no dedicated adapter (Dashboard, Grades, Announcements) now still look
   visually consistent with the ones that do, even though their layout/structure isn't
   restructured — closing most of the "looks like the original site" gap without needing a
   bespoke adapter for every single page.

Also fixed while investigating: confirmed live that LearningSuite has its own independent
dark-mode toggle (`html.dark`), unrelated to the OS `prefers-color-scheme` — a user could
have either in either state. `applyTheme()` now checks LearningSuite's own class first
(falling back to the OS preference only if that gives no signal), and re-checks it on every
adapter pass, not just at boot, in case the user flips LearningSuite's own toggle at runtime.

Deliberately NOT touched: bare `<button>` (breaks dropdown-trigger menus that reuse the tag
with no background styling) and bare `.bg-base` (reused for both header/panel chrome AND
highlighted table rows — see `assignmentsAdapter.ts`'s own selector — so a blanket override
would erase a real visual signal elsewhere). See `global.css`'s own file comment.

**Not yet re-verified after this pass**: the Combined Schedule (Today/Upcoming) adapter
against the new global stylesheet, and a full contrast/accessibility check of the remapped
utility-class colors across pages this session didn't visit (Grades, Announcements, Files,
Email, etc. all inherit the global pass but weren't individually screenshotted).

## First live pass: verified live (Sep 2026, real authenticated account, via Chrome browser
## automation —
## Safari's Userscripts app itself was not exercised, only the code that would run inside it)

Since Safari automation wasn't available in that pass, the built bundle was injected
directly into a live, authenticated `learningsuite.byu.edu` tab (Chrome). This is not a
substitute for a real Userscripts install — it validates the adapter/selector logic itself,
not the Safari extension install/update flow (still open, see below).

- **A real, load-bearing DOM-drift bug found and fixed**: the Course List page no longer
  renders course rows as `a[href*='cid-']` anchors — confirmed live, each row is now a Vue
  `<p class="cursor-pointer">` with a click handler and no static href anywhere in the row
  (the courseID only appears in the resulting URL, `cid-{id}/student/home`, after the
  handler runs). Both `looksLikeCourseListPage()` (the adapter's own match gate — this part
  silently made the adapter never even attempt to mount) and `courseListAdapter`'s
  extraction/card logic were fixed to detect and handle this shape, with the old
  anchor-based shape kept as the first-choice fallback. `courseCard` now supports both a
  real `href` and an `onActivate` click-through (re-firing the original row's own handler)
  — verified live end-to-end, including that clicking a card navigates to the correct real
  course. This means the main Docket project's `src/connectors/bookmarklet.ts`
  (`courseListExtractorSource()`), which assumes the same now-stale anchor shape, is very
  likely also broken against the current live site — flagged for that project separately,
  not fixed here since it's a different codebase/deliverable.
- **Assignments page selectors confirmed still accurate as-is**: `main .bg-base.text-highlight`
  (rows) and `main .lineHeight > div.cursor-pointer` (category headers) both matched real
  live rows/categories correctly, including due date parsing, category attribution, and
  completion status — no changes needed there.
- **The nav-restyle heuristic (`shell.ts`'s `restyleNav()`) works on the real DOM**:
  `document.querySelector('nav')` does find LearningSuite's actual primary sidebar
  (confirmed via live inspection), and the `docket-nav-*` classes/computed styles apply
  correctly — the "unconfirmed selector" gap below is resolved for the common case, though
  visual impact is subtle since LearningSuite's own dark background is already close to the
  reskin's sidebar-material color.
- **A second real bug found and fixed**: `resetDiagnostics()` (called on every
  mutation-triggered `runAdapters()` pass, not just page load) was unconditionally clearing
  `shellMounted` back to `false`, even though `mountShell()` only runs once at boot — the
  Diagnostics panel would misreport "Navigation shell: Not applied" after the very first DOM
  mutation on a page, despite the nav restyle still actually being in effect. Fixed by no
  longer resetting that one field on each pass.

## Done (this pass)

- Build pipeline (`build.mjs`, esbuild) producing one Safari-userscript file with a valid
  `// ==UserScript==` metadata block, `@match`-scoped to `learningsuite.byu.edu` only.
- Page detection (`src/core/pageDetector.ts`) — DOM-signature-first, matching the same
  validated approach `src/connectors/bookmarklet.ts` already uses, since only two URL shapes
  are actually confirmed live (course-scoped `cid-{id}` pages, and Combined Schedule's
  `/top/schedule`).
- Apple-HIG-styled design tokens (`src/styles/tokens.css`) — system colors, grouped-list
  cards, a restyled nav bar, dark mode via `prefers-color-scheme` + an explicit override.
- Adapters: Course List → card grid, Assignments → grouped card list (real due date/
  category/completion), Combined Schedule List view → Today/Upcoming agenda.
- Settings (appearance, Companion nav on/off, Compatibility Mode) persisted on-device
  (`GM_getValue`/`GM_setValue`, falling back to `localStorage`), plus an in-page Diagnostics
  view.
- jsdom-backed tests against sanitized fixtures for page detection and all three adapters.

## Not built yet, deliberately left untouched (spec: fail soft, never a fabricated page)

- **Grades** — no adapter registered; LearningSuite's own Grade Summary page renders as-is.
- **Announcements** — same; `src/connectors/learningSuiteSessionConnector.ts` in the main
  project is *also* still an unimplemented skeleton for this, so there's no validated
  selector set yet to build an adapter against.
- **A dedicated calendar view** — the Today/Upcoming agenda (from Combined Schedule's List
  view) covers the "what's due soon" need; a month-grid calendar view is a separate,
  larger adapter not attempted yet.

## Known gaps to close next

- **The Combined Schedule (Today/Upcoming) adapter has not been checked against the live
  site yet** — only Course List and Assignments were verified live this pass. Its selectors
  (`a.cursor-pointer.block.truncate`, `.listViewDay`) are unchanged from
  `scheduleExtractorSource()`'s own "confirmed live" claim, but that claim predates this
  session and hasn't been re-checked against the current DOM the way Course List's
  (wrongly) was assumed to still hold.
- **The actual Safari + Userscripts install/update flow is still unverified** — everything
  above was checked by injecting the built bundle directly into a live Chrome tab, not by
  installing it through the real Userscripts app. The `@updateURL` update-check UX and
  `GM_getValue`/`GM_setValue` sync-vs-async behavior (see `src/lib/storage.ts`'s defensive
  handling either way) both still need a real on-device pass.
- **Submission/quiz/grade flows themselves weren't exercised** — the live pass confirmed
  read-only rendering and real navigation (clicking a course card correctly lands on that
  course's real dashboard), not that a form submission or quiz-start flow is unaffected by
  the reskin being active on that page. Low risk given nothing is ever deleted or replaced,
  only hidden/wrapped, but not yet actually clicked through.

## Longer-term (from the original spec, not started)

- Grades/Announcements/Calendar adapters, once their selectors are captured live.
- Visual regression screenshots (desktop/iPhone/iPad × light/dark).
- A packaged Safari Web Extension as a possible future upgrade path — not required to meet
  the $0/no-resigning bar, since the userscript approach already does, but could reduce
  reliance on a third-party extension if ever justified by a real limitation encountered in
  practice.
