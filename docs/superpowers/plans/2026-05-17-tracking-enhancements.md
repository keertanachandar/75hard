# Tracking Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an event log, per-item notes, a vitamins parent/child task, new water buttons, and streak-dot dates to the live 75 Hard tracker.

**Architecture:** Capture-only — every action appends a client-timestamped event object to an `events` array on the day doc. Event logging lives inside `js/data.js` (the storage layer); the app never reads `events`. Per-item notes and the vitamins task are additive day-doc fields. No new files; no build step.

**Tech Stack:** Plain HTML/CSS/JS, ES modules, Firebase Firestore v10.

---

## Conventions

- **Reference spec:** `docs/superpowers/specs/2026-05-17-tracking-enhancements-design.md`.
- **Files touched (all modifications, no new files):** `js/data.js`, `js/app.js`, `index.html`, `css/styles.css`.
- **Local dev server:** `python3 -m http.server 8000` from the repo root → `http://localhost:8000`.
- **Verification is mostly static.** The app requires Google sign-in (which can't be automated), so subagents verify: ES-module syntax, static markup/CSS inspection, and a Playwright load check (page serves, sign-in gate renders, no console errors). True signed-in functional testing (events landing in Firestore, the vitamins cascade, etc.) is done by the user afterward — each task notes this.
- **ES module syntax check:** `js/app.js` and `js/data.js` are ES modules — `node --check` treats a `.js` file as CommonJS and fails on `import`. Check via a `.mjs` copy: `cp js/data.js /tmp/c.mjs && node --check /tmp/c.mjs && rm /tmp/c.mjs`.
- **Key fact about workout items:** in `index.html` the two workout rows are `<div class="check-item workout-item" data-workout="N">` — they carry BOTH the `check-item` and `workout-item` classes and have NO `data-key`. Any `querySelectorAll('#panel-today .check-item')` therefore includes them; the delegated `.check-item[data-key]` handler does not. This matters in Tasks 3 and 4.
- Each task ends with a commit (Conventional Commits).

---

### Task 1: Event-log core in `data.js`

Add the event infrastructure and wire it into the setters whose signatures don't change. Extend `defaultDay`/`normalizeDay` with the new `itemNotes` and `vitamins` fields.

**Files:**
- Modify: `js/data.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add `arrayUnion` to the Firestore import in `js/data.js`**

`js/data.js` lines 4-6 currently import `doc, getDoc, getDocs, collection, setDoc, serverTimestamp`. Change that import block to also include `arrayUnion`:
```javascript
import {
  doc, getDoc, getDocs, collection, setDoc, serverTimestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
```

- [ ] **Step 2: Add event helpers to `js/data.js`** — immediately after the `dayRef()` function (currently ends at line 16), before `defaultDay()`

```javascript
// ── Event log ──────────────────────────────────────────
// Build an event object with a client timestamp.
function ev(type, forDate, extra) {
  return { type, ts: Date.now(), forDate, ...extra };
}

// Today's date key (for events not tied to the viewed day — token, open).
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Note-event coalescing: log a note event only if the last one for this
// day+target was more than COALESCE_MS ago. In-memory; resets on reload.
const COALESCE_MS = 3 * 60 * 1000;
const lastNoteEventAt = new Map();
function shouldLogNote(dateKey, target) {
  const k = `${dateKey}|${target}`;
  const now = Date.now();
  const prev = lastNoteEventAt.get(k);
  if (prev && now - prev < COALESCE_MS) return false;
  lastNoteEventAt.set(k, now);
  return true;
}
```

- [ ] **Step 3: Extend `defaultDay()` and `normalizeDay()` in `js/data.js`**

Replace `defaultDay` (currently lines 18-25):
```javascript
function defaultDay() {
  return {
    checks: {},
    workouts: { 1: { done: false, note: '' }, 2: { done: false, note: '' } },
    vitamins: { b12: false, iron: false, d3: false, magnesium: false },
    itemNotes: {},
    water: 0,
    notes: '',
  };
}
```

Replace `normalizeDay` (currently lines 27-38):
```javascript
function normalizeDay(d) {
  const w = d.workouts || {};
  return {
    checks: d.checks || {},
    workouts: {
      1: { done: false, note: '', ...(w['1']) },
      2: { done: false, note: '', ...(w['2']) },
    },
    vitamins: { b12: false, iron: false, d3: false, magnesium: false, ...(d.vitamins) },
    itemNotes: d.itemNotes || {},
    water: d.water || 0,
    notes: d.notes || '',
  };
}
```
(`events` is intentionally NOT returned — the app never reads it.)

- [ ] **Step 4: Add event logging to `setCheck`, `setNotes`, `setToken` in `js/data.js`**

Replace those three exported functions (`setCheck` lines 57-61, `setNotes` lines 75-79, `setToken` lines 81-85):
```javascript
export async function setCheck(dateKey, key, value, via = 'direct') {
  await setDoc(dayRef(dateKey), {
    checks: { [key]: value },
    events: arrayUnion(ev('check', dateKey, { key, value, via })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setNotes(dateKey, text) {
  const payload = { notes: text, updatedAt: serverTimestamp() };
  if (shouldLogNote(dateKey, 'daily')) {
    payload.events = arrayUnion(ev('note', dateKey, { target: 'daily' }));
  }
  await setDoc(dayRef(dateKey), payload, { merge: true });
}

export async function setToken(index, used) {
  const tokens = await getTokens();
  tokens[index] = used;
  await setDoc(doc(db, 'users', uid(), 'meta', 'state'), { tokens }, { merge: true });
  const tKey = todayKey();
  await setDoc(dayRef(tKey), {
    events: arrayUnion(ev('token', tKey, { index, value: used })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
```

- [ ] **Step 5: Add `logAppOpen()` to `js/data.js`** — as a new export at the end of the file

```javascript
export async function logAppOpen() {
  const tKey = todayKey();
  await setDoc(dayRef(tKey), {
    events: arrayUnion(ev('open', tKey, {})),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
```

- [ ] **Step 6: Call `logAppOpen()` at startup in `js/app.js`**

In `js/app.js` line 1, add `logAppOpen` to the `./data.js` import list. Then in the `onAuthChange((user) => { ... })` callback (lines 466-475), inside the `if (user)` branch, after the `render();` call, add:
```javascript
      logAppOpen().catch((e) => console.warn('logAppOpen failed:', e));
```
The `if (user)` branch then reads:
```javascript
    if (user) {
      gate.classList.remove('visible');
      appRoot.classList.add('visible');
      render();
      logAppOpen().catch((e) => console.warn('logAppOpen failed:', e));
    } else {
```

- [ ] **Step 7: Verify**

`cp js/data.js /tmp/c.mjs && node --check /tmp/c.mjs && rm /tmp/c.mjs` — passes.
`cp js/app.js /tmp/c.mjs && node --check /tmp/c.mjs && rm /tmp/c.mjs` — passes.
Serve and `browser_navigate` to `http://localhost:8000`; `browser_console_messages` shows no JS errors (favicon 404 is harmless), sign-in gate renders.
(Signed-in check that events actually write is deferred to the user.)

- [ ] **Step 8: Commit**
```bash
git add js/data.js js/app.js
git commit -m "feat: add event-log core to data.js"
```

---

### Task 2: `setWater` delta + water buttons

**Files:**
- Modify: `js/data.js`
- Modify: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Update `setWater` in `js/data.js`**

Replace `setWater` (currently lines 69-73):
```javascript
export async function setWater(dateKey, total, delta) {
  await setDoc(dayRef(dateKey), {
    water: total,
    events: arrayUnion(ev('water', dateKey, { amount: delta })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
```

- [ ] **Step 2: Update `addWater` and `resetWater` in `js/app.js`** to pass the delta

`addWater` (lines 327-332) and `resetWater` (lines 334-339) become:
```javascript
  function addWater(oz) {
    if (isFuture(viewDate)) return;
    currentDay.water = Math.max(0, Math.min(200, (currentDay.water || 0) + oz));
    renderWater(currentDay.water);
    persist(setWater(dateKey(viewDate), currentDay.water, oz));
  }

  function resetWater() {
    if (isFuture(viewDate)) return;
    currentDay.water = 0;
    renderWater(0);
    persist(setWater(dateKey(viewDate), 0, 'reset'));
  }
```
(The only change is the third argument to `setWater`. The `isFuture` guards and the rest stay as they are.)

- [ ] **Step 3: Change the water buttons in `index.html`**

In the Water panel the four `.bottle-btn` buttons (lines 198-201) currently have `data-water` values `8`, `16`, `32`, `-8`. Replace them with:
```html
        <button class="bottle-btn" data-water="40">+40 oz</button>
        <button class="bottle-btn" data-water="24">+24 oz</button>
        <button class="bottle-btn" data-water="8">+8 oz</button>
        <button class="bottle-btn" data-water="-8">-8 oz</button>
```

- [ ] **Step 4: Verify**

Both modules pass the `.mjs` `node --check`. `grep -n 'data-water' index.html` shows `40/24/8/-8`. Playwright load: no console errors.

- [ ] **Step 5: Commit**
```bash
git add js/data.js js/app.js index.html
git commit -m "feat: water-event logging and +40/+24/+8 buttons"
```

---

### Task 3: Split `setWorkout`; add `setItemNote`

**Files:**
- Modify: `js/data.js`
- Modify: `js/app.js`

- [ ] **Step 1: Replace `setWorkout` with `setWorkoutDone` + `setItemNote` in `js/data.js`**

Delete the `setWorkout` export (currently lines 63-67). In its place add:
```javascript
export async function setWorkoutDone(dateKey, slot, done) {
  await setDoc(dayRef(dateKey), {
    workouts: { [slot]: { done } },
    events: arrayUnion(ev('check', dateKey, { key: 'workout' + slot, value: done, via: 'direct' })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Per-item note. Workout keys route into workouts.{slot}.note; everything
// else into itemNotes.{key}. The note event is coalesced (see shouldLogNote).
export async function setItemNote(dateKey, key, text) {
  const payload = { updatedAt: serverTimestamp() };
  if (key === 'workout1' || key === 'workout2') {
    const slot = key === 'workout1' ? 1 : 2;
    payload.workouts = { [slot]: { note: text } };
  } else {
    payload.itemNotes = { [key]: text };
  }
  if (shouldLogNote(dateKey, key)) {
    payload.events = arrayUnion(ev('note', dateKey, { target: key }));
  }
  await setDoc(dayRef(dateKey), payload, { merge: true });
}
```

- [ ] **Step 2: Update the `js/app.js` import line**

Replace line 1 of `js/app.js` entirely. Remove `setWorkout`; add `setWorkoutDone` and `setItemNote`. The line becomes:
```javascript
import { getDay, getAllDays, getTokens, setCheck, setWorkoutDone, setWater, setNotes, setItemNote, setToken, logAppOpen } from './data.js';
```
(Do NOT forward-import `setVitamin` here — it does not exist in `js/data.js` until Task 5. A named import of a missing export is an ES-module link-time error that breaks the whole app. Task 5 adds `setVitamin` to this line.)

- [ ] **Step 3: Update `toggleWorkout` in `js/app.js`**

`toggleWorkout` (lines 358-366) currently ends with `persist(setWorkout(dateKey(viewDate), slot, currentDay.workouts[slot]));`. Change that last line to:
```javascript
    persist(setWorkoutDone(dateKey(viewDate), slot, next));
```
(Everything else in `toggleWorkout` — the optimistic `currentDay.workouts[slot].done = next` update, `updateDailyProgress()`, `renderStreakBar()`, `spawnBurst` — stays exactly as it is.)

- [ ] **Step 4: Update the workout-note listener in `js/app.js`**

In `wireEvents()`, the `.workout-item[data-workout]` loop (lines 427-446) has a debounced note `input` listener that calls `setWorkout(...)`. `setWorkout` no longer exists, so this must be repointed now to keep the app working. Change the debounced call to:
```javascript
        t = setTimeout(() => {
          persist(setItemNote(dateKey(viewDate), 'workout' + slot, noteEl.value));
        }, 500);
```
(Keep the rest of that listener unchanged for now — Task 4 removes this listener entirely once the generic note wiring replaces it.)

- [ ] **Step 5: Verify**

`grep -nE 'setWorkout\b' js/app.js js/data.js` — returns nothing (only `setWorkoutDone` remains, which `\b` excludes). Both modules pass the `.mjs` `node --check`. Playwright load: no console errors.

- [ ] **Step 6: Commit**
```bash
git add js/data.js js/app.js
git commit -m "refactor: split setWorkout into setWorkoutDone + setItemNote"
```

---

### Task 4: Per-item expandable notes

Give every daily check-item an optional, expandable note. Because the two workout rows already carry the `check-item` class, the single generic mechanism added here covers all 11 items (9 `data-key` items + 2 workout items); the workout rows' old always-visible note input and its dedicated listener are removed.

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/app.js`

- [ ] **Step 1: Add the note affordance to the 9 `data-key` check-items in `index.html`**

Each of the 9 `.check-item` elements in `#panel-today` that have a `data-key` (`water_wake`, `photo`, `breakfast`, `lunch`, `snack`, `dinner`, `sweet`, `water_total`, `reading`) gets two additions: an `.item-note-input` appended as the last child of its `.check-label`, and a `.note-toggle` button appended as the last child of the `.check-item`. For example, the breakfast item (lines 107-111) becomes:
```html
      <div class="check-item" data-key="breakfast">
        <div class="checkbox"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="check-emoji">🍳</span>
        <div class="check-label">Breakfast logged in MFP<span class="sub">2 eggs + ¼ cup egg whites + veg + ¾ cup Greek yogurt + ½ cup berries</span><input type="text" class="item-note-input" placeholder="Add a note…"></div>
        <button class="note-toggle" type="button" aria-label="Add note">📝</button>
      </div>
```
Do this for all 9 `data-key` items. Keep each item's existing checkbox/emoji/label content exactly — only append the `<input class="item-note-input">` inside `.check-label` and the `<button class="note-toggle">` after `.check-label`.

- [ ] **Step 2: Convert the 2 workout items in `index.html`**

The workout items (lines 93-101 and 130-138) currently end their `.check-label` with `<input type="text" class="workout-note" id="wNnote" placeholder="What did you actually do?">`. For each: change that input's `class` from `workout-note` to `item-note-input` (keep its `id` — `w1note`/`w2note` — and `placeholder`), and append `<button class="note-toggle" type="button" aria-label="Add note">📝</button>` as the last child of the `.check-item` (sibling of `.check-label`). Workout item 1 becomes:
```html
      <div class="check-item workout-item" data-workout="1">
        <div class="checkbox"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="check-emoji" id="w1emoji">🚴</span>
        <div class="check-label">
          <span id="w1label">Workout #1 — 45 min</span>
          <span class="sub" id="w1sub">Indoor · See workout tab for today's type</span>
          <input type="text" class="item-note-input" id="w1note" placeholder="What did you actually do?">
        </div>
        <button class="note-toggle" type="button" aria-label="Add note">📝</button>
      </div>
```
Apply the same change to workout item 2 (`id="w2note"`, the `w2*` ids).

- [ ] **Step 3: Style the affordance in `css/styles.css`**

Delete the `.workout-note` rules (currently lines 720-732: the `.workout-note`, `.workout-note:focus`, `.workout-note::placeholder` block and its `/* Workout note input */` comment). Replace them with:
```css
  /* Per-item note */
  .note-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    opacity: 0.35;
    padding: 0 2px;
    align-self: flex-start;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }
  .note-toggle:hover { opacity: 0.8; }
  .check-item.has-note .note-toggle { opacity: 0.9; }
  .item-note-input {
    display: none;
    width: 100%;
    margin-top: 8px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    padding: 6px 8px;
  }
  .check-item.note-open .item-note-input { display: block; }
  .item-note-input:focus { outline: none; border-color: var(--accent); }
  .item-note-input::placeholder { color: var(--text-dim); }
```

- [ ] **Step 4: Add note helpers in `js/app.js`** — in the `// ── Helpers ──` section, after `isFuture` (line 127)

```javascript
  // The note key for a check-item: data-key, or workoutN for workout items.
  function itemKey(el) {
    return el.dataset.key || ('workout' + el.dataset.workout);
  }

  // Current saved note text for an item key.
  function itemNoteValue(key) {
    if (key === 'workout1') return currentDay.workouts[1].note || '';
    if (key === 'workout2') return currentDay.workouts[2].note || '';
    return (currentDay.itemNotes && currentDay.itemNotes[key]) || '';
  }
```

- [ ] **Step 5: Render note state in `render()`; drop the redundant workout-note lines in `js/app.js`**

In `render()`, the workout render block (lines 203-209) currently also sets the note input value:
```javascript
    [1, 2].forEach((s) => {
      const item = document.querySelector(`.workout-item[data-workout="${s}"]`);
      if (!item) return;
      item.classList.toggle('checked', !!currentDay.workouts[s].done);
      const noteEl = document.getElementById('w' + s + 'note');
      if (noteEl) noteEl.value = currentDay.workouts[s].note || '';
    });
```
Delete the last two lines of that block (`const noteEl = ...;` and `if (noteEl) noteEl.value = ...;`) — the generic note render below now owns note values. The block becomes:
```javascript
    [1, 2].forEach((s) => {
      const item = document.querySelector(`.workout-item[data-workout="${s}"]`);
      if (!item) return;
      item.classList.toggle('checked', !!currentDay.workouts[s].done);
    });
```
Then, immediately before the `updateDailyProgress();` call (line 212), add the generic note render:
```javascript
    // Per-item notes: fill each input, expand items that already have a note.
    document.querySelectorAll('#panel-today .check-item').forEach((item) => {
      const input = item.querySelector('.item-note-input');
      if (!input) return;
      const note = itemNoteValue(itemKey(item));
      input.value = note;
      item.classList.toggle('has-note', note.length > 0);
      item.classList.toggle('note-open', note.length > 0);
    });
```

- [ ] **Step 6: Remove the old workout-note listener; add generic note wiring in `wireEvents()` in `js/app.js`**

In the `.workout-item[data-workout]` loop in `wireEvents()` (lines 427-446), delete the debounced note listener — the `let t;` line and the entire `noteEl.addEventListener('input', () => { ... });` block. Keep the `const slot`, `const noteEl`, and the `item.addEventListener('click', ...)` handler (its `if (e.target === noteEl) return;` guard still needs `noteEl`). The loop becomes:
```javascript
    // Workout item wiring
    document.querySelectorAll('.workout-item[data-workout]').forEach((item) => {
      const slot = Number(item.dataset.workout);
      const noteEl = document.getElementById('w' + slot + 'note');
      // Toggle done — but not when the click originated in the text input
      item.addEventListener('click', (e) => {
        if (e.target === noteEl) return;
        if (isFuture(viewDate)) return;
        toggleWorkout(slot, item);
      });
    });
```
Then add the generic note wiring inside `wireEvents()` (after the water-button wiring is fine):
```javascript
    // Per-item note: expand toggle + debounced autosave (covers all check-items,
    // including the workout rows, since they also carry the check-item class).
    document.querySelectorAll('#panel-today .check-item').forEach((item) => {
      const toggleBtn = item.querySelector('.note-toggle');
      const input = item.querySelector('.item-note-input');
      if (!toggleBtn || !input) return;
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('note-open');
        if (item.classList.contains('note-open')) input.focus();
      });
      let t;
      input.addEventListener('input', () => {
        if (isFuture(viewDate)) return;
        const key = itemKey(item);
        item.classList.toggle('has-note', input.value.length > 0);
        // optimistic local update (mirrors the day-note autosave)
        if (key === 'workout1') currentDay.workouts[1].note = input.value;
        else if (key === 'workout2') currentDay.workouts[2].note = input.value;
        else currentDay.itemNotes[key] = input.value;
        clearTimeout(t);
        t = setTimeout(() => {
          persist(setItemNote(dateKey(viewDate), key, input.value));
        }, 500);
      });
    });
```

- [ ] **Step 7: Stop note clicks from toggling the checkbox in `js/app.js`**

The delegated `#panel-today` click handler in `wireEvents()` (lines 409-412) is:
```javascript
    document.getElementById('panel-today').addEventListener('click', (e) => {
      const item = e.target.closest('.check-item[data-key]');
      if (item) toggle(item);
    });
```
Add a guard as the first line of the handler body:
```javascript
    document.getElementById('panel-today').addEventListener('click', (e) => {
      if (e.target.closest('.item-note-input') || e.target.closest('.note-toggle')) return;
      const item = e.target.closest('.check-item[data-key]');
      if (item) toggle(item);
    });
```
(The `.note-toggle` listener already calls `stopPropagation()`; this guard also covers the input and is harmless belt-and-suspenders.)

- [ ] **Step 8: Verify**

Both modules pass the `.mjs` `node --check`. `grep -c 'item-note-input' index.html` shows `11` (9 + 2 workout). `grep -n 'workout-note' index.html css/styles.css` returns nothing. `grep -n 'setWorkout(' js/app.js` returns nothing. Playwright load: no console errors.
(Signed-in note persistence is deferred to the user.)

- [ ] **Step 9: Commit**
```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: optional expandable per-item notes"
```

---

### Task 5: Vitamins parent/child task

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/data.js`
- Modify: `js/app.js`

- [ ] **Step 1: Add `setVitamin` to `js/data.js`** — a new export, next to `setWorkoutDone`

```javascript
export async function setVitamin(dateKey, name, value, via) {
  await setDoc(dayRef(dateKey), {
    vitamins: { [name]: value },
    events: arrayUnion(ev('check', dateKey, { key: 'vitamin:' + name, value, via })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
```

Then add `setVitamin` to the `./data.js` import on line 1 of `js/app.js`. The line becomes:
```javascript
import { getDay, getAllDays, getTokens, setCheck, setWorkoutDone, setVitamin, setWater, setNotes, setItemNote, setToken, logAppOpen } from './data.js';
```
(`data.js` now exports `setVitamin`, so this import resolves cleanly.)

- [ ] **Step 2: Add the vitamins markup to `index.html`**

In the "Morning" `.check-group` (lines 86-112), after the breakfast `.check-item` (which ends at line 111) and before the group's closing `</div>` (line 112), insert the parent check-item plus the children sub-group. The `.vitamin-children` div is a SIBLING of the parent `.check-item`, not nested inside it:
```html
      <div class="check-item" data-key="vitamins">
        <div class="checkbox"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <span class="check-emoji">💊</span>
        <div class="check-label">Take vitamins<span class="sub">B12 · Iron · D3 · Magnesium</span><input type="text" class="item-note-input" placeholder="Add a note…"></div>
        <button class="note-toggle" type="button" aria-label="Add note">📝</button>
      </div>
      <div class="vitamin-children">
        <div class="vitamin-child" data-vitamin="b12"><div class="vc-box"></div><span>B12</span></div>
        <div class="vitamin-child" data-vitamin="iron"><div class="vc-box"></div><span>Iron</span></div>
        <div class="vitamin-child" data-vitamin="d3"><div class="vc-box"></div><span>D3</span></div>
        <div class="vitamin-child" data-vitamin="magnesium"><div class="vc-box"></div><span>Magnesium <em>(optional)</em></span></div>
      </div>
```

- [ ] **Step 3: Style the vitamins sub-group in `css/styles.css`** — after the per-item note rules added in Task 4

```css
  /* Vitamins sub-group */
  .vitamin-children {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: -2px 0 6px 34px;
  }
  .vitamin-child {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg2);
    cursor: pointer;
    font-size: 11px;
    color: var(--text-muted);
    user-select: none;
    transition: all 0.15s;
  }
  .vitamin-child:hover { border-color: var(--border2); }
  .vitamin-child .vc-box {
    width: 13px;
    height: 13px;
    border: 1.5px solid var(--border2);
    border-radius: 3px;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .vitamin-child.checked { color: var(--text); border-color: var(--checked-border); background: var(--checked-bg); }
  .vitamin-child.checked .vc-box { background: var(--accent3); border-color: var(--accent3); }
  .vitamin-child em { font-style: normal; color: var(--text-dim); }
  body.future-view .vitamin-children { opacity: 0.4; pointer-events: none; }
```

- [ ] **Step 4: Update constants in `js/app.js`**

Replace the `CHECKLIST_KEYS` and `DAILY_TOTAL` lines (lines 62-63):
```javascript
  const CHECKLIST_KEYS = ['water_wake','vitamins','photo','breakfast','lunch','snack','dinner','sweet','water_total','reading']; // 10
  const DAILY_TOTAL = 12; // 10 checks + 2 workout done flags
```

- [ ] **Step 5: Add vitamins constants and logic in `js/app.js`** — in the `// ── Interactions ──` section, after `toggleWorkout` (line 366)

```javascript
  const VITAMINS = ['b12', 'iron', 'd3', 'magnesium'];
  const REQUIRED_VITAMINS = ['b12', 'iron', 'd3'];

  // Render the 4 vitamin children from currentDay. The parent is a normal
  // CHECKLIST_KEYS item, rendered by the existing checklist loop.
  function renderVitamins() {
    VITAMINS.forEach((name) => {
      const el = document.querySelector(`.vitamin-child[data-vitamin="${name}"]`);
      if (el) el.classList.toggle('checked', !!currentDay.vitamins[name]);
    });
  }

  // User clicked the "Take vitamins" parent: cascade all 4 children.
  function toggleVitaminsParent() {
    if (isFuture(viewDate)) return;
    const next = !currentDay.checks.vitamins;
    const key = dateKey(viewDate);
    currentDay.checks.vitamins = next;
    VITAMINS.forEach((name) => { currentDay.vitamins[name] = next; });
    const parentEl = document.querySelector('.check-item[data-key="vitamins"]');
    if (parentEl) parentEl.classList.toggle('checked', next);
    renderVitamins();
    updateDailyProgress();
    renderStreakBar();
    if (next && parentEl) spawnBurst(parentEl);
    persist(setCheck(key, 'vitamins', next, 'direct'));
    VITAMINS.forEach((name) => persist(setVitamin(key, name, next, 'cascade')));
  }

  // User clicked one vitamin child: save it, then re-evaluate the parent.
  function toggleVitamin(name) {
    if (isFuture(viewDate)) return;
    const key = dateKey(viewDate);
    const next = !currentDay.vitamins[name];
    currentDay.vitamins[name] = next;
    persist(setVitamin(key, name, next, 'direct'));
    const parentShouldBe = REQUIRED_VITAMINS.every((n) => currentDay.vitamins[n]);
    if (parentShouldBe !== !!currentDay.checks.vitamins) {
      currentDay.checks.vitamins = parentShouldBe;
      const parentEl = document.querySelector('.check-item[data-key="vitamins"]');
      if (parentEl) parentEl.classList.toggle('checked', parentShouldBe);
      persist(setCheck(key, 'vitamins', parentShouldBe, 'cascade'));
    }
    renderVitamins();
    updateDailyProgress();
    renderStreakBar();
  }
```

- [ ] **Step 6: Special-case the parent and wire the children in `js/app.js`**

In `toggle(el)` (lines 303-313), add this immediately after `const key = el.dataset.key;` (line 305):
```javascript
    if (key === 'vitamins') { toggleVitaminsParent(); return; }
```
In `wireEvents()`, the delegated `#panel-today` click handler (now, after Task 4 Step 7, starting with the `item-note-input`/`note-toggle` guard) gains a vitamin-child branch BEFORE the `.check-item[data-key]` resolution:
```javascript
    document.getElementById('panel-today').addEventListener('click', (e) => {
      if (e.target.closest('.item-note-input') || e.target.closest('.note-toggle')) return;
      const vchild = e.target.closest('.vitamin-child[data-vitamin]');
      if (vchild) { toggleVitamin(vchild.dataset.vitamin); return; }
      const item = e.target.closest('.check-item[data-key]');
      if (item) toggle(item);
    });
```

- [ ] **Step 7: Call `renderVitamins()` from `render()` in `js/app.js`**

In `render()`, immediately before the `updateDailyProgress();` call (the same anchor used in Task 4 Step 5), add:
```javascript
    renderVitamins();
```

- [ ] **Step 8: Update `#dpTotal` in `index.html`**

The daily-progress total span (line 81) `<span id="dpTotal">11</span>` becomes `<span id="dpTotal">12</span>`.

- [ ] **Step 9: Verify**

Both modules pass the `.mjs` `node --check`. `grep -c 'data-vitamin' index.html` shows `4`. `grep -n 'DAILY_TOTAL = ' js/app.js` shows `12`. `CHECKLIST_KEYS` has 10 entries including `vitamins`. Playwright load: no console errors.
(Signed-in cascade testing is deferred to the user.)

- [ ] **Step 10: Commit**
```bash
git add index.html css/styles.css js/data.js js/app.js
git commit -m "feat: add vitamins parent/child daily task"
```

---

### Task 6: Dates on the streak dots

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`

- [ ] **Step 1: Add a date-label helper in `js/app.js`** — in the `// ── Helpers ──` section, near `dayLabel`

```javascript
  // Short calendar label for a Date, e.g. "May 18".
  function shortDate(d) {
    return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }
```

- [ ] **Step 2: Add the date to each streak dot in `renderStreakBar()` in `js/app.js`**

`renderStreakBar()` (lines 261-287) builds two sets of dots, each loop already having a `Date` named `d`. In the 75-day loop, change the dot's `data-day` from `data-day="Day ${i+1}"` to:
```javascript
data-day="Day ${i+1}\n${shortDate(d)}"
```
In the 9-day buffer loop, change `data-day="Buffer +${i+1}"` to:
```javascript
data-day="Buffer +${i+1}\n${shortDate(d)}"
```
The `\n` is a real newline escape inside the existing template literal — leave it as `\n` in source.

- [ ] **Step 3: Make the tooltip render two lines in `css/styles.css`**

The streak-dot tooltip rule `.streak-dot:hover::after` (lines 702-717) currently has `white-space: nowrap;` (line 713). Change that declaration to:
```css
    white-space: pre-line;
    text-align: center;
```
(So the `\n` in `data-day` renders as a line break and both lines are centered.)

- [ ] **Step 4: Verify**

`cp js/app.js /tmp/c.mjs && node --check /tmp/c.mjs && rm /tmp/c.mjs` — passes. `grep -n 'pre-line' css/styles.css` confirms the rule. `grep -n 'nowrap' css/styles.css` no longer shows the streak-dot rule. Playwright load: no console errors.

- [ ] **Step 5: Commit**
```bash
git add js/app.js css/styles.css
git commit -m "feat: show date in streak-dot tooltips"
```

---

## After all tasks — user verification

Subagents could only verify syntax and that the app loads. The user should then sign in and confirm, in the Firestore console and the app:

- Toggling checks, water, notes, tokens, and opening the app each append an `events` entry to the day doc with the right `type`/`ts`/`forDate` (and `via` for checks).
- Vitamins: clicking "Take vitamins" checks all 4 children (cascade events `via:"cascade"`); checking B12+Iron+D3 individually auto-checks the parent; Magnesium alone never moves the parent; un-checking works in reverse.
- Daily progress shows `/ 12`.
- Per-item notes expand via the 📝 icon, save, and survive a reload; one coalesced `note` event per writing session.
- Water buttons add 40/24/8 and subtract 8.
- Streak-dot tooltips show "Day N" + the date on two lines.
