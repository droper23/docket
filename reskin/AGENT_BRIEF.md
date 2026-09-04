# Brief: finish the Apple-HIG reskin + write a cross-browser/mobile install README

Copy this whole file as your prompt. You are a fresh agent with no memory of prior
sessions — everything you need is either in this file or in the repo files it points to.
Read them before writing any code.

## What this project is

`reskin/` inside `/Users/derek/Code/School/learningsuite-project` is a userscript that
visually re-skins BYU LearningSuite (`learningsuite.byu.edu`) to look like an app Apple
designed — system colors, grouped lists, translucent materials, real dark mode — while
LearningSuite itself keeps doing everything it already does (sign-in, submitting
assignments, grades, everything). This is a CSS/DOM overlay only, never a reimplementation.

**Read these in full before touching anything:**
- `reskin/README.md` — architecture, install/dev loop, current (incomplete) install docs
- `reskin/ROADMAP.md` — three prior "confirmed live" passes, each documenting exactly what
  was verified against the real site and why. Read all three; they explain *why* the code
  looks the way it does, and repeat their own reasoning rather than re-deriving it
- `docs/THREAT_MODEL.md` (repo root) — the non-negotiable security posture, see below
- Every file under `reskin/src/` — it's a small codebase (~15 files), read all of it, not
  just the ones you think you'll touch

## Two deliverables

1. **Extend the reskin to the LearningSuite surfaces that still aren't touched** — the top
   bar's own dropdown panels, remaining font coverage, and every page type nobody has
   audited yet (Email, Exams, Syllabus, Announcements, Schedule/Calendar, Groups, Library
   Resources, Class Info, Copyright Resources, Prioritizer, Grade Summary, What If
   Calculator). See "What's not done yet" below for specifics and suggested strategy.
2. **Write a real README section covering install on every browser and on mobile** —
   desktop Safari (partially documented already), desktop Chrome/Firefox/Edge (briefly
   documented already), iOS/iPadOS, and Android. See "The README" below for what's
   confirmed vs. what you need to verify yourself before writing it down.

Do both. Neither is optional. If you only have time for one, do #1 first — the README is
useless if the thing it's installing doesn't work.

## Non-negotiable constraints (violating any of these is a regression, not a improvement)

From `docs/THREAT_MODEL.md`, and from this project's own established discipline (read
`global.css`'s file-header comment — it explains this in its own words):

- Never `innerHTML` any LearningSuite-derived string (a course name, a link, anything read
  off the page). `src/lib/dom.ts`'s `h()`/`svgIcon()` + `textContent` only.
- Never contact any host but `learningsuite.byu.edu`. No analytics, no backend, no CDN.
- **Every CSS selector in `global.css`/`navigation.css` must target a class name you have
  personally confirmed live against the real site.** Never guess. Never use a bare `*`
  selector. Never write a bare `<button>` or `<select>` rule — LearningSuite reuses `button`
  for unstyled dropdown triggers (turning all of them into filled pills breaks menus), and
  no confirmed-safe `<select>` has been found yet anywhere on the site. If you can't confirm
  a selector live, don't ship a rule for it — leave it and note the gap in ROADMAP.md instead.
- Every adapter (`src/adapters/*.ts`) must fail soft: if `mount()` throws, the registry in
  `src/index.ts` unmounts it and leaves LearningSuite's native UI completely untouched.
  Never let a broken adapter partially wreck a page.
- Compatibility Mode (the Settings-panel toggle) must keep working as a full escape hatch
  back to native LearningSuite layout, on every page you touch.
- `@match` in `build.mjs` stays scoped to `https://learningsuite.byu.edu/*` only.
- Never reimplement a real LearningSuite action (submit, grade calc, navigation) — UI
  polish only; the actual behavior always stays LearningSuite's own code path.

## What's already done (don't redo, don't contradict)

Confirmed live, current as of the last pass:

- **Adapters** (`src/adapters/registry.ts`): `courseListAdapter` (Course List → card grid),
  `assignmentsAdapter` (Assignments page + the Grades page's identical-markup table both
  now correctly get the right treatment — see `src/core/pageDetector.ts`'s
  `looksLikeAssignmentsPage()`, which explicitly excludes Grades via LearningSuite's own
  active-top-tab signal, `.bg-top-nav-highlight`), `homeAdapter` (Combined Schedule List
  view → day-grouped agenda). No other page has a JS adapter, and that's deliberate — see
  "strategy" below for why before you consider adding one.
