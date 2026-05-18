# 75 Hard Tracker — Synced Web App

**Date:** 2026-05-17
**Status:** Design approved, pending spec review
**Owner:** Keertana

## 1. Overview

Turn the existing single-file `75hard_tracker.html` into a synced, hosted, installable
web app, so the 75 Hard challenge can be tracked from any device with data that
follows the user everywhere. The challenge starts 2026-05-18.

## 2. Current state

- A complete, polished tracker exists as one 1,413-line file (`~/Downloads/75hard_tracker.html`):
  inline CSS + JS, tabs (Today / Meals / Water / Progress / Reference), date nav,
  progress ring, streak bar, exception tokens, water tracker, weekday-driven workout
  and meal rotation, confetti.
- Data persists in browser `localStorage` — trapped per-device, no sync.
- Target git repo `~/Developer/75hard` exists but is empty (no commits, no remote).

## 3. Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Cross-device data | Sync across all devices via a cloud backend |
| iOS app | Website/PWA first; native React Native app deferred to a separate future project |
| Workouts | Add a free-text "what I actually did" field + done checkbox per workout |
| Meals | Keep MyFitnessPal workflow + add a one-tap shortcut button; no MFP/Health auto-sync (not possible for a web app) |
| Access control | Google sign-in (Firebase Auth) |
| Stack | Firebase + plain HTML/CSS/JS, no build step |
| Backend layering | Split `auth.js` (sign-in) from `data.js` (Firestore CRUD) |
| Reads | One-shot async reads; re-read on date change and window refocus. No live listeners (deferred) |
| Writes | Granular field-level setters, not whole-document saves |
| Past days | Fully editable |
| Future days | Notes-only — completion inputs disabled |
| Challenge length | 75 official days + up to 9 buffer days |

## 4. Architecture & stack

- **Plain HTML/CSS/JS, no build step** — deploys straight to GitHub Pages.
- **Firebase Firestore** — cloud database; real-time persistence; automatic offline caching.
- **Firebase Auth** — Google sign-in.
- **GitHub Pages** — free static hosting at `https://<username>.github.io/75hard/`.
- **PWA** — manifest + service worker + icons; installable on the iPhone home screen,
  works offline.

*Why Firebase over Supabase:* simpler for a single user, offline persistence "just
works" (matters for tracking during outdoor workouts with no signal), and first-class
React Native support so the future RN project reuses the backend untouched.

## 5. File structure

The single file is split into focused files:

```
index.html              markup + PWA hooks
css/styles.css          all styles (moved out of <style>)
js/config.js            Firebase project keys (user pastes these in)
js/auth.js              sign-in / sign-out / auth state
js/data.js              Firestore CRUD — the ONLY file that knows Firestore schema
js/app.js               UI logic (render, interactions); storage calls swapped
manifest.webmanifest    PWA metadata
service-worker.js       offline caching of the app shell
icons/                  app icons: 192x192, 512x512, maskable
```

**Key principle:** dependency direction is `app -> data -> auth`. `data.js` is the
only file touching Firestore schema; `auth.js` is the only file touching the sign-in
flow. When the React Native version is built later, `auth.js` is the only file that
must be rewritten — `data.js` reuses verbatim.

## 6. Data model (Firestore)

```
users/{uid}/days/{YYYY-MM-DD}
  checks:    { water_wake, photo, breakfast, lunch, snack,
               dinner, sweet, water_total, reading }   // 9 booleans; absent = false
  workouts:  { 1: { done: bool, note: string },
               2: { done: bool, note: string } }
  water:     number      // oz, default 0
  notes:     string      // default ''
  updatedAt: serverTimestamp

users/{uid}/meta/state
  tokens:    [bool, bool, bool]
```

- **Daily progress** = 9 `checks` booleans + 2 workout `done` flags = **11 total**
  (unchanged from the current "/11").
- The suggested workout type and meal rotation stay hardcoded in `app.js`
  (day-of-week lookup), shown as hints. Only the workout `done` + `note` are new
  per-day data.
