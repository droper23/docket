# LearningSuite Personal Productivity Layer — Engineering Handoff

**Purpose of this document:** hand a complete, verified technical brief to another AI agent (or a human engineer) so they can continue implementation without re-doing the research phase. Everything under "Verified facts" was confirmed live against an authenticated BYU LearningSuite session on 2026-09-02, not inferred or guessed. Everything under "Design decisions" is a recommendation with stated rationale — a new agent should feel free to challenge it, but should not silently re-litigate it without reading the rationale first.

Companion artifact (polished write-up of the same material, better for human reading): a published Claude Artifact titled "Academic Control Tower." Ask the user for the link if you need the narrative version; this document is the dense/technical version meant for direct use.

---

## 0. Project one-liner

Build a local-first "personal academic operating system" for a BYU Computer Engineering student, using LearningSuite (BYU's LMS, at `learningsuite.byu.edu`) as the source of truth for courses, assignments, due dates, grades, and announcements — surfaced through a unified dashboard, Apple Calendar, and Apple Reminders. Not a reskin of LearningSuite. $0 recurring cost. No cloud backend unless the user explicitly asks for one later.

---

## 1. Verified facts about LearningSuite

### 1.1 Application architecture
- Legacy PHP monolith, progressively enhanced. Evidence: `main.js`, RequireJS 2.3.6 module loader (`js/libs/require/2.3.6/require.js`), jQuery-era patterns, plus newer Vue.js "islands" for specific widgets (`css/tailwind-vue.css`, `app/drivers/student/aggregate-calendar/drivervue-build.js`).
- No client-side global state store was found holding normalized data (checked `window` for state/model/data/store-like keys — only found Vue *component prop schemas*, e.g. a date-picker's `propsAndData`, not actual data). Rendered data lives in server-rendered DOM and in-memory module state, not one discoverable JS object.
- Routes are session-scoped paths, e.g. `https://learningsuite.byu.edu/.{subsessionID}/student/top/schedule`, `.../cid-{courseID}/student/home`, `.../cid-{courseID}/student/calendar`. Navigating between top-level sections triggers a **full page reload** (confirmed: injected `window` state did not survive client-side navigation between "Grade Summary" → "Prioritizer"), not SPA client routing. Treat every top-level nav as a fresh page load.

### 1.2 The data protocol — no REST, no GraphQL
Every dynamic read/write goes through **one** endpoint:

```
POST https://learningsuite.byu.edu/ajax.php?appId=student&subsessionID={session}
Content-Type: application/x-www-form-urlencoded (or multipart)

funcName            = "<method name>"      e.g. observed: setItemCompleted-style call
funcParams[<name>]  = <value>              named parameters, e.g.:
  funcParams[completed]      = true|false
  funcParams[courseID]       = <opaque course id>
  funcParams[assignmentID]   = <opaque id>
  funcParams[calendarItemID] = <opaque id>
classname           = "<server-side class to instantiate>"
contructorParams     = <...>                NOTE: this typo ("contructorParams") is real,
                                             present in production traffic — not a transcription error.
isPage               = true|false
```

This is a bespoke RPC dispatcher — effectively `new {classname}({contructorParams}).{funcName}({funcParams})` executed server-side, multiplexed through one URL. There is no per-resource URL scheme, no OpenAPI/GraphQL schema, no versioning header observed.

**How this was confirmed:** the page's `window.fetch` and `XMLHttpRequest.prototype.send`/`.open` were monkey-patched to log request/response pairs, then a completion checkbox was toggled in the "Prioritizer" view (a cross-course assignment list) and immediately reverted to leave no trace on the account. The captured request body, parsed, had exactly the shape above. **Do not repeat mutating test actions like this against the user's live account without clearing/reverting them — the session used here is the real user's real academic record.**

**Implication for architecture:** `courseID` + `assignmentID`/`calendarItemID` are exactly the stable identifiers LearningSuite itself uses internally — use `{courseID}:{assignmentID|calendarItemID}` as the local stable ID (see §5).

### 1.3 Authentication
- BYU CAS (`cas.byu.edu`) federated via SAML through Okta, with Duo two-step verification enforced on login. No OAuth token is exposed to the frontend — auth resolves to a server-side session, referenced client-side only as an opaque `subsessionID` embedded in the URL path and every AJAX call.
- **There is no way to complete this login flow headlessly/unattended without either (a) storing the user's password somewhere, which is explicitly out of bounds, or (b) the user manually completing a Duo push.** Any architecture requiring unattended re-authentication is the wrong shape — full stop. Design around "observe a session the human already opened," never "log in as a robot."

### 1.4 The iCalendar feed — the single most important finding
- Per-course, from the course's **Schedule** tab: a "Get iCalendar Feed" link produces:
  ```
  https://learningsuite.byu.edu/iCalFeed/ical.php?courseID={opaque_course_id}
  ```
- **Confirmed live, from a cookie-free HTTP client with zero BYU session/cookies attached: this endpoint requires no authentication whatsoever.** A plain unauthenticated GET returns a complete, valid `BEGIN:VCALENDAR` ICS payload with the full course schedule (lecture topics, exams with date ranges, quizzes, WebAssign items, reading assignments, etc.) for the rest of the semester.
- Content is the **course schedule** (same for every student in the section) — exam windows, assignment titles, due dates — not personalized data like the individual student's grades, points earned, or completion checkboxes. Per BYU's own support documentation, entries render as **all-day events** (no time-of-day) and a *subscribed* feed (vs. a one-time downloaded file, which is also offered from the same dialog) is described as syncing "once per day" on the calendar-app side.
- **Security/privacy side-note, not a design choice of this project:** because there's no secret token in the URL, anyone who learns/guesses a `courseID` can pull that course's public schedule. This is a property of LearningSuite itself. It's a low-severity finding (only shared, non-personal schedule content is exposed) but worth being aware of; this project should not attempt to enumerate or guess other students' or other courses' IDs — only fetch feeds for courses the user is actually enrolled in, discovered from their own authenticated session or course list.
- **Practical implication:** Phase 1 of this build (see §7) can be pure: fetch each of the user's course ICS URLs on a schedule (e.g. every few hours via a `launchd` agent, a cron job, or a serverless free-tier scheduled function if ever needed — though local is preferred) with a plain HTTP client, no browser, no cookies, no Duo, no session management at all.

### 1.5 The official BYU API gateway — a dead end for this project
- `developer.byu.edu` / `api.byu.edu` run on a WSO2-based API gateway. `infohub.byu.edu` lists a catalog entry at `apis/api.byu.edu/domains/legacy/learningsuite/assignments/assignment/v1`, and BYU publishes a "University API" (UAPI) specification (`github.com/byu-oit/UAPI-Specification`) standardizing resource shapes for domains like `persons`/`students`/`employees`.
- Both the InfoHub catalog page and the developer docs pages (`developer.byu.edu/docs/consume-api/how-consume-api`) redirect to BYU's internal auth (Brightspot/CAS) when fetched anonymously — i.e., they are not public documentation. The documented onboarding path (per public search results, not directly viewable) is: create a data-sharing request → register an OAuth client → use a BYU service account. This is institutional plumbing for university-approved system-to-system integrations, not self-service personal API keys for a student side project.
- **Conclusion: do not pursue this path for the MVP.** It's not "hard," it's "gated behind an approval process this project has no realistic path through." If the user later has a BYU sponsor/department willing to vouch for a data-sharing agreement, revisit.

### 1.6 Prior art (all stale, none usable directly)
- `github.com/byudevelopers/LearningSweet` — a ~2016-era open-source mobile app pulling LearningSuite data for students. No usable technical documentation surfaced (README points to a Google Slides deck and a defunct Waffle.io board). Confirms the concept has been attempted before; no code worth reusing found.
- `github.com/JaredNeil/learning-suite-mod` — a Chrome extension, **archived April 2019**, that DOM-scraped the course list (three files: `save.js` extracts courses from the homepage, `eventPage.js` persists via `chrome.storage`, `load.js` re-injects into a dropdown). Proves DOM scraping was viable in principle; near-certainly broken now given the confirmed Vue migration of parts of the UI. Do not build on this code — rebuild the concept fresh against the current DOM.
- No actively maintained open-source LearningSuite client exists as of this research (Sep 2026). (One unrelated GitHub hit, `fabienbutz/learningsuite-mcp`, wraps a different, unrelated commercial product also named "LearningSuite" — not BYU's platform, ignore it.)

### 1.7 Policy posture
- BYU's account Terms of Use / Appropriate Use of IT Resources policy prohibits circumventing security controls and acts that "seriously impact the operation of university systems." Nothing found prohibits a student's own tooling reading their own already-authenticated session's data.
- No `robots.txt` exists at `learningsuite.byu.edu` (404) — not a meaningful signal either way for an authenticated app.
- **The real constraint is practical, not textual: Duo makes unattended login infeasible, so don't design anything that needs it.** See §1.3.

---

## 2. Design decisions (recommendation, with rationale)

### 2.1 Recommended architecture: hybrid, two connectors, one local data layer

```
LearningSuite (source of truth)
   │                                    │
   │ ICS URL, no auth, scheduled        │ live browser session, opportunistic
   ▼                                    ▼
iCalendar connector                Safari Web Extension (Mac + iOS)
(unattended, runs anywhere)        (runs only while user is on LearningSuite)
   │                                    │
   └──────────────┬─────────────────────┘
                   ▼
         Local data layer
   (stable-ID records, change log, sync state — SQLite/IndexedDB/JSON, on-device)
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   Dashboard   Apple Calendar   Reminders + notifications
   (Today/Upcoming/Workload)   (EventKit, deduped by stable ID)
```

**Why two connectors instead of one:**
- The ICS feed alone is insufficient: all-day events only (no due *time*), daily-latency sync, and no grades/points/completion/announcements at all (those aren't in the course schedule).
- A browser extension alone is insufficient: it can only see data when the user is actually on the site — no unattended baseline coverage on days they don't open LearningSuite.
- Together: the feed is the reliable, zero-maintenance backbone; the extension is the opportunistic enrichment layer. Neither needs to solve the other's problem.

**Why a Safari Web Extension over the alternatives** (full comparison, 6 options × 9 criteria, is in the companion artifact — summarized here):
- A **userscript** (via the free, open-source "Userscripts" app on Safari, or Tampermonkey during Chrome-based prototyping) is the *right starting point* for iterating on extraction logic — no code-signing pipeline, edit-and-reload — but weaker for shipping a polished, persistent tool across Mac + iOS.
- A **packaged Safari Web Extension** built from the same validated logic gives one codebase for macOS and iOS 15+, first-class local storage, and can pair with a native companion app via a shared App Group container if deeper OS integration (widgets, Shortcuts) is wanted later. This is the promotion path: prototype as userscript → package as extension once validated.
- A **standalone web app with its own backend** (something that logs into LearningSuite server-side on the user's behalf) was explicitly rejected: it would need to hold the user's session/credentials outside the browser the human authenticated in, hits the same Duo wall, and introduces a backend + a place where academic data leaves the device — contrary to the user's stated local-first/privacy preference and to safe handling of credentials generally.
- A **standalone native app doing its own networking/login** has the same Duo problem unless it just embeds a WebView pointed at CAS — which is functionally the extension approach anyway, minus the advantage of running opportunistically inside the browser the user already uses daily.
- A **background daemon holding a stored session cookie**, polling unattended, was explicitly rejected: cookies expire, unattended re-auth isn't realistically automatable without secret storage, and a silently-failing poller is exactly the fragile-scraper failure mode the user's brief warned against.

### 2.2 Stable identifiers & sync semantics
Local stable ID: `{courseID}:{assignmentID or calendarItemID}` — reuses LearningSuite's own opaque IDs (confirmed present in the RPC call shape, §1.2), so no fuzzy matching/heuristic de-duplication is ever needed.

Maintain a mapping table: `stableId → { reminderId, calendarEventId, lastContentHash, lastSeenAt }`.

On each sync pass (whether triggered by the ICS fetch or an extension observation):
1. **Unseen `stableId`** → create local record + create Reminder + create Calendar event; store the mapping.
2. **Known `stableId`, hash of `(title, dueDate, dueTime, pointsPossible)` unchanged** → no-op.
3. **Known `stableId`, hash changed** → update the *existing* Reminder/Calendar event in place (never create a duplicate); append an entry to a local "what changed" log (this directly powers the "what changed since yesterday" UX requirement).
4. **Known `stableId`, absent from the latest pass** → do **not** delete immediately (a partial page load or a mid-navigation extension read is a false negative, not evidence the item was actually removed). Mark "missing since {pass N}"; only archive after it's absent across several consecutive passes.

### 2.3 Data model — labeled by provenance
Every field must be tagged in code/docs as one of: **real** (LearningSuite gave it to us directly), **derived** (computed locally from real fields), or **manual** (the user typed it; LearningSuite has no equivalent). Never blur these — the user explicitly asked not to have invented data presented as fact.

| Entity | Field | Provenance | Source |
|---|---|---|---|
| Course | `courseId, code, title, instructor, term` | real | Course List page |
| Assignment | `assignmentId, courseId, title, type` | real | Prioritizer / Schedule |
| Assignment | `dueDate` | real | ICS feed (all-day granularity) |
| Assignment | `dueTime` | real | extension only — **not present in the ICS feed** |
| Assignment | `availableDate` | real | e.g. "Syllabus Mastery Quiz Opens 4:00am" (seen live in Combined Schedule) |
| Assignment | `pointsPossible, pointsEarned` | real | Grade Summary page |
| Assignment | `completionStatus` | real | Prioritizer checkbox — confirmed round-trippable via the RPC call in §1.2 |
| Course | `currentProgressPct, totalProgressPct` | real | Grade Summary page (exact field pair confirmed live) |
| Announcement | `title, body, postedDate` | real | Announcements tab |
| Assignment | `estimatedEffortMinutes` | derived | heuristic by assignment type, user-overridable, must always be labeled "estimate" in UI |
| Assignment | `priorityScore` | derived | function of (days-to-due, pointsPossible, completionStatus) |
| Assignment | `lastContentHash, lastSyncedAt, source` | derived | sync bookkeeping, not shown to user as "data" |
| Assignment | `notes, subtasks` | manual | LearningSuite has no equivalent field at all |

### 2.4 Privacy/security constraints (non-negotiable for any implementation)
- No password is ever stored, typed by automation, or transmitted anywhere by this system. The extension only ever reads a session the human's own login already created.
- No third-party backend (no Firebase/Supabase/etc.) for a single-user tool. If cross-device sync beyond what the extension/local store already provides is wanted, use **CloudKit's private database** (Apple-ID-authenticated, free at personal scale, still the user's own storage) — not a custom server.
- Nothing should leave the device except requests to `learningsuite.byu.edu` itself (the ICS fetch) and, optionally, Apple's own CloudKit endpoints if the user opts into that. No analytics, no third-party AI API calls with academic data unless the user explicitly opts in per-feature (see §2.6).

### 2.5 Cost
Target: **$0 recurring.** Local storage, EventKit, Shortcuts, and personal-scale CloudKit are free. The one real fork: a packaged Safari Web Extension signed with a free Apple ID needs re-signing from Xcode roughly every 7 days to keep running; either enroll in the paid Apple Developer Program ($99/yr) to remove that chore, or script a scheduled `xcodebuild`-based re-sign to stay at $0. A plain userscript avoids signing entirely.

### 2.6 AI usage — scoped and opt-in only
If AI features are added later (effort-estimation from assignment descriptions, weekly workload summaries, "explain this assignment"), they should run **only on data the user has already extracted locally**, be **opt-in per feature**, and prefer on-device/local models where feasible over sending assignment text to an external API. None of this is required for the MVP — do not add AI features before Phases 1–4 are solid; the user's brief was explicit that AI should not be added "merely because this is an AI project."

---

## 3. Explicit non-goals / guardrails for whoever builds this

- Do **not** attempt headless/unattended login to LearningSuite (storing a password, automating Duo, or replaying a stolen session cookie beyond its natural lifetime). If a sync mechanism needs an active session, it should piggyback on a session the human is already in (extension) — never simulate the login itself.
- Do **not** enumerate or guess other courses'/students' `courseID` values against the ICS endpoint. Only fetch feeds for courses this user is actually enrolled in.
- Do **not** treat the `ajax.php` RPC surface (§1.2) as stable/versioned. It's undocumented and the app is visibly mid-migration (jQuery/RequireJS core + Vue islands). Any code touching it must fail soft — skip a sync cycle and log/alert, never corrupt local state or silently invent data on a shape mismatch.
- Do **not** perform mutating test actions (checking boxes, submitting forms) against the live account without immediately reverting them, and only when strictly necessary to understand a protocol shape.
- Do **not** pursue the official `api.byu.edu` gateway path (§1.5) for MVP purposes — it's gated behind institutional approval, not a viable near-term path.
- Do **not** invent data fields and present them as if LearningSuite provided them — see the provenance table in §2.3 and preserve it in whatever code/schema comes next.

---

## 4. Build roadmap (from the companion artifact, repeated here for direct execution)

**Phase 1 — iCal parser + minimal dashboard.** Fetch every enrolled course's ICS feed (no auth needed, confirmed §1.4), normalize into the data model (§2.3), render Today/Upcoming/Schedule views. Risk: very low, fully de-risked already. This is the safe, immediately-buildable starting point — no browser automation, no extension packaging, no login flow at all.

**Phase 2 — userscript extraction prototype.** Validate reading grades, precise due *times*, completion status, and announcements from a live authenticated session (via DOM reads and/or observing the `ajax.php` responses the page already receives) using a Safari "Userscripts" app script or Tampermonkey during prototyping. Iterate fast; expect selector/shape churn.

**Phase 3 — promote to a signed Safari Web Extension.** Package the validated Phase 2 logic for Mac + iOS from one codebase. Wire it to the shared local data layer. Implement the sync/change-detection algorithm from §2.2.

**Phase 4 — Reminders & Calendar via EventKit.** Stable-ID-keyed create/update per §2.2, never duplicate. Local notifications for newly-changed items (powers "what changed since yesterday").

**Phase 5 — polish.** Home Screen widget, Siri Shortcuts, workload analytics, and — only if it earns its place — opt-in local effort-estimation from assignment text (§2.6).

---

## 5. What the next agent should do first

1. Confirm which phase the user wants started (this hasn't been decided yet as of this handoff — ask, don't assume).
2. If Phase 1: pick a runtime for the scheduled ICS fetch + normalization + dashboard (a small local script + static/local web dashboard is the simplest path; a native macOS menu-bar app is a reasonable alternative if the user wants OS-level scheduling and a Dock presence from day one). Get the user's actual list of enrolled courses and their `courseID`s (from their own Course List page) to build real feed URLs — do not fabricate course IDs.
3. Build against the data model in §2.3, honoring the provenance labels.
4. Keep this document (or its facts) in whatever memory/context system persists across the build — the RPC protocol shape, the ICS no-auth finding, and the guardrails in §3 are expensive to re-derive and should not need to be re-researched.
