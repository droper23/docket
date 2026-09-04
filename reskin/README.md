# LearningSuite Reskin

Makes BYU LearningSuite (`learningsuite.byu.edu`) look and feel like an app Apple designed
— system colors, grouped lists, a translucent sidebar-style nav, real dark mode — while
LearningSuite itself keeps doing everything it already does. Nothing is replaced: signing
in, submitting assignments, taking quizzes, viewing grades, and every real LearningSuite
link all work exactly as before. This is a visual/interaction layer on top, not a new app.

Companion project: [Docket](../README.md), a separate dashboard that pulls LearningSuite
data into its own pages. This reskin is different — it transforms LearningSuite's *own*
pages in place.

## Install (no Apple Developer account, no Xcode, $0, doesn't expire)

Packaging this as a normal Safari extension would need a paid Apple Developer Program
membership ($99/yr) to avoid re-signing it from Xcode every 7 days. Instead, this ships as
a **userscript** run by [Userscripts](https://github.com/quoid/userscripts) — a free,
open-source Safari extension already reviewed and signed by Apple, available on both the
Mac App Store and the iOS/iPadOS App Store. Since Apple already signed *that* app, this
script is just plain JS/CSS data inside it: install once, it keeps working, no certificates
to renew, ever.

Pick your platform below: **macOS Safari**, **iPhone/iPad**, **Chrome/Firefox/Edge on
desktop**, or **Android**. The same script file and the same install URL work on every
platform — only the userscript manager that runs it differs.

### macOS Safari

1. Install **Userscripts** — free, from the
   [Mac App Store](https://apps.apple.com/us/app/userscripts/id1463298887) (also available
   for iPhone/iPad).
2. On Mac: Safari → Settings → Extensions → turn on **Userscripts**. Click "Always Allow on
   Every Website" is **not** what you want — instead allow it only for
   `learningsuite.byu.edu` (narrowest permission; this reskin never needs to run anywhere
   else). On iOS/iPadOS: Settings → Safari → Extensions → Userscripts → turn it on and
   scope it the same way.
3. In Safari, open this script's install URL:
   `https://raw.githubusercontent.com/droper23/docket/main/reskin/dist/learningsuite-reskin.user.js`
   Userscripts recognizes the `.user.js` extension and offers to install it.

   **If nothing happens:** this almost always means the extension doesn't have permission to
   run on `raw.githubusercontent.com` — narrowly scoping it to only `learningsuite.byu.edu`
   (step 2 above) means it has no way to see the file to offer an install prompt.
   [Userscripts' own docs](https://github.com/quoid/userscripts) recommend broader site access
   for exactly this reason. The reliable fix that sidesteps the permission question entirely:
   open the **Userscripts extension itself** (its popup/sidebar, not a webpage), tap **"+"** →
   **"New Remote,"** and paste the install URL above — it fetches and installs the script
   directly, without Safari needing to detect anything on the page. (Alternative: grant the
   extension access to `raw.githubusercontent.com`, or temporarily "Always Allow," reopen the
   URL, then re-narrow permission back to `learningsuite.byu.edu` afterward.)
4. Visit `learningsuite.byu.edu` and sign in normally (your regular BYU/Duo login — this
   script never sees or asks for your password).

**Updating:** re-open the same install URL any time; the script's version number will tell
you if you already have the latest. (`@updateURL`/`@downloadURL` are set in the script's own
metadata for Userscripts' own update-check feature — the exact update-check UX has not been
driven end-to-end against a real install yet; re-opening the URL always works regardless.)

**Turning it off:** open the Userscripts extension's own toolbar popup and disable the
script — instant, no reinstall needed, LearningSuite's original UI comes back immediately.
There's also a **Compatibility Mode** switch inside the reskin's own Settings panel (the
gear button, bottom-right of the page) that keeps LearningSuite's original layout but drops
back to CSS-only polish, for when a LearningSuite update makes the full redesign look wrong
before this project catches up. The same two escape hatches exist on every platform below.

### iPhone / iPad (iOS 15+, Safari + Userscripts)

Apple requires every browser on iOS/iPadOS to use Safari's WebKit engine and Safari's own
extension system — there is no Chrome-style alternative, so **Safari + the Userscripts app
is the only real path** on Apple's mobile OS. The app is free on the
[iOS/iPadOS App Store](https://apps.apple.com/us/app/userscripts/id1463298887).

1. Install **Userscripts** from the App Store.
2. Open iOS **Settings → Safari → Extensions** (or Settings → Apps → Safari on newer iOS),
   tap **Userscripts**, and turn the extension on. iOS gates extensions per website: set
   **All Websites** to "Ask" (or leave it off) and grant access when Safari asks, or tap the
   extension's icon in Safari's address bar while on `learningsuite.byu.edu` and choose
   "Always Allow on This Website" — never "on Every Website". (Exact menu wording shifts
   slightly between iOS versions; the flow — enable, then scope to this one site — does
   not.) This reskin never needs to run anywhere else.
3. In Safari, open this script's install URL:
   `https://raw.githubusercontent.com/droper23/docket/main/reskin/dist/learningsuite-reskin.user.js`
   Userscripts recognizes the `.user.js` extension and offers to install it.

   **If nothing happens:** same cause and fix as the macOS section above — the extension
   most likely can't see `raw.githubusercontent.com` because step 2 scoped it to only
   `learningsuite.byu.edu`. Open the Userscripts app itself, use its **"+" → "New Remote"**
   option, and paste the install URL there instead of relying on Safari to detect it.
4. Visit `learningsuite.byu.edu` and sign in normally with your BYU NetID + Duo.

**Updating** works the same as on the Mac (re-open the same install URL). **Turning it
off:** Safari's address-bar extension icon → disable the script, or flip the extension off
in Settings — LearningSuite's original UI returns immediately. **Compatibility Mode** lives
in the reskin's own gear-menu Settings panel on the page, identical to desktop.

*If you like living on the edge:* [Orion](https://orionbrowser.com/) (Kagi) is the only
non-Safari iOS browser that even attempts this — its Chrome/Firefox extension support is
officially "preliminary," and a userscript manager among its curated extensions is not
something this project has verified end-to-end. Safari + Userscripts is the tested path.

### Chrome, Firefox, Edge (desktop — or any other browser)

The built file (`dist/learningsuite-reskin.user.js`) is a plain, standard userscript — the
same `// ==UserScript==` metadata block, `@match`, and `GM_getValue`/`GM_setValue` grants
that every mainstream userscript manager understands, not anything Safari-specific. Install
a userscript manager for your browser — [Tampermonkey](https://www.tampermonkey.net/)
(Chrome, Firefox, Edge, and more) or [Violentmonkey](https://violentmonkey.github.io/) are
both free and open source — then open the same install URL from the Safari steps above; the
manager will offer to install it exactly like Userscripts does. When Tampermonkey (Chrome/
Edge) asks about site access, "on click" or per-site scoping to `learningsuite.byu.edu` is
the narrow choice; on Firefox, extensions don't expose Chromium's per-site site-access UI —
scoping there is enforced by the script's own `@match`, which this script keeps locked to
`https://learningsuite.byu.edu/*`. Settings persistence (`src/lib/storage.ts`) already
falls back to `localStorage` if a manager's `GM_getValue`/`GM_setValue` isn't available, so
this works even with a manager that grants those APIs differently than Userscripts does.
Turning it off (manager's toolbar popup → disable the script) and Compatibility Mode work
identically — both are the manager's/reskin's own controls, not Safari-specific.

### Android (recommended: Firefox + Tampermonkey)

Firefox for Android supports real extensions installed straight from
[addons.mozilla.org](https://addons.mozilla.org/en-US/android/extensions/) — no special
build, no sideloading — and both [Tampermonkey](https://addons.mozilla.org/en-US/android/addon/tampermonkey/)
and [Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) are on
it (Tampermonkey's listing works with Firefox for Android 120+).

1. Install **Firefox** from the Play Store (current version, not a stale fork).
2. Menu (⋮) → **Add-ons** → **Tampermonkey** → Add. (Or open the AMO link above in Firefox
   and tap "Add to Firefox.")
3. Open this script's install URL in Firefox:
   `https://raw.githubusercontent.com/droper23/docket/main/reskin/dist/learningsuite-reskin.user.js`
   Tampermonkey intercepts `.user.js` URLs and shows its own install screen — tap Install.
4. Go to `learningsuite.byu.edu` and sign in normally.

There's no per-site permission dialog on Firefox for Android — scoping is the script's own
`@match https://learningsuite.byu.edu/*` (enforced, narrow, and all this script ever asks
for). **Turning it off:** Firefox menu → Add-ons → Tampermonkey → disable the script in its
dashboard (or disable the whole add-on). Compatibility Mode: the reskin's own gear menu,
same as everywhere.

### Android (alternative: Edge Canary + Tampermonkey)

Stock Chrome for Android doesn't load extensions. The Chromium fork that used to fill that
role, **Kiwi Browser, was discontinued in January 2025** (maintenance ended, removed from
the Play Store) — don't chase old download links to it. Kiwi's extension support lives on
in **Microsoft Edge Canary** ([Play Store](https://play.google.com/store/apps/details?id=com.microsoft.emmx.canary)),
which inherited the code: enable extension installs (Settings → About → tap the Edge build
repeatedly, per current community instructions — this unlock has moved between builds),
install **Tampermonkey** from the Chrome Web Store, then use the same install URL and
sign-in steps as Firefox above. Caveats that come with any pre-release channel: it updates
daily, can be buggy, and Microsoft could change or remove the unlock at any time — Firefox
is the sturdier Android recommendation.

### On Android, don't install these

- The standalone **"Tampermonkey" app** in the Play Store is *not* a browser extension — it
  runs scripts only inside its own basic built-in browser (a WebView) and **cannot inject
  into Chrome, Firefox, Edge, or any other browser**. Installing it is a dead end.
- **Samsung Internet**: its extension system doesn't include userscript managers.
- Old **Kiwi Browser** APKs from random mirrors: unmaintained since January 2025 and not
  security-reviewed — not worth it for a school site.

## What it does

- **Courses** — the Course List page becomes a card grid; each card links to the exact same
  real LearningSuite URL the original list already had.
- **Assignments** — a course's Assignments page becomes a grouped card list (title, due
  date, real completion status read straight off LearningSuite's own row). Tapping a card
  reveals LearningSuite's real row and re-fires its own click handler — the actual expand/
  submit/feedback flow is LearningSuite's, never reimplemented here.
- **Today & Upcoming** — Combined Schedule (List view) becomes a day-grouped agenda for the
  next two weeks.
- Grades, Announcements, and a real calendar view aren't built yet — LearningSuite's
  original pages are simply left untouched there. See `ROADMAP.md`.

## What it doesn't do

- Never asks for or sees a BYU password, Duo code, or session ID.
- Never contacts any server but `learningsuite.byu.edu` itself — no backend, no analytics,
  no third party. See `PRIVACY.md`.
- Never deletes or rewrites LearningSuite's own DOM — it hides the original view (`hidden`,
  reversible any time) behind the redesigned one and inserts new elements alongside it.

## Developing

```sh
cd reskin
npm install
npm run build       # -> dist/learningsuite-reskin.user.js
npm test             # jsdom-backed adapter/page-detector tests against sanitized fixtures
npm run typecheck
```

Fast local loop: run `npm run build`, then in Userscripts' own editor, replace the script's
content with the freshly built `dist/learningsuite-reskin.user.js`, and reload the
LearningSuite tab.

## Architecture

```
src/
  index.ts          boot: page-detect, mount an adapter, arm a debounced MutationObserver
  core/              page detection, settings, in-memory diagnostics
  adapters/          one per LearningSuite page type — see adapters/types.ts
  components/        DOM-builder UI pieces (cards, badges, settings/diagnostics panels)
  lib/               DOM/storage/observation helpers, no LearningSuite-specific logic
  styles/            Apple HIG system-color tokens + layout, scoped under [data-docket-reskin]
```

Every adapter follows the same rule: if it throws, it's unmounted and LearningSuite's
native UI is left exactly as it was — a broken adapter can never destroy the page. See
`../docs/THREAT_MODEL.md` for the underlying security posture this inherits directly (no
password/cookie/session ID ever read, LearningSuite content always rendered via
`textContent`/DOM builders, never `innerHTML`).