- Document IDs are `YYYY-MM-DD` strings, matching the data-layer `dateKey`.

## 7. Backend contract

`dateKey` is always a `YYYY-MM-DD` string at the data-layer boundary. The app
converts `Date` objects to keys; `data.js` and `auth.js` never see `Date` objects.

### auth.js

```
onAuthChange(cb)      // cb(user | null); fires on sign-in/out and initial load
signIn()              // Promise — opens Google sign-in
signOut()             // Promise
getCurrentUser()      // user | null  (synchronous)
```

### data.js — operates on the signed-in user

```
getDay(dateKey)                            // Promise<DayData>
getAllDays()                               // Promise<{ [dateKey]: DayData }>  — one query
getTokens()                                // Promise<[bool, bool, bool]>
setCheck(dateKey, key, value)              // Promise<void>  — the 9 non-workout items
setWorkout(dateKey, slot, { done, note })  // Promise<void>  — slot = 1 | 2
setWater(dateKey, oz)                      // Promise<void>
setNotes(dateKey, text)                    // Promise<void>
setToken(index, used)                      // Promise<void>
```

`DayData` is always fully defaulted — never null, even for a never-written day:

```
{ checks: {}, workouts: { 1:{done:false,note:''}, 2:{done:false,note:''} },
  water: 0, notes: '' }
```

### Behaviors

- **`getAllDays()` is one query**, not 75+ reads — replaces the streak bar's
  current per-day synchronous loads.
- **`set*` are field-level writes** (`updateDoc` on a single path) — no
  read-modify-write, so two devices changing different fields never clobber.
  `setWorkout` writes `workouts.{slot}.done` and `workouts.{slot}.note` together.
- **Offline writes do not reject** — Firestore persists locally and syncs on
  reconnect. `set*` Promises reject only on permission/auth errors.
- **`data.js` reads the uid from `auth.js`.** If not signed in, `get*`/`set*`
  reject; the auth gate makes this path unreachable in normal use.
- **Optimistic UI:** the app updates in-memory state + the DOM immediately on a
  tap, then fires `set*` in the background. The UI never awaits a write — this
  preserves the instant feel of the current localStorage app.
