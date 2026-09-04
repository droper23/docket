// ==UserScript==
// @name         LearningSuite Reskin
// @namespace    https://github.com/droper23/docket
// @version      0.1.0
// @description  A visual/interaction layer over BYU LearningSuite, styled like an Apple-designed app. LearningSuite stays the real backend — nothing is replaced. See reskin/README.md.
// @author       Docket contributors
// @match        https://learningsuite.byu.edu/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/droper23/docket/main/reskin/dist/learningsuite-reskin.user.js
// @downloadURL  https://raw.githubusercontent.com/droper23/docket/main/reskin/dist/learningsuite-reskin.user.js
// ==/UserScript==

"use strict";
(() => {
  // src/styles/tokens.css
  var tokens_default = `/**
 * Apple Human Interface Guidelines system colors/materials/type scale \u2014
 * chosen per the project brief's closing line: "LearningSuite, if someone at
 * Apple had designed it," not a copy of Docket's own amber palette.
 *
 * Dark/light is resolved by src/index.ts, which always sets an explicit
 * data-docket-theme="dark"|"light" on <html> \u2014 never left to a bare
 * \`prefers-color-scheme\` media query. That's deliberate, not an
 * oversight: confirmed live that LearningSuite has its OWN independent
 * dark-mode toggle (\`html.dark\`, a manual per-site setting, not tied to the
 * OS setting at all) \u2014 trusting \`prefers-color-scheme\` alone meant this
 * reskin's colors could silently mismatch whatever LearningSuite itself was
 * actually displaying (e.g. this reskin painting a light theme while
 * LearningSuite's own page was dark, or vice versa). src/index.ts reads
 * that real signal first and only falls back to \`prefers-color-scheme\` when
 * the setting is "system" and LearningSuite gives no signal either way.
 *
 * \`--docket-bg-elevated\` (used for cards/groups) is a translucent overlay,
 * not a hardcoded hex, so a card reads as "slightly raised" against
 * whatever LearningSuite's own surrounding background actually is (also
 * confirmed live to be neither pure black/white nor Apple's own system
 * colors \u2014 LearningSuite uses its own dark grays, e.g. rgb(53,53,53) for
 * its page background) instead of imposing a competing, mismatched block
 * of solid color next to it. Everything is scoped under [data-docket-reskin]
 * plus a .docket-scope root class on every element this reskin actually
 * renders, so nothing here can ever apply to LearningSuite's own unrelated
 * markup \u2014 see spec \xA739 (no bare \`*\` rule, CSS isolation).
 */
[data-docket-reskin] {
  --docket-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
  --docket-font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  --docket-radius-sm: 8px;
  --docket-radius-md: 12px;
  --docket-radius-lg: 20px;

  --docket-blue: #007aff;
  --docket-red: #ff3b30;
  --docket-red-orange: #ff5c33;
  --docket-orange: #ff9500;
  --docket-green: #34c759;
  --docket-yellow: #ffcc00;
  /* Yellow itself is too low-contrast to read as badge TEXT on a light canvas (Apple never
     uses raw systemYellow as small text either) \u2014 this is the readable-as-text variant of
     the same hue, used only for .docket-badge-yellow's foreground color. */
  --docket-yellow-text: #9a6300;
  --docket-purple: #af52de;
  --docket-gray: #8e8e93;
  /* A tinted-alert fill, not a solid block \u2014 matches Apple's own system-yellow banner
     convention (e.g. Mail/Calendar's "low storage"/permission banners), used for
     LearningSuite's own native instructor-view banner (.bg-attention in global.css). */
  --docket-yellow-banner-bg: rgba(255, 204, 0, 0.15);

  /* The unified page canvas \u2014 applied globally (global.css) to LearningSuite's own chrome
     containers (header, both nav bars, body) so the whole page shares one background instead
     of each panel keeping its own slightly-different native gray. */
  --docket-canvas: #f2f2f7;
  /* An overlay tint, not a solid color \u2014 cards read as "slightly raised" against whatever
     --docket-canvas resolves to, without needing a second hardcoded shade to keep in sync. */
  --docket-bg-elevated: rgba(0, 0, 0, 0.045);
  --docket-sidebar-bg: rgba(246, 246, 246, 0.78); /* macOS sidebar material */
  --docket-label: rgba(0, 0, 0, 0.92);
  --docket-label-secondary: rgba(60, 60, 67, 0.6);
  --docket-label-tertiary: rgba(60, 60, 67, 0.3);
  --docket-separator: rgba(60, 60, 67, 0.29);
  --docket-fill: rgba(120, 120, 128, 0.12);
  /* Real elevation, not one flat blur: a tight contact shadow (surface meets canvas) layered
     under a soft, wider ambient shadow (surface floats above canvas) \u2014 the single soft blur
     this used to be read as a flat tinted box, not a raised one. */
  --docket-shadow: 0 1px 1px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.06), 0 10px 26px rgba(0, 0, 0, 0.08);
  /* A hairline "glass edge" highlight along a surface's top, the way Apple's own translucent
     materials catch light \u2014 combined with --docket-shadow via box-shadow's multi-value list. */
  --docket-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  color-scheme: light dark;
}

[data-docket-reskin][data-docket-theme="dark"] {
  --docket-blue: #0a84ff;
  --docket-red: #ff453a;
  --docket-red-orange: #ff6a4d;
  --docket-orange: #ff9f0a;
  --docket-green: #30d158;
  --docket-yellow: #ffd60a;
  --docket-yellow-text: #ffd60a;
  --docket-purple: #bf5af2;
  --docket-gray: #8e8e93;
  --docket-yellow-banner-bg: rgba(255, 214, 10, 0.16);

  --docket-canvas: #000000;
  --docket-bg-elevated: rgba(255, 255, 255, 0.08);
  --docket-sidebar-bg: rgba(255, 255, 255, 0.06);
  --docket-label: rgba(255, 255, 255, 0.92);
  --docket-label-secondary: rgba(235, 235, 245, 0.6);
  --docket-label-tertiary: rgba(235, 235, 245, 0.3);
  --docket-separator: rgba(255, 255, 255, 0.14);
  --docket-fill: rgba(255, 255, 255, 0.1);
  /* A dark shadow barely reads against the near-black canvas dark mode uses, so the
     highlight below (not this shadow) carries most of the actual depth cue here \u2014 the
     shadow stays for surfaces that end up elevated over something lighter than canvas
     (e.g. a card inside a card) and for parity with the light-mode token shape. */
  --docket-shadow: 0 1px 1px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4), 0 16px 40px rgba(0, 0, 0, 0.35);
  --docket-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .docket-scope * {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}
/**
 * The explicit user-facing "Reduce Motion" switch in Settings (settings.ts's
 * \`reducedMotion\`, threaded onto <html> as this attribute by
 * src/index.ts's runAdapters()) \u2014 distinct from the OS-level media query above, which
 * only reflects the system setting, not this reskin's own control. Both apply; either one
 * suppresses motion.
 */
[data-docket-reskin][data-docket-reduced-motion="true"] .docket-scope * {
  transition-duration: 0.001ms !important;
  animation-duration: 0.001ms !important;
}
`;

  // src/styles/global.css
  var global_default = "/**\n * Sitewide overrides applied directly to LearningSuite's OWN existing\n * markup and utility classes \u2014 not just the isolated widgets the adapters\n * insert. Confirmed live (Sep 2026) that a reskin touching only specific\n * inserted components reads as a patchwork (native chrome right next to\n * redesigned islands) rather than \"the whole page redesigned,\" which is\n * the actual goal here. Every selector below targets a real, observed\n * LearningSuite class name (its own Tailwind-esque design-system classes:\n * bg-left-nav, bg-header, bg-top-nav, text-primary, .goBtn, etc.) \u2014 never a\n * bare `*`/tag-only rule that could hit something unintended (spec \xA739).\n * `!important` is used deliberately throughout: these utility classes are\n * how LearningSuite itself sets color, so anything less specific loses.\n *\n * Deliberately NOT touched: bare `<button>` (LearningSuite reuses it for\n * dropdown triggers with no background styling \u2014 turning every one of\n * those into a filled pill would break the account/term-switcher menus,\n * not just improve buttons that actually look like buttons) and bare\n * `.bg-base` (reused both for header/panel chrome AND for highlighted\n * table rows \u2014 see adapters/assignmentsAdapter.ts's own selector \u2014 so a\n * blanket override risks erasing a real visual signal elsewhere).\n */\n\n/* Canvas: one consistent background across chrome that used to be several\n   slightly-different native grays. Body's background alone already reaches\n   the main content area (confirmed live: <main> itself has no background\n   of its own, it's transparent over body). `.bg-left-nav` is scoped with\n   `:not(.docket-nav-enhanced)` rather than excluded outright: the real\n   `<nav>` element (which gets `.docket-nav-enhanced` once mounted \u2014 see\n   restyleNav() in adapters/shell.ts) carries `.bg-left-nav` too and needs to\n   stay excluded so it keeps its own dedicated translucent sidebar-material\n   treatment in navigation.css instead of flattening to a plain canvas fill \u2014\n   but confirmed live (Sep 2026) that same class ALSO lands on a plain\n   sibling wrapper div (`<div class=\"bg-left-nav flex flex-col\">`) around\n   that nav, which a blanket exclusion let fall through to native fill: a\n   visible warm tan cast in light mode (rgb(230,219,206) vs. canvas\n   rgb(242,242,247)). The :not() lets that wrapper (and any other\n   `.bg-left-nav` element) take the flat canvas fill while the mounted nav\n   itself stays excluded. */\nhtml[data-docket-reskin],\n[data-docket-reskin] body,\n[data-docket-reskin] header,\n[data-docket-reskin] .bg-top-nav,\n[data-docket-reskin] .bg-header,\n[data-docket-reskin] .bg-left-nav:not(.docket-nav-enhanced) {\n  background-color: var(--docket-canvas) !important;\n}\n[data-docket-reskin] body {\n  font-family: var(--docket-font) !important;\n  color: var(--docket-label) !important;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n[data-docket-reskin] ::selection {\n  background-color: var(--docket-blue);\n  color: #fff;\n}\n\n/**\n * Confirmed live (Sep 2026, both themes): each sidebar row (Dashboard/\n * Announcements/Assignments/...) is wrapped in its own `<div class=\"navItem\n * ... bg-primary lg:bg-base ...\">`, one level inside the `<nav>`\n * restyleNav() enhances. That native fill (rgb(36,36,36) in dark mode,\n * rgb(255,255,255) in light \u2014 the SAME shade `.bg-base` gives the header,\n * distinct from the nav's own `.bg-left-nav` shade) painted every row as a\n * separate mismatched solid box floating inside the translucent sidebar\n * material below, instead of one continuous grouped list. Cleared so the\n * nav's own unified background (`.docket-nav-enhanced`) is the only fill\n * visible \u2014 matching Apple's own grouped lists, where individual rows carry\n * no background of their own, only hover/active state does (see\n * `.docket-nav-item:hover`/`.docket-nav-item-active` in navigation.css). */\n[data-docket-reskin] nav .navItem {\n  background-color: transparent !important;\n}\n\n/* Typography: LearningSuite's own headings carry no color utility class (its base\n   stylesheet sets a default) \u2014 reset to the Apple type scale/color directly. Explicit\n   sizes/tracking added on top of font-family/weight (Sep 2026 pass): native heading sizes\n   varied 24-28px page-to-page with no consistent hierarchy \u2014 Apple's own type scale is a\n   controlled ladder, not \"whatever the page happened to set\". */\n[data-docket-reskin] h1,\n[data-docket-reskin] h2,\n[data-docket-reskin] h3 {\n  font-family: var(--docket-font) !important;\n  font-weight: 700 !important;\n  color: var(--docket-label) !important;\n}\n[data-docket-reskin] h1 { font-size: 28px !important; letter-spacing: -0.02em; }\n[data-docket-reskin] h2 { font-size: 22px !important; letter-spacing: -0.01em; }\n[data-docket-reskin] h3 { font-size: 17px !important; }\n\n/**\n * Instructor-authored rich text (a Content page's file list, syllabus body text, etc.)\n * confirmed live to render inside `class=\"default-list default-table instructorText\n * font-nunito\"`. Scoped to the confirmed compound class, not a bare `.font-nunito`, since\n * only that combination was ever actually observed.\n *\n * Rendered as an inset light \"paper\" card rather than a themed surface (Sep 2026 fix) \u2014\n * confirmed live that instructor WYSIWYG content carries arbitrary inline color styles\n * (e.g. `style=\"color:#000000\"`, authored assuming a light page), which the original\n * font-only rule left to survive verbatim onto the near-black dark canvas: unreadable body\n * copy, not a cosmetic miss. Matches how Apple Mail/Notes handle pasted rich content \u2014 keep\n * it on the light background it was actually authored for, in both app themes, rather than\n * chasing every possible inline color an instructor might have set.\n */\n[data-docket-reskin] .instructorText.font-nunito {\n  font-family: var(--docket-font) !important;\n  background-color: #fff !important;\n  color: #1d1d1f !important;\n  border-radius: var(--docket-radius-md);\n  padding: 16px;\n  box-shadow: var(--docket-shadow);\n}\n\n/**\n * LearningSuite's own branded font class, `Metropolis`. An earlier census (Grades page\n * only) found just 4 sitewide elements carrying it \u2014 all already covered \u2014 so this rule\n * was deliberately absent. The Sep 2026 pass re-ran the census on Combined Schedule and\n * found 76 elements rendering Metropolis despite the `body` remap above: a class rule\n * always beats an *inherited* font, so every element carrying `.font-metro` directly kept\n * the native font no matter what `body` says. 75 of the 76 were already covered (`body`\n * itself + 74 `.bg-action` buttons); the one real gap was LearningSuite's\n * `button.bg-primary-dark` action buttons (the schedule page's \"+ Item\", the Preferences\n * dialog's \"Save\"). Rather than whack-a-mole, the class itself is remapped \u2014 it is\n * LearningSuite's own semantic \"this is branded UI text\" signal, confirmed identical in\n * class-string on both themes, and a blanket font remap cannot change layout behavior the\n * way a color/background remap could.\n */\n[data-docket-reskin] .font-metro {\n  font-family: var(--docket-font) !important;\n}\n\n/**\n * LearningSuite's own text-color utility classes \u2014 split into a static-by-default tier\n * and a genuinely-interactive tier (Sep 2026 fix; previously one blanket blue rule).\n * Confirmed live these classes wrap entire static panels natively, not just links/actions:\n * Preferences' plain field labels, a Grade Scale `<table>`'s every cell, empty-state\n * strings (\"No Announcements\") \u2014 none of that is tappable, so tinting all of it violated\n * Apple's own rule that tint color means \"this is interactive.\" Meanwhile the assignment\n * name inside each `.bg-base.text-highlight` row (see the grouped-list-row rule further\n * down) is a plain `<div class=\"clicky ...\">` \u2014 genuinely clickable (it's the row's real\n * navigation target) but carries none of these classes itself, so it kept LearningSuite's\n * own separate, un-remapped native blue instead of either tier. Default first, so a plain\n * `<div>`/`<td>` carrying one of these classes gets the neutral label color unless a real\n * interactive tag/class overrides it below (tag-qualified selectors are more specific than\n * the bare-class default, so this doesn't depend on source order). */\n[data-docket-reskin] .text-primary,\n[data-docket-reskin] .text-primary-alt,\n[data-docket-reskin] .text-action,\n[data-docket-reskin] .text-highlight {\n  color: var(--docket-label) !important;\n}\n[data-docket-reskin] a.text-primary,\n[data-docket-reskin] a.text-primary-alt,\n[data-docket-reskin] a.text-action,\n[data-docket-reskin] a.text-highlight,\n[data-docket-reskin] button.text-primary,\n[data-docket-reskin] .clicky {\n  color: var(--docket-blue) !important;\n}\n[data-docket-reskin] .text-info {\n  color: var(--docket-label-secondary) !important;\n}\n\n/* Native \"today\" marker on the course-scoped Schedule mini-calendar \u2014 confirmed live as\n   `div.bg-primary.hover:border-primary-alt` with hardcoded near-black text, a third,\n   un-remapped native blue (rgb(115,175,211)) distinct from both the app's own accent and\n   the tokens above. Apple Calendar's own \"today\" treatment is a solid tinted marker with\n   white text \u2014 matched directly rather than folding into the text-color rules above, since\n   this is a background utility, not a text one. Confirmed only on this one calendar widget\n   this pass; re-audit before assuming `.bg-primary` is safe to remap elsewhere. */\n[data-docket-reskin] .bg-primary {\n  background-color: var(--docket-blue) !important;\n  color: #fff !important;\n}\n\n/* Section/category header bars (e.g. a grade category's \"20% of grade\" strip) \u2014\n   give them the same subtle grouped-list-header treatment as everything else,\n   instead of leaving LearningSuite's own solid accent-color bar. */\n[data-docket-reskin] .bg-accent,\n[data-docket-reskin] .bg-gray1 {\n  background-color: var(--docket-fill) !important;\n  color: var(--docket-label) !important;\n}\n\n/* Real action buttons (submit/upload/etc.), the course-list \"Go\" button, and\n   LearningSuite's own `bg-primary-dark` action buttons (confirmed live Sep 2026: the\n   schedule page's \"+ Item\" and the Preferences dialog's \"Save\", both bare <button>s\n   with `hover:bg-primary-alt`). Scoped to the bare-button form deliberately: the same\n   live census found `.bg-primary-dark` ALSO fills the active top tab\n   (`a.bg-primary-dark.bg-top-nav-highlight`, owned by .docket-top-tabs' underline\n   treatment in navigation.css) and the Preferences dialog's accordion headers (a <div>,\n   styled with the modal chrome below) \u2014 a blanket class rule would have fought both.\n   Never bare `button` for dropdown triggers \u2014 see the file comment. */\n[data-docket-reskin] .goBtn,\n[data-docket-reskin] .bg-action,\n[data-docket-reskin] button.bg-primary-dark {\n  font-family: var(--docket-font) !important;\n  border-radius: var(--docket-radius-sm) !important;\n  background-color: var(--docket-blue) !important;\n  color: #fff !important;\n  border: none !important;\n  font-weight: 600 !important;\n}\n[data-docket-reskin] .goBtn:hover,\n[data-docket-reskin] .bg-action:hover,\n[data-docket-reskin] button.bg-primary-dark:hover {\n  filter: brightness(1.12);\n}\n/* No selector here previously defined a keyboard-focus ring at all (only :hover) \u2014 added\n   directly next to the rule that owns each selector, never a separate blanket `*` rule. */\n[data-docket-reskin] .goBtn:focus-visible,\n[data-docket-reskin] .bg-action:focus-visible,\n[data-docket-reskin] button.bg-primary-dark:focus-visible {\n  outline: 2px solid var(--docket-blue);\n  outline-offset: 2px;\n}\n\n/* Hairline dividers, softened to the Apple separator token instead of LearningSuite's\n   own higher-contrast gray borders. `.border-light` (confirmed live on each sidebar\n   `.navItem` row, rgb(109,108,109) natively \u2014 a much harder line than Apple's own\n   near-invisible hairlines) needs the same treatment as the `border-gray*` family.\n   `.border-info` (confirmed live: the course/term-switcher dropdown's own list border,\n   2 instances sitewide) and bare `.border` (confirmed live on e.g. the \"Course Homework\n   ID\" disclosure row \u2014 a plain gray in every sample checked, not a colored outline riding\n   on `currentColor`) join the same group; `.border` is the least-certain of the four here,\n   worth re-checking if a stray colored outline ever turns up gray after this ships. */\n[data-docket-reskin] [class*=\"border-gray\"],\n[data-docket-reskin] .border-light,\n[data-docket-reskin] .border-info,\n[data-docket-reskin] .border {\n  border-color: var(--docket-separator) !important;\n}\n\n/* Native instructor-view banner (confirmed live: `section.bg-attention`, a solid saturated\n   yellow rgb(255,243,130) sitting directly under the header on every page for an account\n   with instructor access) \u2014 the highest-visibility untouched native color found in the\n   Sep 2026 pass. Remapped to a translucent tinted-alert fill matching Apple's own\n   system-yellow banner convention (Mail/Calendar's own permission/storage banners), not a\n   solid block; its embedded link gets the same treatment as every other genuinely\n   interactive element (see the text-tint tier above). */\n[data-docket-reskin] .bg-attention {\n  background-color: var(--docket-yellow-banner-bg) !important;\n  color: var(--docket-label) !important;\n}\n[data-docket-reskin] .bg-attention a {\n  color: var(--docket-blue) !important;\n}\n\n/* Native `<table>` (e.g. Grade Scale) gets zero elevation/structure by default \u2014 raw grid\n   borders, 0 radius, sitting one tab away from the Assignments view's proper card-row\n   treatment above. Confirmed live (Sep 2026) across Grade Scale, What-If Calculator,\n   Content, Syllabus, Announcements, Email, Schedule, and Groups that the only `<table>`\n   elements sitewide are genuine tabular data (Grade Scale's grade/percent pairs) \u2014 no\n   layout-purposed table turned up, so a bare tag selector is safe here the way it isn't for\n   `<button>`/`<select>` (see the file comment at the top). Re-audit before assuming this\n   holds if a new page type is ever added to the adapter set. */\n[data-docket-reskin] table {\n  border-collapse: separate;\n  border-spacing: 0;\n  border-radius: var(--docket-radius-md);\n  overflow: hidden;\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  background-color: var(--docket-bg-elevated);\n}\n[data-docket-reskin] table td,\n[data-docket-reskin] table th {\n  border-color: var(--docket-separator) !important;\n}\n\n/**\n * Grouped-list-row polish for LearningSuite's own real highlighted table rows \u2014 confirmed\n * live this exact compound class (never bare `.bg-base`, which stays untouched per the file\n * comment above) renders identically on the native Assignments-page fallback table AND the\n * Grades page's default sub-view (see pageDetector.ts's looksLikeAssignmentsPage() for why\n * those two pages needed to be told apart at all), so this benefits both native tables at\n * once with no new adapter. The row itself is a plain `<div>` (confirmed live it's neither\n * an `<a>` nor `.clicky`, so it renders in the neutral label color via the text-tint tier\n * above \u2014 only the row's inner `.clicky` assignment-name div is genuinely interactive and\n * gets tinted); this rule adds the rounded/hover-fill treatment the rest of the redesign\n * already uses everywhere else, so a raw native table reads as the same grouped list\n * instead of a flat one.\n */\n[data-docket-reskin] .bg-base.text-highlight {\n  border-radius: var(--docket-radius-sm) !important;\n  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n[data-docket-reskin] .bg-base.text-highlight:hover {\n  background-color: var(--docket-fill) !important;\n}\n\n/**\n * LearningSuite's shared modal chrome \u2014 confirmed live (Sep 2026, dark theme, reskin\n * un-injected) hosting the Preferences dialog: a full-screen scrim `div.popupWrapper\n * .bg-blur` (native fill rgba(75,75,75,0.7) \u2014 note the class is NAMED \"bg-blur\" but its\n * computed backdrop-filter is `none`; the blur has to come from us) wrapping the sheet\n * `div.minMax.bg-base.height-Lg.overflow-hidden` (solid rgb(36,36,36), 0px radius, no\n * shadow). Scoped to the wrapper descendant so `.minMax` is never styled outside a modal\n * context (it has only ever been observed inside one, but the wrapper is the actual\n * shared component), and never via bare `.bg-base` \u2014 the file comment at the top explains\n * why that class stays untouched. The sheet itself gets the canvas token, not a\n * translucent material: a modal sheet floats over a dimmed, blurred page, and Apple's\n * own sheets are opaque surfaces whose depth cue is the shadow, not see-through glass\n * (translucent materials here would let the dimmed page bleed through the text).\n * `overflow-hidden` (part of the confirmed class string) clips children to the rounding.\n */\n[data-docket-reskin] .popupWrapper {\n  background-color: rgba(0, 0, 0, 0.35) !important;\n  backdrop-filter: saturate(180%) blur(20px);\n  -webkit-backdrop-filter: saturate(180%) blur(20px);\n}\n[data-docket-reskin] .popupWrapper .minMax {\n  border-radius: var(--docket-radius-lg) !important;\n  background-color: var(--docket-canvas) !important;\n  box-shadow: var(--docket-shadow);\n}\n/* The Preferences dialog's accordion section headers (\"General\", etc.) are confirmed\n   live to be `div.text-white.bg-primary-dark.px-4.py-2.cursor-pointer` \u2014 the same\n   native-accent-filled bar treatment `.bg-accent`/`.bg-gray1` already get above, and\n   deliberately the same: grouped-list section headers, not action buttons (which is why\n   the button rule above scopes itself to `button.bg-primary-dark`). Scoped to inside the\n   wrapper: if LearningSuite ever uses this pattern for page-level section headers\n   elsewhere, re-audit before extending the selector. */\n[data-docket-reskin] .popupWrapper div.bg-primary-dark {\n  background-color: var(--docket-fill) !important;\n  color: var(--docket-label) !important;\n}\n\n/* Preferences dialog's Cancel button \u2014 confirmed live class\n   `button.bg-base.border-info.text-info.font-metro` inside `.popupWrapper` (text/border\n   color and font already come free from the `.text-info`/`.border-info`/`.font-metro`\n   rules elsewhere in this file \u2014 only shape/fill were still fully native: 0 radius, solid\n   `.bg-base` gray, the same treatment the file comment at the top deliberately leaves\n   untouched sitewide). Sitting next to Save's full pill, that read as two different button\n   languages in one sheet \u2014 Apple's own sheets never vary corner radius/shape between\n   actions, only fill weight. Scoped to inside the dialog specifically (never bare\n   `.bg-base`), matching the accordion-header exception pattern just above. A \"Reset\"\n   control mentioned in an earlier review pass could not be reproduced live this session\n   (checked the General/Communication/Email accordion tabs) \u2014 not styled here; re-check if\n   one turns up on a tab not covered this pass. */\n[data-docket-reskin] .popupWrapper button.bg-base {\n  border-radius: var(--docket-radius-sm) !important;\n  background-color: var(--docket-fill) !important;\n}\n[data-docket-reskin] .popupWrapper button.bg-base:hover {\n  background-color: var(--docket-separator) !important;\n}\n\n/* `<iframe>` (e.g. Library Resources, confirmed live to embed `apps.lib.byu.edu` \u2014\n   cross-origin, no `@match`/`@grant` reaches inside it, and this pass isn't adding a second\n   match block for an unaudited third-party origin's markup). The interior stays fully\n   native; framing it from this side at least keeps the boundary consistent with every\n   other elevated surface instead of a stark unstyled rectangle. Confirmed live no other\n   `<iframe>` use needs different treatment this pass. */\n[data-docket-reskin] iframe {\n  border-radius: var(--docket-radius-md);\n  overflow: hidden;\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  border: none;\n}\n";

  // src/styles/typography.css
  var typography_default = "/* Apple's type scale (Large Title / Title / Headline / Body / Subhead / Footnote / Caption). */\n.docket-scope {\n  font-family: var(--docket-font);\n  color: var(--docket-label);\n  -webkit-font-smoothing: antialiased;\n}\n.docket-large-title { font-size: 34px; font-weight: 700; letter-spacing: 0.01em; margin: 0 0 4px; }\n.docket-title { font-size: 22px; font-weight: 700; margin: 0 0 2px; }\n.docket-headline { font-size: 17px; font-weight: 600; margin: 0; }\n.docket-body { font-size: 15px; font-weight: 400; line-height: 1.45; margin: 0; }\n.docket-subhead { font-size: 13px; color: var(--docket-label-secondary); margin: 0; }\n.docket-footnote { font-size: 12px; color: var(--docket-label-secondary); margin: 0; }\n.docket-caption { font-size: 11px; color: var(--docket-label-tertiary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }\n";

  // src/styles/layout.css
  var layout_default = ".docket-scope { box-sizing: border-box; }\n.docket-scope *, .docket-scope *::before, .docket-scope *::after { box-sizing: inherit; }\n\n.docket-page {\n  /* Deliberately no background here \u2014 confirmed live that painting one made this read as a\n     mismatched box sitting inside LearningSuite's own page rather than blending with it.\n     Individual cards/groups carry their own subtle elevated surface instead. */\n  padding: 28px 22px 60px;\n  max-width: 760px;\n  margin: 0 auto;\n}\n.docket-header { margin-bottom: 20px; }\n.docket-section { margin: 26px 0 10px; }\n.docket-day-header {\n  display: flex; align-items: baseline; gap: 8px;\n  padding: 4px 4px 8px;\n}\n.docket-day-count {\n  font-size: 12px; color: var(--docket-label-tertiary); font-weight: 600;\n}\n\n.docket-course-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 12px;\n}\n.docket-course-card {\n  background: var(--docket-bg-elevated);\n  border-radius: var(--docket-radius-md);\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  padding: 16px;\n  text-decoration: none;\n  color: inherit;\n  display: block;\n  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.docket-course-card:hover { background: var(--docket-fill); }\n.docket-course-card .docket-dot { margin-bottom: 10px; }\n\n.docket-toggle-original {\n  display: inline-flex; align-items: center; gap: 6px;\n  font-size: 13px; color: var(--docket-blue);\n  background: none; border: none; cursor: pointer; padding: 6px 2px; margin-top: 4px;\n}\n";

  // src/styles/navigation.css
  var navigation_default = '/**\n * Applied to LearningSuite\'s OWN existing top-level nav element in place\n * (see adapters/shell.ts) \u2014 never a fabricated replacement nav with guessed\n * routes. Styled like macOS\'s sidebar material / Reminders\' list switcher:\n * a translucent bar, pill-shaped active state, no invented icons on links\n * whose destination we can\'t independently verify.\n *\n * `background-color` (not the `background` shorthand) with `!important`:\n * confirmed live this element also carries LearningSuite\'s own\n * `.bg-left-nav` utility class, which global.css deliberately leaves alone\n * for every OTHER `.bg-left-nav` element (body) so the plain sitewide\n * canvas rule doesn\'t apply here \u2014 but without `!important` here too, any\n * equal-or-higher-specificity native rule on the same element could still\n * win by source order. Both column layout (`nav`\'s own native `flex-col`)\n * and this vertical sidebar\'s row treatment below (`padding`/`gap` reused\n * as vertical spacing, since `.docket-nav-enhanced` never overrides\n * `flex-direction`) were confirmed live to already compose correctly \u2014\n * only the fill color was ever actually broken.\n */\n.docket-nav-enhanced {\n  display: flex !important;\n  gap: 2px;\n  padding: 6px;\n  background-color: var(--docket-sidebar-bg) !important;\n  backdrop-filter: saturate(180%) blur(20px);\n  -webkit-backdrop-filter: saturate(180%) blur(20px);\n  border-radius: var(--docket-radius-md);\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  font-family: var(--docket-font);\n  overflow-x: auto;\n}\n.docket-nav-enhanced .docket-nav-item {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px;\n  font-family: var(--docket-font) !important;\n  font-size: 13px !important;\n  font-weight: 590 !important;\n  color: var(--docket-label) !important;\n  text-decoration: none !important;\n  padding: 8px 12px !important;\n  border-radius: var(--docket-radius-sm) !important;\n  white-space: nowrap;\n  background-color: transparent !important;\n  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.docket-nav-enhanced .docket-nav-item:hover { background-color: var(--docket-fill) !important; }\n.docket-nav-enhanced .docket-nav-item-active {\n  background-color: var(--docket-blue) !important;\n  color: #fff !important;\n}\n/* Matched by real label text in shell.ts\'s restyleNav() \u2014 see icons.ts\'s navIconByLabel.\n   Secondary/muted at rest so the label text stays the primary read, full label color when\n   the row is active (inherits currentColor, so both states come free from .docket-icon\'s\n   own `stroke: currentColor`). */\n.docket-nav-enhanced .docket-nav-icon {\n  width: 16px !important;\n  height: 16px !important;\n  flex-shrink: 0;\n  color: var(--docket-label-secondary);\n}\n.docket-nav-enhanced .docket-nav-item-active .docket-nav-icon {\n  color: #fff;\n}\n\n/**\n * The course-level top tab strip (Home/Content/Exams/Grades/Schedule/\n * Syllabus, see adapters/shell.ts\'s restyleTopTabs()). LearningSuite fills\n * the active tab with a solid highlight color by default; this swaps that\n * for an Apple-tab-bar-style underline instead, on top of LearningSuite\'s\n * own real tabs/hrefs \u2014 never a replacement bar.\n */\n.docket-top-tabs .docket-top-tab {\n  font-family: var(--docket-font) !important;\n  font-size: 13px !important;\n  font-weight: 590 !important;\n  color: var(--docket-label-secondary) !important;\n  text-decoration: none !important;\n  background: transparent !important;\n  border-bottom: 2px solid transparent !important;\n  transition: color 0.16s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.docket-top-tabs .docket-top-tab:hover {\n  color: var(--docket-label) !important;\n}\n.docket-top-tabs .docket-top-tab-active {\n  color: var(--docket-blue) !important;\n  border-bottom-color: var(--docket-blue) !important;\n}\n\n.docket-floating-bar {\n  position: fixed;\n  bottom: max(18px, env(safe-area-inset-bottom));\n  right: 18px;\n  z-index: 2147483000;\n  display: flex;\n  gap: 8px;\n}\n.docket-fab {\n  width: 44px; height: 44px;\n  border-radius: 50%;\n  background: var(--docket-sidebar-bg);\n  backdrop-filter: saturate(180%) blur(20px);\n  -webkit-backdrop-filter: saturate(180%) blur(20px);\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  border: none;\n  display: flex; align-items: center; justify-content: center;\n  cursor: pointer;\n  color: var(--docket-label);\n  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.docket-fab:hover { background: var(--docket-fill); }\n.docket-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }\n\n/**\n * Real native form controls, not this reskin\'s own inserted markup \u2014 confirmed live the\n * only `appearance: auto` native controls anywhere on the site are `<input type="radio">`\n * in LearningSuite\'s own Preferences dialog (Display: Light/Dark/Attempt-to-detect/Classic\n * Mode) and, by the same tag, any native checkbox. This is a safe, bounded, unambiguous tag\n * selector \u2014 unlike bare `<button>`/`<select>` (deliberately never touched, see global.css\'s\n * own file comment), a radio/checkbox input only ever means "choose an option," never\n * "open a menu," so there\'s no risk of silently breaking an unrelated control.\n *\n * `appearance: none` also strips the browser\'s native focus ring, so a `:focus-visible`\n * replacement below is not optional \u2014 without one this would ship a real keyboard-\n * accessibility regression on the one native form control on the whole site.\n */\n[data-docket-reskin] input[type="radio"],\n[data-docket-reskin] input[type="checkbox"] {\n  appearance: none;\n  -webkit-appearance: none;\n  width: 20px;\n  height: 20px;\n  margin: 0;\n  flex-shrink: 0;\n  position: relative;\n  border: 1.5px solid var(--docket-label-tertiary);\n  background-color: var(--docket-bg-elevated);\n  cursor: pointer;\n  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);\n}\n[data-docket-reskin] input[type="radio"] { border-radius: 50%; }\n[data-docket-reskin] input[type="checkbox"] { border-radius: 5px; }\n[data-docket-reskin] input[type="radio"]:checked,\n[data-docket-reskin] input[type="checkbox"]:checked {\n  border-color: var(--docket-blue);\n  background-color: var(--docket-blue);\n}\n[data-docket-reskin] input[type="radio"]:checked::after {\n  content: "";\n  position: absolute;\n  top: 50%; left: 50%;\n  width: 8px; height: 8px;\n  border-radius: 50%;\n  background: #fff;\n  transform: translate(-50%, -50%);\n}\n[data-docket-reskin] input[type="checkbox"]:checked::after {\n  content: "";\n  position: absolute;\n  top: 2px; left: 6px;\n  width: 5px; height: 10px;\n  border-right: 2px solid #fff;\n  border-bottom: 2px solid #fff;\n  transform: rotate(45deg);\n}\n[data-docket-reskin] input[type="radio"]:focus-visible,\n[data-docket-reskin] input[type="checkbox"]:focus-visible {\n  outline: 2px solid var(--docket-blue);\n  outline-offset: 2px;\n}\n\n/**\n * Bare text-entry inputs \u2014 confirmed live (Sep 2026) the only `input` types anywhere on\n * the site are `text` (Email\'s "Select from Contacts"/"Add additional email addresses"\n * fields) and `number` (What-If Calculator\'s score fields; also checked Groups, Schedule,\n * Announcements, Syllabus, Content \u2014 no other input type turned up, so only these two are\n * targeted, not a guessed broader list). Both were fully native: sharp corners, native\n * fill, and \u2014 worse \u2014 the raw browser default focus outline, a THIRD focus-ring language\n * next to the correct one radios/checkboxes get above. Given the matching treatment here.\n */\n[data-docket-reskin] input[type="text"],\n[data-docket-reskin] input[type="number"] {\n  font-family: var(--docket-font) !important;\n  background-color: var(--docket-bg-elevated) !important;\n  border: 1px solid var(--docket-separator) !important;\n  border-radius: var(--docket-radius-sm) !important;\n  color: var(--docket-label) !important;\n  padding: 6px 10px;\n}\n[data-docket-reskin] input[type="text"]:focus-visible,\n[data-docket-reskin] input[type="number"]:focus-visible {\n  outline: 2px solid var(--docket-blue);\n  outline-offset: 2px;\n  border-color: transparent !important;\n}\n\n/**\n * Floating menu chrome \u2014 the top bar\'s own dropdown panels, confirmed live (Sep 2026,\n * dark theme, reskin un-injected) on the Combined Schedule page:\n *\n * - Account menu (Messages/Preferences/Help/Logout): container\n *   `div.header-userdropdown-dropdown` wrapping `ul ... bg-base border-info lg:rounded`\n *   (right-anchored at `lg:right-0 lg:mr-6`).\n * - Course/term switcher ("All courses" at top level; the identical component also serves\n *   the course-scoped term switcher \u2014 same container class, one fix covers both):\n *   container `div.header-coursedropdown-dropdown` wrapping `ul ... bg-base border-info\n *   sm:rounded`.\n *\n * Both panels rendered natively as a solid rgb(36,36,36) box, 4px radius, NO shadow and\n * NO backdrop blur sitting on top of an otherwise-redesigned page \u2014 the seam this pass\n * was opened to eliminate. The containers themselves stay untouched (zero-height\n * position-only wrappers; the `ul` does all the visual work). LearningSuite\'s own\n * `transition-all duration-100 origin-top` open/close animation on the `ul` is confirmed\n * live and deliberately NOT overridden \u2014 only fill/radius/shadow change here.\n *\n * Material: same translucent recipe as `.docket-nav-enhanced` above but more opaque\n * (menus float over arbitrary page content, not a sidebar\'s quiet edge), so text stays\n * readable in both themes. The first `background-color` declaration is a deliberate\n * fallback for engines without `color-mix` \u2014 such engines keep the previous opaque\n * canvas fill instead of an unreadably transparent menu. The glass-edge highlight rides\n * along in the same box-shadow list as everywhere else (--docket-highlight).\n */\n[data-docket-reskin] .header-userdropdown-dropdown > ul,\n[data-docket-reskin] .header-coursedropdown-dropdown > ul {\n  background-color: var(--docket-canvas) !important;\n  background-color: color-mix(in srgb, var(--docket-canvas) 85%, transparent) !important;\n  border-radius: var(--docket-radius-md) !important;\n  box-shadow: var(--docket-shadow), var(--docket-highlight);\n  backdrop-filter: saturate(180%) blur(20px);\n  -webkit-backdrop-filter: saturate(180%) blur(20px);\n}\n\n/**\n * Menu-row hover, scoped to the two confirmed surfaces (never sitewide): the header\n * dropdown rows are `li.pt-1.pb-1.hover:bg-accent` / `li.py-1.px-3.hover:bg-accent`, and\n * inside the Preferences sheet the timezone-picker options are\n * `div.cursor-pointer.text-primary.hover\\:bg-accent`. Natively the hover fill is\n * LearningSuite\'s accent color (var(--ac)); here it becomes the same neutral fill every\n * other hoverable row in the redesign uses. A sitewide `.hover\\:bg-accent` remap was\n * considered and deliberately deferred \u2014 it is a Tailwind-style utility that could sit on\n * unconfirmed non-menu elements; extend only after re-auditing wherever it next appears\n * (noted in ROADMAP.md).\n */\n[data-docket-reskin] .header-userdropdown-dropdown li.hover\\:bg-accent:hover,\n[data-docket-reskin] .header-coursedropdown-dropdown li.hover\\:bg-accent:hover,\n[data-docket-reskin] .popupWrapper .hover\\:bg-accent:hover {\n  background-color: var(--docket-fill) !important;\n}\n';

  // src/styles/cards.css
  var cards_default = `/* Apple "grouped list" idiom (Reminders/Settings/Mail): a rounded card containing
   hairline-divided rows, not Docket's individually-bordered tile cards. */
.docket-group {
  background: var(--docket-bg-elevated);
  border-radius: var(--docket-radius-md);
  box-shadow: var(--docket-shadow), var(--docket-highlight);
  overflow: hidden;
  margin-bottom: 20px;
}
.docket-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--docket-separator);
  min-height: 44px; /* Apple's minimum touch target */
  transition: background-color 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
.docket-group .docket-row:last-child { border-bottom: none; }
.docket-row-tappable { cursor: pointer; }
.docket-row-tappable:hover { background: var(--docket-fill); }
.docket-row-tappable:active { background: var(--docket-fill); }

.docket-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.docket-row-main { flex: 1; min-width: 0; }
.docket-row-title { font-size: 15px; font-weight: 600; color: var(--docket-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.docket-row-subtitle { font-size: 13px; color: var(--docket-label-secondary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.docket-row-trailing { flex-shrink: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--docket-label-secondary); }
.docket-chevron { width: 8px; height: 8px; border-top: 1.6px solid var(--docket-label-tertiary); border-right: 1.6px solid var(--docket-label-tertiary); transform: rotate(45deg); flex-shrink: 0; }

.docket-row-body { padding: 0 16px 14px 38px; font-size: 13px; color: var(--docket-label-secondary); line-height: 1.5; }
.docket-row-body p { margin: 0 0 8px; white-space: pre-wrap; }

.docket-link-chip {
  display: inline-block;
  font-size: 12px;
  padding: 4px 10px;
  margin: 0 6px 6px 0;
  border-radius: 999px;
  background: var(--docket-fill);
  color: var(--docket-blue);
  text-decoration: none;
}

.docket-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
}
.docket-badge-red { background: color-mix(in srgb, var(--docket-red) 16%, transparent); color: var(--docket-red); }
.docket-badge-red-orange { background: color-mix(in srgb, var(--docket-red-orange) 18%, transparent); color: var(--docket-red-orange); }
.docket-badge-orange { background: color-mix(in srgb, var(--docket-orange) 16%, transparent); color: var(--docket-orange); }
.docket-badge-yellow { background: color-mix(in srgb, var(--docket-yellow) 22%, transparent); color: var(--docket-yellow-text); }
.docket-badge-gray { background: var(--docket-fill); color: var(--docket-label-secondary); }
.docket-badge-blue { background: color-mix(in srgb, var(--docket-blue) 16%, transparent); color: var(--docket-blue); }
.docket-badge-green { background: color-mix(in srgb, var(--docket-green) 16%, transparent); color: var(--docket-green); }

.docket-empty { text-align: center; padding: 40px 20px; color: var(--docket-label-secondary); font-size: 14px; }

.docket-checkbox {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 1.6px solid var(--docket-label-tertiary);
  display: flex; align-items: center; justify-content: center;
}
.docket-checkbox-done { border-color: var(--docket-green); background: var(--docket-green); }
.docket-checkbox-done::after {
  content: ""; width: 5px; height: 9px;
  border-right: 1.8px solid #fff; border-bottom: 1.8px solid #fff;
  transform: rotate(45deg) translate(-1px, -1px);
}
`;

  // src/styles/responsive.css
  var responsive_default = "@media (max-width: 480px) {\n  .docket-page { padding: 18px 14px 60px; }\n  .docket-large-title { font-size: 28px; }\n  .docket-course-grid { grid-template-columns: 1fr 1fr; gap: 8px; }\n  .docket-nav-enhanced { font-size: 12px; }\n}\n\n/* Touch targets stay >=44px regardless of viewport per Apple HIG, spec \xA718/\xA730. */\n@media (pointer: coarse) {\n  .docket-row { min-height: 48px; }\n  .docket-checkbox { width: 24px; height: 24px; }\n}\n";

  // src/core/pageDetector.ts
  function courseIdFromUrl(pathname = location.pathname) {
    return pathname.match(/cid-([^/]+)/)?.[1];
  }
  function isScheduleUrl(pathname = location.pathname) {
    return /\/top\/schedule\b/.test(pathname);
  }
  function looksLikeCourseListPage(doc = document) {
    if (courseIdFromUrl()) return false;
    const hasAnchorShape = doc.querySelectorAll("main a[href*='cid-']").length > 1;
    const hasClickableRowShape = doc.querySelectorAll("main p.cursor-pointer").length > 1;
    return hasAnchorShape || hasClickableRowShape;
  }
  function looksLikeAssignmentsPage(doc = document) {
    if (!courseIdFromUrl()) return false;
    const activeTab = doc.querySelector(".bg-top-nav-highlight")?.textContent?.trim();
    if (activeTab === "Grades") return false;
    return doc.querySelectorAll("main .bg-base.text-highlight").length > 0;
  }
  function looksLikeScheduleListView(doc = document) {
    return isScheduleUrl() && doc.querySelectorAll(".listViewDay").length > 0;
  }

  // src/lib/dom.ts
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === void 0) continue;
        if (k === "class") el.className = v;
        else el.setAttribute(k, v);
      }
    }
    if (children) {
      for (const c of children) {
        if (c === null || c === void 0) continue;
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return el;
  }
  function svgIcon(pathD, viewBox = "0 0 24 24") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("class", "docket-icon");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }
  function markProcessed(el, key) {
    el.setAttribute(`data-docket-${key}`, "1");
  }
  function isProcessed(el, key) {
    return el.hasAttribute(`data-docket-${key}`);
  }
  function overlayContent(container, enhanced, compatibilityMode) {
    const originalNodes = Array.from(container.childNodes);
    container.insertBefore(enhanced, container.firstChild);
    const setOriginalHidden = (hidden) => {
      for (const n of originalNodes) {
        if (n instanceof HTMLElement) n.hidden = hidden;
      }
    };
    setOriginalHidden(!compatibilityMode);
    return {
      originalNodes,
      setOriginalHidden,
      remove() {
        enhanced.parentNode?.removeChild(enhanced);
        setOriginalHidden(false);
      }
    };
  }

  // src/components/courseCard.ts
  function courseCard(data) {
    const dot = h("div", { class: "docket-dot", style: `background:${data.accent}` });
    const headline = h("div", { class: "docket-headline" }, [data.code]);
    const footnote = h("div", { class: "docket-footnote" }, [data.title]);
    if (data.href) {
      return h("a", { class: "docket-course-card", href: data.href }, [dot, headline, footnote]);
    }
    const card = h("div", { class: "docket-course-card", role: "link", tabindex: "0" }, [dot, headline, footnote]);
    if (data.onActivate) {
      card.addEventListener("click", data.onActivate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onActivate();
        }
      });
    }
    return card;
  }
  function accentForCourse(code) {
    const palette = ["#007aff", "#ff9500", "#34c759", "#af52de", "#ff3b30", "#5ac8fa", "#ffcc00"];
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = hash * 31 + code.charCodeAt(i) >>> 0;
    return palette[hash % palette.length];
  }

  // src/core/diagnostics.ts
  var diagnostics = {
    pageKind: "unknown",
    shellMounted: false,
    transformCount: 0
  };
  function resetDiagnostics() {
    diagnostics.pageKind = "unknown";
    diagnostics.activeAdapterId = void 0;
    diagnostics.adapterError = void 0;
    diagnostics.transformCount = 0;
  }

  // src/adapters/courseListAdapter.ts
  function splitCodeTitle(label) {
    const dashIdx = label.indexOf(" - ");
    const codeRaw = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
    const title = dashIdx >= 0 ? label.slice(dashIdx + 3).trim() : "";
    const code = codeRaw.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
    return { code, title };
  }
  function extractCourses(main) {
    const results = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const a of Array.from(main.querySelectorAll("a[href*='cid-']"))) {
      const href = a.getAttribute("href");
      const m = href?.match(/cid-([^/]+)\//);
      if (!m) continue;
      const courseId = m[1];
      if (seenIds.has(courseId)) continue;
      const label = a.textContent?.trim() ?? "";
      if (!label || label === "Go") continue;
      seenIds.add(courseId);
      results.push({ ...splitCodeTitle(label), href });
    }
    if (results.length) return results;
    for (const p of Array.from(main.querySelectorAll("p.cursor-pointer"))) {
      const label = p.textContent?.trim() ?? "";
      if (!label) continue;
      const parsed = splitCodeTitle(label);
      if (!parsed.code) continue;
      results.push({ ...parsed, element: p });
    }
    return results;
  }
  var overlay = null;
  var courseListAdapter = {
    id: "courseList",
    matches: () => looksLikeCourseListPage(),
    mount(compatibilityMode) {
      const main = document.querySelector("main");
      if (!main || isProcessed(main, "courselist")) return;
      const courses = extractCourses(main);
      if (!courses.length) return;
      const grid = h("div", { class: "docket-scope docket-page" }, [
        h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Courses"])]),
        h(
          "div",
          { class: "docket-course-grid" },
          courses.map(
            (c) => courseCard({
              code: c.code || c.title || "Course",
              title: c.title,
              accent: accentForCourse(c.code || c.title),
              href: c.href,
              onActivate: c.element ? () => {
                overlay?.setOriginalHidden(false);
                c.element.click();
              } : void 0
            })
          )
        )
      ]);
      overlay = overlayContent(main, grid, compatibilityMode);
      markProcessed(main, "courselist");
      diagnostics.transformCount += courses.length;
    },
    unmount() {
      overlay?.remove();
      overlay = null;
    }
  };

  // ../src/core/schoolTime.ts
  var SCHOOL_TIME_ZONE = "America/Denver";
  var isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  function todayInSchoolTimeZone() {
    return isoDateFormatter.format(/* @__PURE__ */ new Date());
  }
  function parseIsoDateAsUtcMidnight(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  }
  function daysBetween(fromDateStr, toDateStr) {
    const from = parseIsoDateAsUtcMidnight(fromDateStr);
    const to = parseIsoDateAsUtcMidnight(toDateStr);
    return Math.round((to - from) / (1e3 * 60 * 60 * 24));
  }
  function daysUntilInSchoolTimeZone(dateStr) {
    return daysBetween(todayInSchoolTimeZone(), dateStr);
  }

  // ../src/core/agendaFormatting.ts
  function dueCountdown(daysUntilDue) {
    if (daysUntilDue === void 0) return void 0;
    if (daysUntilDue < 0) {
      const n = Math.abs(daysUntilDue);
      return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
    }
    if (daysUntilDue === 0) return "Due today";
    if (daysUntilDue === 1) return "Due tomorrow";
    return `Due in ${daysUntilDue} days`;
  }
  function dayLabel(dateStr) {
    const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
    return date.toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  }
  function dueDateLabel(dateStr) {
    if (!dateStr) return "no due date";
    const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "tomorrow";
    if (diffDays === -1) return "yesterday";
    const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
    const weekday = date.toLocaleDateString(void 0, { weekday: "long", timeZone: "UTC" });
    if (diffDays > 1 && diffDays < 7) return weekday;
    if (diffDays >= 7 && diffDays < 14) return `next ${weekday}`;
    if (diffDays < -1 && diffDays > -7) return `last ${weekday}`;
    return date.toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  }

  // src/components/dueBadge.ts
  function dueBadge(daysUntilDue) {
    const label = dueCountdown(daysUntilDue);
    if (!label) return null;
    let color = "docket-badge-gray";
    if (daysUntilDue !== void 0) {
      if (daysUntilDue < 0) color = "docket-badge-red";
      else if (daysUntilDue <= 1) color = "docket-badge-red-orange";
      else if (daysUntilDue <= 3) color = "docket-badge-orange";
      else if (daysUntilDue <= 7) color = "docket-badge-yellow";
    }
    return h("span", { class: `docket-badge ${color}` }, [label]);
  }

  // src/components/assignmentCard.ts
  function assignmentCard(data, onActivate) {
    const badge = dueBadge(data.daysUntilDue);
    const dueText = data.dueLabel ? `Due ${data.dueLabel}${data.dueTime ? " " + data.dueTime : ""}` : void 0;
    const categoryText = data.category ? data.category + (data.categoryWeight ? ` (${data.categoryWeight} of grade)` : "") : void 0;
    const row2 = h(
      "div",
      { class: "docket-row" + (onActivate ? " docket-row-tappable" : "") },
      [
        h("div", { class: `docket-checkbox${data.completed ? " docket-checkbox-done" : ""}` }),
        h("div", { class: "docket-row-main" }, [
          h("div", { class: "docket-row-title" }, [data.title]),
          h("div", { class: "docket-row-subtitle" }, [[categoryText, dueText].filter(Boolean).join(" \xB7 ") || void 0])
        ]),
        h("div", { class: "docket-row-trailing" }, [badge ?? void 0, onActivate ? h("span", { class: "docket-chevron" }) : void 0])
      ]
    );
    if (onActivate) {
      row2.addEventListener("click", onActivate);
      row2.tabIndex = 0;
      row2.setAttribute("role", "button");
      row2.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      });
    }
    return row2;
  }

  // src/lib/parseDueText.ts
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function nearestYearDate(month0, day, now = /* @__PURE__ */ new Date()) {
    const a = new Date(now.getFullYear(), month0, day);
    const b = new Date(now.getFullYear() + (a < now ? 1 : -1), month0, day);
    return Math.abs(b.getTime() - now.getTime()) < Math.abs(a.getTime() - now.getTime()) ? b : a;
  }
  function formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function parseSlashDate(text) {
    const m = text.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    const month0 = Number(m[1]) - 1;
    const day = Number(m[2]);
    return nearestYearDate(month0, day);
  }
  function parseAssignmentDueText(text) {
    if (!text) return {};
    const m = text.match(/([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}))?/);
    if (!m) return {};
    const month0 = MONTHS.indexOf((m[1] ?? "").toLowerCase());
    if (month0 === -1) return {};
    const day = Number(m[2]);
    if (!Number.isFinite(day)) return {};
    const iso = formatIsoDate(nearestYearDate(month0, day));
    return { iso, time: m[3] };
  }

  // src/adapters/assignmentsAdapter.ts
  function extractRows(main) {
    const all = Array.from(main.querySelectorAll("*"));
    let currentCategory = "";
    let currentWeight;
    const results = [];
    for (const el of all) {
      if (el.matches(".lineHeight > div.cursor-pointer")) {
        const nameEl = el.children[1];
        currentCategory = (nameEl ?? el).textContent?.replace(/\s+/g, " ").trim() ?? "";
        const weightEl = el.children[2];
        const weightMatch = weightEl?.textContent?.match(/(\d+(?:\.\d+)?)\s*%/);
        currentWeight = weightMatch ? `${weightMatch[1]}%` : void 0;
        continue;
      }
      if (!el.matches(".bg-base.text-highlight") || isProcessed(el, "assignmentrow")) continue;
      const titleCell = el.children[1];
      const title = titleCell?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!titleCell || !title) continue;
      const rowText = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const dueMatch = rowText.match(/[A-Z][a-z]{2}\s+\d{1,2}\s+\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}/);
      const afterDue = dueMatch ? rowText.slice(dueMatch.index + dueMatch[0].length) : rowText;
      const afterDueForScore = afterDue.replace(/^\s*Opens\s+[A-Z][a-z]{2}\s+\d{1,2}/, "");
      const scoreMatch = afterDueForScore.match(/(\d+(?:\.\d+)?)?\s*\/\s*(\d+(?:\.\d+)?)/);
      const submissionText = (scoreMatch ? afterDueForScore.slice(0, scoreMatch.index) : afterDueForScore).trim();
      const completed = /\bcompleted\b/i.test(submissionText) || !!(scoreMatch && scoreMatch[1]);
      results.push({ el, titleCell, title, category: currentCategory, categoryWeight: currentWeight, dueText: dueMatch?.[0], completed });
    }
    return results;
  }
  function buildCard(overlayRef, r) {
    const { iso, time } = parseAssignmentDueText(r.dueText);
    const daysUntilDue = iso ? daysUntilInSchoolTimeZone(iso) : void 0;
    return assignmentCard(
      {
        title: r.title,
        category: r.category || void 0,
        categoryWeight: r.categoryWeight,
        dueLabel: iso ? dueDateLabel(iso) : void 0,
        dueTime: time,
        daysUntilDue,
        completed: r.completed
      },
      () => {
        overlayRef()?.setOriginalHidden(false);
        r.titleCell.click();
        r.el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    );
  }
  var overlay2 = null;
  var listContainer = null;
  var processedRows = [];
  var assignmentsAdapter = {
    id: "assignments",
    matches: () => looksLikeAssignmentsPage(),
    mount(compatibilityMode) {
      const main = document.querySelector("main");
      if (!main) return;
      const rows = extractRows(main);
      if (!rows.length && !overlay2) return;
      for (const r of rows) markProcessed(r.el, "assignmentrow");
      processedRows.push(...rows.map((r) => r.el));
      const cards = rows.map((r) => buildCard(() => overlay2, r));
      if (overlay2 && listContainer) {
        for (const c of cards) listContainer.appendChild(c);
      } else {
        listContainer = h("div", { class: "docket-group" }, cards);
        const backToCards = h("button", { class: "docket-toggle-original" }, ["\u2190 Back to card view"]);
        backToCards.addEventListener("click", () => overlay2?.setOriginalHidden(true));
        const view = h("div", { class: "docket-scope docket-page" }, [
          h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Assignments"])]),
          backToCards,
          listContainer
        ]);
        overlay2 = overlayContent(main, view, compatibilityMode);
      }
      diagnostics.transformCount += rows.length;
    },
    unmount() {
      overlay2?.remove();
      overlay2 = null;
      listContainer = null;
      for (const el of processedRows) el.removeAttribute("data-docket-assignmentrow");
      processedRows = [];
    }
  };

  // src/adapters/homeAdapter.ts
  var WINDOW_DAYS_PAST = 1;
  var WINDOW_DAYS_FUTURE = 14;
  function extractItems(main) {
    const anchors = Array.from(main.querySelectorAll("a.cursor-pointer.block.truncate"));
    const now = /* @__PURE__ */ new Date();
    const minDate = new Date(now.getTime() - WINDOW_DAYS_PAST * 864e5);
    const maxDate = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 864e5);
    const results = [];
    for (const a of anchors) {
      if (isProcessed(a, "scheduleitem")) continue;
      const titleCell = a.closest(".flex-4");
      const courseCell = titleCell?.nextElementSibling;
      const dayEl = a.closest(".listViewDay");
      const headerEl = dayEl?.querySelector(":scope > div:first-child");
      if (!titleCell || !headerEl) continue;
      const date = parseSlashDate(headerEl.textContent?.trim() ?? "");
      if (!date || date < minDate || date > maxDate) continue;
      const title = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!title) continue;
      results.push({ title, courseCode: courseCell?.textContent?.trim() || void 0, dateIso: formatIsoDate(date), anchor: a });
    }
    results.sort((x, y) => x.dateIso.localeCompare(y.dateIso));
    return results;
  }
  function groupByDate(items) {
    const groups = [];
    for (const item of items) {
      const last = groups[groups.length - 1];
      if (last && last.dateIso === item.dateIso) last.items.push(item);
      else groups.push({ dateIso: item.dateIso, items: [item] });
    }
    return groups;
  }
  var overlay3 = null;
  var dayList = null;
  var processedAnchors = [];
  var homeAdapter = {
    id: "home",
    matches: () => looksLikeScheduleListView(),
    mount(compatibilityMode) {
      const main = document.querySelector("main");
      if (!main) return;
      const items = extractItems(main);
      if (!items.length && !overlay3) return;
      for (const i of items) markProcessed(i.anchor, "scheduleitem");
      processedAnchors.push(...items.map((i) => i.anchor));
      const groups = groupByDate(items).map(
        (g) => h("div", { class: "docket-section" }, [
          h("div", { class: "docket-day-header" }, [
            h("div", { class: "docket-headline" }, [dayLabel(g.dateIso)]),
            h("span", { class: "docket-day-count" }, [String(g.items.length)])
          ]),
          h(
            "div",
            { class: "docket-group" },
            g.items.map(
              (item) => assignmentCard(
                { title: item.title, category: item.courseCode, daysUntilDue: daysUntilInSchoolTimeZone(item.dateIso) },
                () => {
                  overlay3?.setOriginalHidden(false);
                  item.anchor.click();
                  item.anchor.scrollIntoView({ block: "center", behavior: "smooth" });
                }
              )
            )
          )
        ])
      );
      if (overlay3 && dayList) {
        dayList.replaceChildren(...groups);
      } else {
        dayList = h("div", {}, groups.length ? groups : [h("div", { class: "docket-empty" }, ["Nothing in the next two weeks."])]);
        const backToCards = h("button", { class: "docket-toggle-original" }, ["\u2190 Back to card view"]);
        backToCards.addEventListener("click", () => overlay3?.setOriginalHidden(true));
        const view = h("div", { class: "docket-scope docket-page" }, [
          h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Today & Upcoming"])]),
          backToCards,
          dayList
        ]);
        overlay3 = overlayContent(main, view, compatibilityMode);
      }
      diagnostics.transformCount += items.length;
    },
    unmount() {
      overlay3?.remove();
      overlay3 = null;
      dayList = null;
      for (const a of processedAnchors) a.removeAttribute("data-docket-scheduleitem");
      processedAnchors = [];
    }
  };

  // src/adapters/registry.ts
  var adapters = [courseListAdapter, assignmentsAdapter, homeAdapter];

  // src/components/icons.ts
  var icons = {
    gear: () => svgIcon(
      "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM4 12a8 8 0 01.3-2.2L2.6 8.4l1.5-2.6 2 .8a8 8 0 013.8-2.2l.3-2.1h3l.3 2.1a8 8 0 013.8 2.2l2-.8 1.5 2.6-1.7 1.4A8 8 0 0120 12a8 8 0 01-.3 2.2l1.7 1.4-1.5 2.6-2-.8a8 8 0 01-3.8 2.2l-.3 2.1h-3l-.3-2.1a8 8 0 01-3.8-2.2l-2 .8-1.5-2.6 1.7-1.4A8 8 0 014 12z"
    ),
    checklist: () => svgIcon("M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11"),
    close: () => svgIcon("M6 6l12 12M18 6L6 18"),
    dashboard: () => svgIcon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
    bell: () => svgIcon("M12 3a4 4 0 00-4 4v3c0 1.5-.6 2.6-1.6 3.6a.5.5 0 00.35.85h10.5a.5.5 0 00.35-.85C16.6 12.6 16 11.5 16 10V7a4 4 0 00-4-4zM9.5 18.5a2.5 2.5 0 005 0"),
    target: () => svgIcon(
      "M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M8,12 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M11,12 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0"
    ),
    envelope: () => svgIcon("M4 6h16v12H4zM4 6.5l8 6.5 8-6.5"),
    book: () => svgIcon("M12 6c-2-1.3-5-1.3-8 0v13c3-1.3 6-1.3 8 0c2-1.3 5-1.3 8 0V6c-3-1.3-6-1.3-8 0zM12 6v13"),
    people: () => svgIcon(
      "M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.7-5 6-5s6 2 6 5M13.5 15.2c2.4.3 4.5 2.3 4.5 4.8h4c0-2.7-1.8-4.7-4-5.2"
    ),
    infoCircle: () => svgIcon("M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M12 8v.01 M12 11v5"),
    grid: () => svgIcon("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"),
    calendar: () => svgIcon("M4 5h16v15H4zM4 9.5h16M8 3v4M16 3v4"),
    flag: () => svgIcon("M6 3v18M6 4h11l-3 4 3 4H6z"),
    barChart: () => svgIcon("M5 20V10M11 20V4M17 20v-7"),
    copyright: () => svgIcon("M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M14.8 9.7a3.2 3.2 0 100 4.6"),
    ruler: () => svgIcon("M4 12h16M4 8v8M9 10v4M14 8v8M19 10v4"),
    calculator: () => svgIcon("M6 3h12v18H6zM8 6h8v3H8zM8.5 12.5h1M12 12.5h1M15.5 12.5h1M8.5 15.5h1M12 15.5h1M15.5 15.5h1M8.5 18.5h1M12 18.5h1M15.5 18.5h1"),
    home: () => svgIcon("M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"),
    document: () => svgIcon("M6 3h9l5 5v13H6zM14 3v5h5"),
    examDoc: () => svgIcon("M6 3h9l5 5v13H6zM14 3v5h5M9 14l2 2 4-4")
  };
  var navIconByLabel = {
    Dashboard: "dashboard",
    Home: "home",
    Announcements: "bell",
    Assignments: "checklist",
    "Learning Outcomes": "target",
    Email: "envelope",
    "Library Resources": "book",
    Groups: "people",
    "Class Info": "infoCircle",
    "Course List": "grid",
    "All Courses": "grid",
    "Combined Schedule": "calendar",
    Schedule: "calendar",
    Prioritizer: "flag",
    "Grade Summary": "barChart",
    Grades: "barChart",
    "Grade Scale": "ruler",
    "What If Calculator": "calculator",
    "Copyright Resources": "copyright",
    Content: "document",
    Exams: "examDoc",
    Syllabus: "book"
  };

  // src/styles/panel.css
  var panel_default = `/**
 * Embedded directly into each panel's own Shadow DOM (see components/settingsPanel.ts
 * and diagnosticsPanel.ts) \u2014 a Shadow root's styles can't leak into LearningSuite's page
 * and LearningSuite's styles can't leak in either, so this file intentionally repeats a
 * few tokens from tokens.css rather than depending on it being in scope.
 *
 * Dark/light is resolved ONLY from the \`data-docket-theme\` attribute the host element
 * carries (set explicitly at mount time in settingsPanel.ts/diagnosticsPanel.ts from the
 * exact same value src/index.ts's applyTheme() just computed) \u2014 never from this file's own
 * \`prefers-color-scheme\` query, which could disagree with what the page around the panel is
 * actually showing (defect: the panel rendering light while the page is dark, or vice
 * versa). Same pattern for \`data-docket-reduced-motion\`.
 */
:host { all: initial; }
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.32);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}
.sheet {
  width: min(420px, 92vw);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--sheet-bg, rgba(242,242,247,0.82));
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  color: var(--sheet-label, rgba(0,0,0,0.92));
  border: 0.5px solid var(--sheet-border, rgba(0,0,0,0.06));
  border-radius: 18px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.12);
}
:host([data-docket-theme="dark"]) .sheet {
  --sheet-bg: rgba(28,28,30,0.78);
  --sheet-label: rgba(255,255,255,0.92);
  --sheet-border: rgba(255,255,255,0.08);
}
.sheet-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px 10px; font-size: 17px; font-weight: 700;
}
.sheet-close {
  border: none; background: rgba(120,120,128,0.16); color: inherit;
  width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 15px;
}
.group { margin: 10px 14px 16px; background: rgba(120,120,128,0.08); border-radius: 12px; overflow: hidden; box-shadow: inset 0 0 0 0.5px rgba(120,120,128,0.14); }
.row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px; font-size: 14px; border-bottom: 0.5px solid rgba(120,120,128,0.25);
  min-height: 44px;
}
.row:last-child { border-bottom: none; }
.row-label { font-weight: 500; }
.row-detail { font-size: 12px; opacity: 0.55; margin-top: 2px; }
select, button.seg {
  font: inherit; border-radius: 8px; border: none; background: rgba(120,120,128,0.16);
  color: inherit; padding: 5px 9px; cursor: pointer;
}
.switch {
  width: 42px; height: 26px; border-radius: 999px; border: none; cursor: pointer;
  background: rgba(120,120,128,0.32); position: relative; flex-shrink: 0;
  transition: background-color 0.15s ease;
}
.switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: transform 0.15s ease;
}
.switch[data-on="true"] { background: #34c759; }
.switch[data-on="true"]::after { transform: translateX(16px); }
:host([data-docket-reduced-motion="true"]) .switch,
:host([data-docket-reduced-motion="true"]) .switch::after {
  transition-duration: 0.001ms;
}
.diag-ok { color: #34c759; }
.diag-warn { color: #ff9500; }
.footer-note { padding: 4px 18px 16px; font-size: 11px; opacity: 0.5; }
`;

  // src/lib/storage.ts
  var PREFIX = "docket-reskin:";
  function getSetting(key, defaultValue) {
    try {
      if (typeof GM_getValue === "function") {
        const v = GM_getValue(key, void 0);
        if (v !== void 0 && !(v instanceof Promise)) return v;
      }
    } catch {
    }
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch {
    }
    return defaultValue;
  }
  function setSetting(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
    } catch {
    }
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
    }
  }

  // src/core/settings.ts
  var DEFAULT_SETTINGS = {
    appearance: "system",
    useCompanionNav: true,
    compatibilityMode: false,
    showUpcomingOnHome: true,
    reducedMotion: false
  };
  var KEY = "settings";
  function loadSettings() {
    return { ...DEFAULT_SETTINGS, ...getSetting(KEY, {}) };
  }
  function saveSettings(settings) {
    setSetting(KEY, settings);
  }

  // src/components/diagnosticsPanel.ts
  var host = null;
  function closeDiagnosticsPanel() {
    host?.remove();
    host = null;
  }
  function row(label, value, ok) {
    const r = document.createElement("div");
    r.className = "row";
    const l = document.createElement("span");
    l.className = `row-label ${ok ? "diag-ok" : "diag-warn"}`;
    l.textContent = (ok ? "\u2713 " : "\u26A0 ") + label;
    const v = document.createElement("span");
    v.textContent = value;
    r.append(l, v);
    return r;
  }
  function openDiagnosticsPanel() {
    if (host) return;
    host = document.createElement("div");
    host.setAttribute("data-docket-diagnostics-host", "1");
    host.setAttribute("data-docket-theme", document.documentElement.getAttribute("data-docket-theme") === "dark" ? "dark" : "light");
    host.setAttribute("data-docket-reduced-motion", document.documentElement.getAttribute("data-docket-reduced-motion") ?? String(loadSettings().reducedMotion));
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panel_default;
    shadow.appendChild(style);
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeDiagnosticsPanel();
    });
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    const header = document.createElement("div");
    header.className = "sheet-header";
    const title = document.createElement("span");
    title.textContent = "Diagnostics";
    const closeBtn = document.createElement("button");
    closeBtn.className = "sheet-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", closeDiagnosticsPanel);
    header.append(title, closeBtn);
    const g = document.createElement("div");
    g.className = "group";
    g.append(
      row("Reskin", "Running", true),
      row("Page detected", diagnostics.pageKind, diagnostics.pageKind !== "unknown"),
      row("Navigation shell", diagnostics.shellMounted ? "Restyled" : "Not applied", diagnostics.shellMounted),
      row("Active adapter", diagnostics.activeAdapterId ?? "none", !!diagnostics.activeAdapterId),
      row("Elements transformed", String(diagnostics.transformCount), true)
    );
    if (diagnostics.adapterError) {
      g.appendChild(row("Last adapter error", diagnostics.adapterError, false));
    }
    const footer = document.createElement("div");
    footer.className = "footer-note";
    footer.textContent = "No assignment titles, grades, or announcement text ever appear here.";
    sheet.append(header, g, footer);
    backdrop.appendChild(sheet);
    shadow.appendChild(backdrop);
  }

  // src/components/settingsPanel.ts
  var host2 = null;
  function closeSettingsPanel() {
    host2?.remove();
    host2 = null;
  }
  function switchRow(shadow, label, initial, onChange) {
    const row2 = document.createElement("div");
    row2.className = "row";
    const text = document.createElement("span");
    text.className = "row-label";
    text.textContent = label;
    const btn = document.createElement("button");
    btn.className = "switch";
    btn.dataset["on"] = String(initial);
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-checked", String(initial));
    btn.addEventListener("click", () => {
      const next = btn.dataset["on"] !== "true";
      btn.dataset["on"] = String(next);
      btn.setAttribute("aria-checked", String(next));
      onChange(next);
    });
    row2.append(text, btn);
    return row2;
  }
  function appearanceRow(initial, onChange) {
    const row2 = document.createElement("div");
    row2.className = "row";
    const text = document.createElement("span");
    text.className = "row-label";
    text.textContent = "Appearance";
    const select = document.createElement("select");
    for (const [value, label] of [
      ["system", "System"],
      ["light", "Light"],
      ["dark", "Dark"]
    ]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.selected = value === initial;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => onChange(select.value));
    row2.append(text, select);
    return row2;
  }
  function diagnosticsRow() {
    const row2 = document.createElement("div");
    row2.className = "row";
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = "Diagnostics";
    const btn = document.createElement("button");
    btn.className = "seg";
    btn.textContent = "View";
    btn.addEventListener("click", () => {
      closeSettingsPanel();
      openDiagnosticsPanel();
    });
    row2.append(label, btn);
    return row2;
  }
  function group(rows) {
    const g = document.createElement("div");
    g.className = "group";
    g.append(...rows);
    return g;
  }
  function openSettingsPanel(onSave) {
    if (host2) return;
    const settings = loadSettings();
    host2 = document.createElement("div");
    host2.setAttribute("data-docket-settings-host", "1");
    host2.setAttribute("data-docket-theme", document.documentElement.getAttribute("data-docket-theme") === "dark" ? "dark" : "light");
    host2.setAttribute("data-docket-reduced-motion", document.documentElement.getAttribute("data-docket-reduced-motion") ?? String(settings.reducedMotion));
    document.body.appendChild(host2);
    const shadow = host2.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panel_default;
    shadow.appendChild(style);
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeSettingsPanel();
    });
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    const header = document.createElement("div");
    header.className = "sheet-header";
    const title = document.createElement("span");
    title.textContent = "Settings";
    const closeBtn = document.createElement("button");
    closeBtn.className = "sheet-close";
    closeBtn.textContent = "\u2715";
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.addEventListener("click", closeSettingsPanel);
    header.append(title, closeBtn);
    const persist = (patch) => {
      const next = { ...settings, ...patch };
      Object.assign(settings, patch);
      saveSettings(next);
      onSave(next);
    };
    sheet.append(
      header,
      group([appearanceRow(settings.appearance, (v) => persist({ appearance: v }))]),
      group([
        switchRow(shadow, "Use Companion navigation", settings.useCompanionNav, (v) => persist({ useCompanionNav: v })),
        switchRow(shadow, "Show upcoming on Home", settings.showUpcomingOnHome, (v) => persist({ showUpcomingOnHome: v })),
        switchRow(shadow, "Reduce Motion", settings.reducedMotion, (v) => persist({ reducedMotion: v }))
      ]),
      group([
        switchRow(shadow, "Compatibility Mode", settings.compatibilityMode, (v) => persist({ compatibilityMode: v }))
      ]),
      group([diagnosticsRow()])
    );
    const compatNote = document.createElement("div");
    compatNote.className = "footer-note";
    compatNote.textContent = "Compatibility Mode keeps LearningSuite's original layout visible alongside the redesigned view \u2014 turn it on if something looks broken.";
    sheet.appendChild(compatNote);
    const footer = document.createElement("div");
    footer.className = "footer-note";
    footer.textContent = "Nothing here is sent anywhere \u2014 settings are stored only on this device, and this reskin talks to no server but learningsuite.byu.edu itself.";
    sheet.appendChild(footer);
    backdrop.appendChild(sheet);
    shadow.appendChild(backdrop);
  }

  // src/adapters/shell.ts
  var navEl = null;
  var topTabsEl = null;
  var fabBar = null;
  function pathMatchScore(current, link) {
    const c = current.replace(/\/+$/, "");
    const l = link.replace(/\/+$/, "");
    if (c === l) return l.length + 1e3;
    if (c.startsWith(l + "/") || l.startsWith(c + "/")) return l.length;
    return -1;
  }
  function restyleNav() {
    const nav = document.querySelector("nav");
    if (!nav) return null;
    const links = Array.from(nav.querySelectorAll("a"));
    if (links.length < 2) return null;
    nav.classList.add("docket-nav-enhanced", "docket-scope");
    let bestLink = null;
    let bestScore = -1;
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      const score = pathMatchScore(location.pathname, new URL(href, document.baseURI).pathname);
      if (score > bestScore) {
        bestScore = score;
        bestLink = a;
      }
    }
    for (const a of links) {
      a.classList.add("docket-nav-item");
      const label = a.textContent?.trim();
      const iconKey = label ? navIconByLabel[label] : void 0;
      if (iconKey && !a.querySelector(".docket-nav-icon")) {
        const icon = icons[iconKey]();
        icon.classList.add("docket-nav-icon");
        a.insertBefore(icon, a.firstChild);
      }
      if (a === bestLink) {
        a.classList.add("docket-nav-item-active");
      }
    }
    return nav;
  }
  function restyleTopTabs() {
    const bar = document.querySelector(".bg-top-nav");
    if (!bar) return null;
    bar.classList.add("docket-top-tabs");
    for (const a of Array.from(bar.querySelectorAll("a"))) {
      a.classList.add("docket-top-tab");
      if (a.classList.contains("bg-top-nav-highlight")) a.classList.add("docket-top-tab-active");
    }
    return bar;
  }
  function mountShell(settings, onSettingsSaved) {
    navEl = settings.useCompanionNav ? restyleNav() : null;
    topTabsEl = settings.useCompanionNav ? restyleTopTabs() : null;
    diagnostics.shellMounted = !!navEl || !!topTabsEl;
    fabBar = h("div", { class: "docket-floating-bar docket-scope" });
    const settingsBtn = h("button", { class: "docket-fab", "aria-label": "Docket reskin settings" }, [icons.gear()]);
    settingsBtn.addEventListener("click", () => openSettingsPanel(onSettingsSaved));
    fabBar.appendChild(settingsBtn);
    document.body.appendChild(fabBar);
  }

  // src/lib/observe.ts
  function observeMutations(target, callback, options = { childList: true, subtree: true }, debounceMs = 150) {
    let timer;
    let applying = false;
    const run = () => {
      timer = void 0;
      if (applying) return;
      applying = true;
      try {
        callback();
      } finally {
        applying = false;
      }
    };
    const observer = new MutationObserver(() => {
      if (applying) return;
      if (timer !== void 0) clearTimeout(timer);
      timer = setTimeout(run, debounceMs);
    });
    observer.observe(target, options);
    return () => {
      if (timer !== void 0) clearTimeout(timer);
      observer.disconnect();
    };
  }

  // src/index.ts
  function injectStyles() {
    if (document.getElementById("docket-reskin-styles")) return;
    const style = document.createElement("style");
    style.id = "docket-reskin-styles";
    style.textContent = [tokens_default, global_default, typography_default, layout_default, navigation_default, cards_default, responsive_default].join("\n");
    document.head.appendChild(style);
  }
  function applyTheme(appearance) {
    let dark;
    if (appearance === "dark" || appearance === "light") {
      dark = appearance === "dark";
    } else if (document.documentElement.classList.contains("h-full")) {
      dark = document.documentElement.classList.contains("dark");
      setSetting("lastKnownDark", dark);
    } else {
      dark = getSetting("lastKnownDark", true);
    }
    document.documentElement.setAttribute("data-docket-theme", dark ? "dark" : "light");
  }
  var activeAdapter = null;
  function runAdapters(settings) {
    resetDiagnostics();
    diagnostics.pageKind = location.pathname;
    applyTheme(settings.appearance);
    document.documentElement.setAttribute("data-docket-reduced-motion", String(settings.reducedMotion));
    if (settings.compatibilityMode) {
      activeAdapter?.unmount();
      activeAdapter = null;
      return;
    }
    const match = adapters.find((a) => {
      try {
        return a.matches();
      } catch {
        return false;
      }
    }) ?? null;
    if (match !== activeAdapter) {
      activeAdapter?.unmount();
      activeAdapter = match;
    }
    if (!activeAdapter) return;
    try {
      activeAdapter.mount(settings.compatibilityMode);
      diagnostics.activeAdapterId = activeAdapter.id;
    } catch (err) {
      diagnostics.adapterError = err instanceof Error ? err.message : String(err);
      try {
        activeAdapter.unmount();
      } catch {
      }
      activeAdapter = null;
    }
  }
  function boot() {
    if (!/learningsuite\.byu\.edu$/.test(location.hostname)) return;
    document.documentElement.setAttribute("data-docket-reskin", "true");
    injectStyles();
    const settings = loadSettings();
    mountShell(settings, (next) => {
      location.reload();
    });
    runAdapters(settings);
    observeMutations(document.body, () => runAdapters(loadSettings()));
    observeMutations(document.documentElement, () => runAdapters(loadSettings()), { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
