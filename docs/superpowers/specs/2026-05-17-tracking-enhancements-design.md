# 75 Hard Tracker — Tracking Enhancements

**Date:** 2026-05-17
**Status:** Design approved, pending spec review
**Owner:** Keertana
**Builds on:** `2026-05-17-75hard-tracker-design.md` (the synced PWA, now live)

## 1. Overview

A set of enhancements to the live tracker, all about richer capture:

1. An **event log** — every action records *when* it happened, for later analysis.
2. **Per-item notes** — an optional note on any daily item (e.g. what you ate).
3. A new **"Take vitamins"** daily task with a parent/child checklist.
4. **Water buttons** changed to match real bottles (`+40 / +24 / +8 / −8`).
5. **Dates on the Progress-tab streak dots**.

The event log is foundational; per-item notes and the vitamins task both feed it.

## 2. Current state (relevant)

Each day doc `users/{uid}/days/{YYYY-MM-DD}` currently holds:
`checks: { <9 keys>: bool }`, `workouts: { 1:{done,note}, 2:{done,note} }`,
`water: number`, `notes: string`, `updatedAt`. Daily total is 11 (9 checks +
2 workout `done` flags). `js/data.js` is the storage layer; `js/app.js` renders
and wires events. App is capture-only — see §13.

## 3. Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | Capture only — no analysis UI, no export |
| Event storage | An `events` array of named-field objects on each day doc |
| What to log | checks/un-checks, notes, water adds, token use, app opens |
| Timestamps | Client `Date.now()` (server timestamps can't sit inside array elements) |
| Per-item notes | Optional, expandable note on any of the 12 daily items |
| Workout-note storage | Stays in `workouts.{slot}.note`; `data.js` routes so the UI sees one mechanism |
| Vitamins | New parent task + 4 children (B12, Iron, D3, Magnesium) |
| Magnesium | Cascades with the parent, but not required for the parent to count as done |
| Water buttons | `+40, +24, +8, −8` |
| Streak dots | Hover tooltip gains the calendar date |

## 4. Event log

Each day doc gains an `events` field: an **array of objects**, each:

```
{ type, ts, forDate, ...typeSpecific }
```

- `ts` — `Date.now()`, epoch ms (client clock) — when the action happened.
- `forDate` — `YYYY-MM-DD` the action pertains to (the viewed day).
- `type` and its type-specific fields:

| `type` | Extra fields |
|---|---|
| `check` | `key` (string), `value` (bool), `via` (`"direct"` \| `"cascade"`) |
| `note` | `target` (string — `"daily"` or an item key) |
| `water` | `amount` (number, or the string `"reset"`) |
| `token` | `index` (0–2), `value` (bool) |
| `open` | — |

- **Storage:** events are appended with Firestore `arrayUnion` inside the *same*
  `setDoc(..., {merge:true})` call that performs the write — one round trip, no
  read. Offline writes queue and sync normally.
- **Order:** the array is the chronological log; analysis reads it whole and
  sorts/filters client-side. No Firestore array queries are needed or used.
- **Backfill signal:** an event lives in the day doc it is *for*, but carries the
  real-time `ts`. Editing day 3 on day 5 → an event in day-3's doc with
  `forDate` = day-3 and `ts` = day-5. The `ts`-vs-`forDate` gap is the
  live-vs-backfilled signal — captured for free.
- The app never *reads* `events`; it is write-only from the app's perspective.

## 5. What is logged + the `via` flag

- **check** — every toggle of any of the 12 daily checks (incl. the 2 workouts
  and the vitamins parent) and the 4 vitamin children. `value` is the resulting
  state, so un-checks are logged too.
- **note** — day note, per-item notes, and workout notes. `target` identifies
  which (`"daily"`, or the item key). Coalesced — see §11.
- **water** — every add/subtract (`amount` = the delta: 40/24/8/−8) and reset
  (`amount` = `"reset"`).
- **token** — exception-token use/free. Stored in *today's* day doc.
- **open** — one per app startup, in today's day doc.

**`via`** is on `check` events only. `"direct"` = the user clicked that exact
control. `"cascade"` = it changed automatically via a vitamins parent/child
cascade (§7). Every non-vitamin check is always `"direct"`.

## 6. Per-item notes

- New field `itemNotes: { <itemKey>: string }` on the day doc — notes for the
  non-workout items. Workout notes remain in `workouts.{slot}.note`.
- `data.js` exposes one setter, `setItemNote(dateKey, key, text)`, which routes:
  `"workout1"`/`"workout2"` → `workouts.{slot}.note`; any other key →
  `itemNotes.{key}`. The UI therefore sees a single note mechanism.
- **Scope:** the 12 daily check-items can each hold a note. The 4 vitamin
  *children* are plain checkboxes — no notes.
- **UI:** each check-item gets a small note affordance (a 📝 icon). Tapping it
  toggles an expandable text field within the item. The icon renders "filled"
  when a note exists; items that already have a note render expanded. Clicking
  the icon or the field must not toggle the item's checkbox (same guard pattern
  as the existing workout-note input).
- **Editing** a per-item note saves debounced (like the day note) and logs a
  coalesced `note` event with `target` = the item key.
- **Future days:** per-item notes stay disabled on future days, consistent with
  current workout-note behaviour and §10 of the base spec. Only the day-level
  Notes textarea is editable ahead of time.
- The workout items' current always-visible note input converts to this same
  expandable component.