- **Read freshness:** the app re-reads via `getDay` / `getAllDays` on date change
  and on window/PWA refocus (`visibilitychange`) — the latter catches edits made on
  another device. Switching in-app tabs does not refetch (same day's data). No live
  listeners in v1.

## 8. Feature requirements

1. **Auth gate** — a "Sign in with Google" screen before the tracker; stays signed
   in across visits; sign-out drops back to it.
2. **Sync** — every check / water / note / workout write goes to Firestore; visible
   on all devices after a refresh/refocus; offline writes queue and flush on reconnect.
3. **Workout logging** — each of the 2 daily workouts keeps its suggested type as a
   hint, plus a done checkbox and a free-text "what I actually did" field, saved
   per day. The done checkbox counts toward the daily 11.
4. **MFP shortcut** — a button on the Meals tab that opens MyFitnessPal (the app via
   universal link if installed, else the website). Meal checkboxes unchanged.
5. **PWA install** — manifest + service worker + icons give an installable home-screen
   app, full-screen, offline-capable.
6. **Offline indicator** — a small "offline — will sync" indicator driven by
   `navigator.onLine` / `online` / `offline` events.
7. **Everything else kept** — tabs, date nav, progress ring, streak bar, exception
   tokens, water tracker, reference panel, confetti, the dark editorial aesthetic.

### Out of scope (deliberate)

MFP / Apple Health auto-sync (impossible for a web app); editable routine/meal
configuration; charts/analytics; live cross-device listeners; native app.

## 9. Challenge window & buffer days

- `START = 2026-05-18` (Day 1). `CHALLENGE_END = 2026-07-31` (Day 75).
  `NAV_END = 2026-08-09` (last navigable day). `TOTAL_DAYS = 75`.
- **Date nav clamps** to `[START, NAV_END]` — the arrows disable at the bounds.
- **Buffer days** = Aug 1–9 (up to 9). Labeled "Buffer +N" instead of "Day X of 75".
- **Progress ring** = official days elapsed / 75, capped at 75/75 during buffer.
- **Streak bar** = 75 dots for days 1–75, followed by a small, visually-distinct
  row of up to 9 buffer markers.
- **Buffer days are fully trackable** (all inputs work, subject to the future-day
  rule) so the habit can continue — but they do **not** affect the `/75` ring or
  the "days complete" stat, which are computed over the official 75 only.
- The current `END` constant (Aug 1) is an off-by-one and is replaced by the
  three constants above.

## 10. Past / future day editing

- **Every data-layer function is date-keyed** — no "today" privilege. Past days are
  fully editable through the existing date nav.
- **Future days are notes-only.** When `viewDate > today`:
  - Editable: the daily Notes textarea (for pre-planning).
  - Disabled (dimmed, with a "Future day — notes only" label): all 9 checklist
    items, both workouts (done + note), meal cards, and the water +/- buttons.
  - Exception tokens are unaffected — they live in `meta/state`, not tied to a day.
- **Backfilling heals the streak:** streak and "days complete" recompute from
  `getAllDays()`, so filling a missed past day repairs the streak bar and counts
  on the next Progress render.
- Enforcement is **client-side** (disabled inputs). The Firestore security rule
  stays owner-only with no date logic — for a single-user app the future-day rule
  is a usability guardrail, not a security boundary.

## 11. Error handling

- **Offline:** Firestore caches locally; the offline indicator shows; writes flush
  on reconnect. Reads return cached data.
- **Signed out / auth failure:** drop back to the sign-in screen.
- **New device, first load / never-written day:** `get*` returns a fully-defaulted
  object; UI renders a clean empty state, no crash.
- **Write rejection (permission error):** surface a non-blocking error; the
  optimistic UI change is reverted.

## 12. Security rules

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

A user can read/write only their own subtree. No date conditions — past, present,
future, and buffer days are all writable; the only gate is ownership.

## 13. Hosting & deployment

- New files committed to the `75hard` repo and pushed to GitHub.
- GitHub Pages enabled on the default branch → live at
  `https://<username>.github.io/75hard/`.
- Firebase config keys live in `js/config.js` — committed. This is expected and
  safe for client-side Firebase: security comes from Auth + Firestore rules, not
  from hiding keys. The Google Cloud API key should be restricted to the GitHub
  Pages domain in the Firebase/GCP console.

## 14. One-time manual setup (user-performed)

The user performs these once; the implementation plan will give exact click-by-click
steps:

1. Create a Firebase project (free Spark plan).
2. Enable Authentication → Google provider.
3. Create a Firestore database; paste in the security rules from section 12.
4. Register a web app; copy the config object into `js/config.js`.
5. Add the GitHub Pages domain to Firebase Auth's authorized domains.
6. Enable GitHub Pages on the repo.

## 15. Testing

Manual test checklist (no automated framework — staying buildless; the data layer
is small and verifiable by hand):

- Sign in with Google; sign out returns to the gate.
- Toggle checks / add water / write a note / log a workout — reload, values persist.
- Open on a second device, refocus → the change appears.
- Airplane mode → toggle several items → reconnect → everything synced.
- Install to the iPhone home screen; launches full-screen; works offline.
- Date nav: arrows clamp at May 18 and Aug 9; "Today" jumps back.
- Future day: only Notes is editable; other inputs disabled.
- Backfill a past day → streak bar and "days complete" update.
- Buffer day (Aug 1+): labeled "Buffer +N"; trackable; ring stays 75/75.

## 16. Future work (out of scope here)

A native **React Native** app, as a deliberate learning project once this PWA is
stable. It reuses the Firestore backend and the `data.js` contract; only `auth.js`
(native Google sign-in) and the UI layer are rebuilt. A native app could also
revisit Apple Health integration, which a web app cannot do.