- **Sitewide CSS remap** (`src/styles/global.css`) covers, on every page, not just adapted
  ones: canvas unification (`body`, `header`, `.bg-top-nav`, `.bg-header`), the sidebar
  `<nav>`'s per-row native fill (`.navItem`), `h1`–`h3`, LearningSuite's real text-color
  utility classes (`.text-primary`/`-primary-alt`/`-action`/`-highlight`/`-info`),
  `.bg-accent`/`.bg-gray1` (category header bars), `.goBtn`/`.bg-action` (real action
  buttons, with a `:focus-visible` ring), the border-color family
  (`border-gray*`/`.border-light`/`.border-info`/bare `.border`), the
  `.bg-base.text-highlight` highlighted-row combo (rounded + hover fill — this is what
  makes the native Grades AND Assignments tables both look like a grouped list), and
  instructor-authored rich text (`.instructorText.font-nunito` → the Apple font).
- **Native form controls**: `input[type=radio]`/`input[type=checkbox]` are fully re-skinned
  (`src/styles/navigation.css`) with a `:focus-visible` replacement ring — this was, as of
  the last pass, the *only* confirmed native `appearance:auto` control anywhere on the site.
- **A real icon system**: `src/components/icons.ts` has 21 stroke icons + a
  `navIconByLabel` lookup table, matched against a nav link's own real `textContent` in
  `src/adapters/shell.ts`'s `restyleNav()` (decorative only, never a fabricated
  destination, graceful no-icon fallback). Covers every sidebar/sub-nav/top-tab label
  confirmed live so far (Dashboard, Announcements, Assignments, Learning Outcomes, Email,
  Library Resources, Groups, Class Info, Course List, All Courses, Combined Schedule,
  Schedule, Prioritizer, Grade Summary, Grades, Grade Scale, What If Calculator, Copyright
  Resources, Content, Exams, Syllabus, Home).
- **Real material depth**: `tokens.css`'s `--docket-shadow` is a two-layer shadow (tight
  contact + soft ambient) plus a `--docket-highlight` glass-edge inset border, applied to
  every card/group/nav/fab surface, with spring-ish `cubic-bezier(0.16,1,0.3,1)` transitions
  replacing flat `ease`.
- **Theme correctness**: `src/index.ts`'s `applyTheme()` trusts *only* LearningSuite's own
  `html.dark` class (never `prefers-color-scheme` — that was a confirmed live bug, now
  fixed), with a `MutationObserver` on `<html>`'s `class` attribute so toggling
  LearningSuite's own Dark Mode switch is caught instantly. Settings/Diagnostics panels
  (Shadow DOM) thread that same resolved theme explicitly rather than using their own
  `prefers-color-scheme` query.
- **Settings**: `appearance`, `useCompanionNav`, `compatibilityMode`, `showUpcomingOnHome`,
  `reducedMotion` — all wired end-to-end (the switch, the storage, and a real CSS effect).

## What's NOT done yet

Everything below was either explicitly flagged as out-of-scope in the last pass (because no
confirmed-safe selector existed yet) or was simply never visited. None of it has been
live-audited with the specificity this project requires — that audit is your first step for
each item, not something you can skip by reading this brief.