## 7. New daily task — Take vitamins

A 12th daily task: a "💊 Take vitamins" parent check plus a sub-section of four
children — **B12, Iron, D3, Magnesium** (Magnesium labelled optional).

- **Data:** `vitamins: { b12, iron, d3, magnesium }` (booleans) on the day doc,
  parallel to `workouts`. The parent is `checks.vitamins` — a normal check key.
- **Daily total:** `CHECKLIST_KEYS` gains `"vitamins"` (10 keys); `DAILY_TOTAL`
  becomes **12** (10 checks + 2 workout `done`). The 4 children do not count
  toward the total.
- **Cascade** (logic lives in `app.js`):
  - Toggling the **parent** sets all 4 children to the parent's new value.
  - Toggling a **child** then re-evaluates the parent: the parent is `true` iff
    **B12 ∧ Iron ∧ D3** are all `true` (Magnesium is ignored for this). If that
    evaluation differs from the parent's current state, the parent is updated.
  - The user-clicked control logs a `check` event with `via:"direct"`; every
    control changed by the cascade logs `via:"cascade"`.
- **Keys:** the parent's check key is `"vitamins"`; child check events use keys
  `"vitamin:b12"`, `"vitamin:iron"`, `"vitamin:d3"`, `"vitamin:magnesium"`.
- **UI:** the parent check-item, followed by an indented sub-group of 4 smaller
  child check rows, in the Morning section. The parent item may carry a per-item
  note; the children may not.
- Making the day require 12 items is intentional; there is no completed-day
  history yet (challenge starts 2026-05-18), so no migration concern.

## 8. Water buttons

`index.html`: the four Water-tab buttons become **`+40`, `+24`, `+8`, `−8`** oz
(`data-water` values `40`, `24`, `8`, `-8`). The water *checkpoint* markers
(32/48/64/80/100 oz) are unrelated and left unchanged.

## 9. Streak-dot dates (Progress tab)

`renderStreakBar()` sets each dot's `data-day` to a two-line string —
`"Day 1\nMay 18"` (a real `\n`); buffer dots `"Buffer +1\nAug 1"`. The tooltip
rule `.streak-dot:hover::after` gains `white-space: pre-line` so it renders two
lines. Date format is `"May 18"` (month from the existing `MONTHS` array, no
ordinal), matching the app's date display style.

## 10. `data.js` contract changes

```
getDay / getAllDays    DayData now also carries itemNotes and vitamins
                       (events is written but NOT returned — app never reads it)
getTokens              unchanged
setCheck(dateKey, key, value, via = 'direct')      + logs a check event
setWorkoutDone(dateKey, slot, done)                replaces setWorkout for done;
                                                   + logs a check event (key workout{slot})
setVitamin(dateKey, name, value, via)              writes vitamins.{name}; + check event
setWater(dateKey, total, delta)                    delta drives the water event amount
setNotes(dateKey, text)                            + coalesced note event (target 'daily')
setItemNote(dateKey, key, text)                    routed write; + coalesced note event
setToken(index, used)                              + token event in today's doc
logAppOpen()                                       + open event in today's doc
```

`setWorkout` is removed (split into `setWorkoutDone` for done state and
`setItemNote` for the note). `normalizeDay` gains
`itemNotes: d.itemNotes || {}` and
`vitamins: { b12:false, iron:false, d3:false, magnesium:false, ...d.vitamins }`.

## 11. Note-event coalescing

Notes autosave on a 500 ms debounce, so naive logging would spam a `note` event
per keystroke-pause. `data.js` keeps an in-memory `Map` keyed by
`` `${dateKey}|${target}` `` → last note-event `ts`. `setNotes`/`setItemNote`
append a `note` event only when there is no prior entry or the prior entry is
older than ~3 minutes. The map is in-memory and resets on reload (acceptable —
the first edit after a reload simply logs an event).

## 12. UI changes summary

- **Today panel:** vitamins parent + 4-child sub-group added to Morning; every
  one of the 12 check-items gains an expandable note affordance.
- **Water tab:** the 4 quick-add buttons relabelled.
- **Progress tab:** streak-dot hover tooltips show the date.

## 13. Out of scope

No analysis UI, no charts, no export — capture only. The app never reads
`events`. `normalizeDay` and rendering are otherwise unchanged. Firestore
security rules already cover the new fields (`users/{uid}/**`). Fully unifying
workout notes into `itemNotes` (a cleaner model, small migration) was considered
and deferred — workout notes stay in `workouts.{slot}.note`.

## 14. Testing

Manual, plus Playwright where the sign-in gate allows (no automated framework —
consistent with the base project). Key checks:

- Toggle each kind of control → the matching event appears in the Firestore day
  doc with the right `type`, `ts`, `forDate`, and (for checks) `via`.
- Vitamins: clicking the parent checks all 4 children (`via:cascade`); clicking
  B12+Iron+D3 individually auto-checks the parent (`via:cascade`); toggling
  Magnesium alone never moves the parent; un-checking works in reverse.
- Daily progress shows `/ 12`; a fully-checked day (incl. vitamins parent) marks
  complete in the streak bar.
- Per-item note: expand, type, reload → persists; logs one coalesced `note`
  event per writing session.
- Water buttons add 40/24/8 and subtract 8; each logs a `water` event.
- Streak-dot tooltip shows "Day N" + the date on two lines.
- Future day: per-item notes and vitamins disabled; day-level Notes still editable.