**Top bar (explicitly named as a gap by the person who requested this pass):**
- The course/term switcher dropdown panel (the popup that opens from "FALL 2026 · EC EN
  224 – Introduction to Computer Sys ▾" in the header) — confirmed last pass to have a real
  `.border-info` class (already remapped to the separator color), but its *background*,
  *shadow*, and *border-radius* were never confirmed or styled. Right now it's very likely
  rendering as an unstyled native dropdown sitting on top of an otherwise-reskinned page —
  exactly the kind of visible seam this project has spent three passes eliminating
  elsewhere. Audit its real DOM (`document.querySelector` from the live page, not a guess)
  and give it the same translucent-material treatment `.docket-nav-enhanced` already gets.
- The account/avatar dropdown menu (Messages / Preferences / Help / Logout, opened from
  the user's name top-right) — same treatment needed; audit first.
- The "ALL COURSES ▾" dropdown on the top-level Course List page (a different page context
  from the course-scoped term switcher above — confirm whether it's the same component or
  a different one before assuming one fix covers both).

**Fonts:** only `body`, `h1`–`h3`, `.bg-action`/`.goBtn`, and `.instructorText.font-nunito`
have confirmed font-family overrides. A live census on the Grades page found LearningSuite's
own branded font-family class (`.font-metro`) only appears on 4 elements sitewide (all
already covered) — but that census was done on exactly one page (Grades). It has not been
repeated on any of the untouched page types below. Do that census on each new page you
touch: `document.querySelectorAll('[class*="font-"]')`, check what's rendering in a
non-Apple font, find its real class, remap it in `global.css` next to the existing font
rules (don't invent a new file section for this — extend the existing pattern).

**Page types never live-audited at all:** Email, Exams, Syllabus, Announcements (the real
one — not the Dashboard's schedule-derived agenda), Schedule in Table/Calendar view (the
mini-calendar-with-dots sidebar widget + the day-by-day table — confirmed last pass to be
custom Vue components with no confirmed stable class names; this is real, not laziness —
verify selectors before writing any CSS for it), Groups, Library Resources, Class Info,
Copyright Resources, Prioritizer, Grade Summary, What If Calculator (this one almost
certainly has real `<input type="number">` or similar grade-simulation fields — a good,
bounded, safe target once confirmed, same reasoning as the radio/checkbox work).

**The native "Course Progress" stat panel** on Grades (Current Progress / Total Course
Progress numbers) — confirmed last pass to have no distinctive class
(`py-3 flex justify-between border-b text-lg gap-2 px-4`, pure generic Tailwind utilities).
It improves incidentally from the border/font work but has no bespoke "big stat number"
treatment. Only add one if you find a real, confirmed, non-generic hook — don't invent a
structural selector (like `nth-child`) that could silently break if LearningSuite reorders
its own markup.

**The Preferences dialog's own outer chrome** (the modal itself, not the radios inside it,
which are already done) — flagged as a good idea last pass but never confirmed live. Find
its real wrapper class before giving it sheet-style rounding/shadow.

## Strategy (what actually worked in prior passes — follow this, don't reinvent it)

1. **Live-audit before you write a single selector.** This project has browser automation
   tooling available (in Claude Code, the `claude-in-chrome` MCP tools — `tabs_context_mcp`,
   `navigate`, `javascript_tool`, `computer` for screenshots). Log into a real
   `learningsuite.byu.edu` account, navigate to the page you're working on, and run small
   `javascript_tool` snippets to dump real class names, computed styles, and DOM structure —
   exactly like `document.querySelectorAll('.font-metro')` or checking `el.className` on
   the specific element you're about to target. Never write a CSS rule for a class name you
   haven't seen in a real query result this session.
2. **To test the built bundle live**, since Safari's Userscripts app can't itself be
   automated: run `npm run build`, read the resulting `dist/learningsuite-reskin.user.js`,
   strip the `// ==UserScript==` metadata block (everything before the `"use strict";`
   line), and `javascript_tool`-eval the rest directly into a live authenticated tab. This
   is exactly how every prior pass validated its work — it's not a hack, it's the
   established loop. Re-inject after every full-page navigation (LearningSuite reloads
   between top-level sections, which wipes injected JS).
3. **Prefer CSS-only fixes over new JS adapters.** A new adapter (restructuring a page into
   cards) is only appropriate when the DOM shape is confirmed stable *and* not
   instructor-authored freeform content. Content/Announcements/Syllabus were confirmed last
   pass to be arbitrary instructor-authored rich text (`.instructorText` blocks with
   unpredictable nested structure) — not safe to restructure, CSS-only font/color/spacing
   harmonization is the ceiling there. The Schedule Calendar widget is a custom Vue
   component with unconfirmed internals — audit thoroughly before deciding whether a CSS
   pass is even safe, let alone an adapter.
4. **When you extend `global.css`, match its existing voice**: a comment explaining what
   you confirmed live and why the selector is scoped the way it is, cross-referencing other
   files the way the file already does (e.g. its own comment about why `.bg-base` alone is
   deliberately never touched). A reviewer with zero context should be able to read your
   comment and know it's not a guess.
5. **Any new page-detection logic** (a new adapter, or a change to when the sidebar/top-tab
   restyling applies) needs a fixture-based regression test in `test/pageDetector.test.ts`
   or `test/adapters.test.ts`, following the existing pattern (see the Grades/Assignments
   collision test already there as a template).
6. **Update `ROADMAP.md`** with a new "Nth live pass" section in the same style as the
   three that already exist — what you found, what you fixed, what's still a known gap
   after your pass. This is how the project accumulates trustworthy history instead of
   each pass re-litigating the last one's claims.

## Verification (definition of done)

1. `cd reskin && npm run build && npm run typecheck && npm test` — all passing. Note in
   your final report that this covers adapter/detection *logic* only; CSS-only changes have
   zero automated coverage in this repo, so say so explicitly rather than implying test
   passage proves the visual work.
2. Live screenshots (both LearningSuite native themes — toggle via the real Preferences
   dialog, not simulated) of every page you touched, before and after.
3. If you touched the top bar dropdowns specifically: screenshot them *open*, not just the
   trigger, in both themes.

---

## The README: install on every browser and on mobile

`reskin/README.md` currently documents desktop Safari (via the Userscripts app — this is
solid, keep it) and has a brief, likely-thin section on desktop Chrome/Firefox/Edge via
Tampermonkey/Violentmonkey. Neither iOS/iPadOS nor Android is documented at all. Write that
now, as a new section (or restructured section — use your judgment on the best structure,
but don't bury mobile as an afterthought; a lot of BYU students' primary device for this is
their phone).

**What's already confirmed for you (verified via web search near this brief's writing —
re-verify anything time-sensitive like store links or version numbers before publishing,
since this can drift):**

- **iOS/iPadOS: Safari + the Userscripts app remains the only real path.** Apple requires
  every iOS browser to use its WebKit engine and its own extension APIs — a non-Safari iOS
  browser cannot run a Safari userscript-manager extension. Orion (Kagi's browser) has
  *preliminary* Chrome/Firefox extension support on iOS/iPadOS and reportedly lists some
  form of userscript manager among its extensions, but this is new and less established
  than Safari + Userscripts — worth a "if you want to try something newer" footnote, not
  the primary recommendation, unless you personally verify it works well for this script.
- **Android has two real, current options, not one:**
  - **Firefox for Android (v110+)** now supports Tampermonkey *and* Violentmonkey as real
    extensions, installed straight from `addons.mozilla.org` (the same add-on store as
    desktop Firefox, just filtered to Android-compatible extensions) — no sideloading, no
    special build. This is probably the simplest Android path to document as primary.
  - **Kiwi Browser** (a Chromium fork that supports real Chrome extensions on Android,
    unlike stock Chrome for Android) + Tampermonkey installed as an actual extension (not
    the separate, much more limited "Tampermonkey for Android" standalone app, which only
    runs scripts inside its own isolated WebView and cannot inject into any other browser —
    do not recommend that one).
  - Do **not** recommend the standalone "Tampermonkey" app from the Play Store by itself —
    confirm this distinction yourself before writing the README, since getting this wrong
    sends a student down a dead end.

**What you need to verify yourself, live, before publishing:**
- The exact current install steps for each path above (menu labels, button text, and
  screenshots if you're able to capture them change across app updates — describe the
  *flow*, don't just assert it works).
- Whether granting narrowest-permission ("only learningsuite.byu.edu", never "all sites")
  is expressible the same way in Kiwi/Firefox-Android's extension permission UI as it is in
  desktop Safari's — if the mobile UI doesn't offer per-site scoping the same way, say so
  plainly rather than implying parity with the desktop instructions already in the README.
- Whether `GM_getValue`/`GM_setValue` (which `src/lib/storage.ts` already falls back to
  `localStorage` for) behaves the same across these managers — the existing code should
  just work, but confirm you're not introducing a false claim either way.

**Strategy for writing this well:**
- Match the existing README's tone and structure — it already has good precedent (see the
  "Chrome, Firefox, Edge" section for the voice to extend, and the numbered desktop-Safari
  steps for the level of concreteness expected).
- Lead each platform section with the single recommended path, then a secondary option only
  if genuinely useful (don't list five options with no guidance — that's worse than one good
  one).
- Keep the "Turning it off" and "Compatibility Mode" guidance's spirit consistent across
  every platform section — a mobile user needs to know how to bail out just as much as a
  desktop one.
- If you cannot verify something live (e.g. you don't have access to an actual Android
  device/emulator), say so in your final report rather than writing confident-sounding
  install steps you didn't actually walk through. A wrong "confirmed" install guide is worse
  than an honest "untested, here's the documented flow" one.
