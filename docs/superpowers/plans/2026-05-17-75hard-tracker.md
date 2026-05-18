# 75 Hard Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-file localStorage `75hard_tracker.html` into a synced, hosted, installable PWA backed by Firebase.

**Architecture:** Plain HTML/CSS/JS, no build step. The app is split into focused files; `data.js` exposes an async storage contract that is first implemented over `localStorage` (so the whole restructure is verifiable offline) and later swapped to Firestore behind the same interface. `auth.js` isolates Google sign-in. Deployed as a PWA on GitHub Pages.

**Tech Stack:** HTML, CSS, ES modules (no bundler), Firebase v10 modular SDK (Firestore + Auth) via CDN, GitHub Pages.

---

## Conventions

- **Reference spec:** `docs/superpowers/specs/2026-05-17-75hard-tracker-design.md`.
- **Source file:** the existing tracker lives at `~/Downloads/75hard_tracker.html`.
- **Local dev server:** from Task 5 onward the app uses ES modules, which browsers refuse to load over `file://`. Serve with `python3 -m http.server 8000` (run from the repo root) and open `http://localhost:8000`. Tasks 1–4 use classic scripts and also work this way — always test via the server.
- **Verification is manual** (per spec §15: no test framework). Every task ends with a concrete Verify step listing exact actions and expected results.
- Each task ends with a commit. Commit messages use Conventional Commits.

## File structure (end state)

```
index.html              markup, sign-in gate, PWA hooks
css/styles.css          all styles
js/config.js            Firebase keys + SDK init (user pastes keys)   [Phase 3]
js/auth.js              Google sign-in / sign-out / auth state        [Phase 3]
js/data.js              storage contract — localStorage, then Firestore
js/app.js               UI logic: render + event wiring
manifest.webmanifest    PWA metadata                                  [Phase 4]
service-worker.js       offline app-shell cache                       [Phase 4]
icons/                  app icons                                     [Phase 4]
firestore.rules         security rules (reference copy)               [Phase 3]
README.md               setup + usage notes
```

---

# Phase 0 — Baseline in the repo

### Task 1: Import the tracker into the repo

**Files:**
- Create: `index.html` (copied from `~/Downloads/75hard_tracker.html`)
- Create: `.gitignore`

- [ ] **Step 1: Copy the source file**

```bash
cp ~/Downloads/75hard_tracker.html ./index.html
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
*.log
```

- [ ] **Step 3: Verify**

Run: `python3 -m http.server 8000` from the repo root, open `http://localhost:8000`.
Expected: the tracker loads and looks correct; clicking checklist items toggles them; the date nav and tabs work. (Stop the server with Ctrl+C when done.)

- [ ] **Step 4: Commit**

```bash
git add index.html .gitignore
git commit -m "chore: import existing tracker as baseline"
```

---

# Phase 1 — Restructure (localStorage, behavior unchanged)

### Task 2: Extract CSS into `css/styles.css`

**Files:**
- Create: `css/styles.css`
- Modify: `index.html`

- [ ] **Step 1: Move the styles**

Cut the entire contents *between* `<style>` and `</style>` in `index.html` (currently lines ~9–771) and paste them verbatim into `css/styles.css`.

- [ ] **Step 2: Replace the `<style>` block with a link**

In `index.html` `<head>`, replace the now-empty `<style></style>` element with:

```html
<link rel="stylesheet" href="css/styles.css">
```

- [ ] **Step 3: Verify**

Serve and open the app. Expected: visually identical to Task 1 — fonts, colors, grain overlay, layout all unchanged.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "refactor: extract CSS into css/styles.css"
```

### Task 3: Extract JS into `js/app.js`

**Files:**
- Create: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Move the script**

Cut the entire contents *between* `<script>` and `</script>` at the bottom of `index.html` and paste them verbatim into `js/app.js`.

- [ ] **Step 2: Replace the inline `<script>` with a src reference**

At the bottom of `index.html` `<body>`, replace the now-empty `<script></script>` with:

```html
<script src="js/app.js"></script>
```

(Still a classic script — global functions stay global, so inline `onclick` handlers keep working for now.)

- [ ] **Step 3: Verify**

Serve and open the app. Expected: identical behavior — toggles, water buttons, tabs, date nav, notes autosave, streak bar, tokens all work exactly as before.

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js
git commit -m "refactor: extract JS into js/app.js"
```

### Task 4: Replace inline event handlers with delegated listeners

Inline `onclick` attributes block the move to ES modules (Task 5), where functions are no longer global. Replace them all with `addEventListener` wiring.

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

- [ ] **Step 1: Remove inline handlers from static markup in `index.html`**

- On each of the 11 `.check-item` elements in the Today panel: delete `onclick="toggle(this)"`. (Keep `data-key="..."`.)
- On the four water buttons in the Water panel: delete `onclick="addWater(...)"` and instead add a data attribute — e.g. `<button class="bottle-btn" data-water="8">+8 oz</button>`, `data-water="16"`, `data-water="32"`, `data-water="-8"`.
- On the Water panel Reset button: delete `onclick="resetWater()"` and add `id="waterReset"`.

- [ ] **Step 2: Remove inline handlers from generated markup in `js/app.js`**

In the `mealGrid.innerHTML` template, change `onclick="toggleMeal('${meal.key}', this)"` to `data-meal-key="${meal.key}"`.
In `renderTokens`, change `onclick="toggleToken(${i})"` to `data-token-index="${i}"`.

- [ ] **Step 3: Add a `wireEvents()` function in `js/app.js`**

Add this function and call it once from the init section (just before the final `render()` call):

```javascript
function wireEvents() {
  // Delegated checklist toggles (Today panel)
  document.getElementById('panel-today').addEventListener('click', (e) => {
    const item = e.target.closest('.check-item[data-key]');
    if (item) toggle(item);
  });

  // Delegated meal-card toggles (Meals panel)
  document.getElementById('mealGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-meal-key]');
    if (card) toggleMeal(card.dataset.mealKey, card);
  });

  // Delegated token toggles (Progress panel)
  document.getElementById('tokenRow').addEventListener('click', (e) => {
    const card = e.target.closest('[data-token-index]');
    if (card) toggleToken(Number(card.dataset.tokenIndex));
  });

  // Water buttons
  document.querySelectorAll('.bottle-btn[data-water]').forEach((btn) => {
    btn.addEventListener('click', () => addWater(Number(btn.dataset.water)));
  });
  document.getElementById('waterReset').addEventListener('click', resetWater);
}
```

- [ ] **Step 4: Verify**

Serve and open the app. Expected: clicking checklist items, meal cards, exception tokens, the water +/- buttons, and Reset all still work. The Reference panel's static `.check-item` rows (which have no `data-key`) do nothing when clicked — correct.

- [ ] **Step 5: Commit**

```bash
git add index.html js/app.js
git commit -m "refactor: replace inline handlers with delegated listeners"
```

### Task 5: Introduce the async `data.js` contract (localStorage-backed)

Create the storage layer behind the spec §7 contract, convert `app.js` to an ES module that consumes it, and make rendering async. The streak loop's 75 synchronous reads collapse to one `getAllDays()` call.

**Files:**
- Create: `js/data.js`
- Modify: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Create `js/data.js`**

```javascript
// js/data.js — storage layer. Phase 1: localStorage. Phase 3: swapped to Firestore.
// The exported contract (signatures + DayData shape) does NOT change between phases.

const DAY_PREFIX = '75h_day_';
const TOKENS_KEY = '75h_tokens';

function defaultDay() {
  return {
    checks: {},
    workouts: { 1: { done: false, note: '' }, 2: { done: false, note: '' } },
    water: 0,
    notes: '',
  };
}

function normalizeDay(d) {
  const w = d.workouts || {};
  return {
    checks: d.checks || {},
    workouts: {
      1: { done: false, note: '', ...(w[1] || w['1']) },
      2: { done: false, note: '', ...(w[2] || w['2']) },
    },
    water: d.water || 0,
    notes: d.notes || '',
  };
}

function readDay(dateKey) {
  const raw = localStorage.getItem(DAY_PREFIX + dateKey);
  return raw ? normalizeDay(JSON.parse(raw)) : defaultDay();
}

function writeDay(dateKey, day) {
  localStorage.setItem(DAY_PREFIX + dateKey, JSON.stringify(day));
}

export async function getDay(dateKey) {
  return readDay(dateKey);
}

export async function getAllDays() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DAY_PREFIX)) {
      const dateKey = k.slice(DAY_PREFIX.length);
      out[dateKey] = readDay(dateKey);
    }
  }
  return out;
}

export async function getTokens() {
  const raw = localStorage.getItem(TOKENS_KEY);
  return raw ? JSON.parse(raw) : [false, false, false];
}

export async function setCheck(dateKey, key, value) {
  const day = readDay(dateKey);
  day.checks[key] = value;
  writeDay(dateKey, day);
}

export async function setWorkout(dateKey, slot, { done, note }) {
  const day = readDay(dateKey);
  day.workouts[slot] = { done, note };
  writeDay(dateKey, day);
}

export async function setWater(dateKey, oz) {
  const day = readDay(dateKey);
  day.water = oz;
  writeDay(dateKey, day);
}

export async function setNotes(dateKey, text) {
  const day = readDay(dateKey);
  day.notes = text;
  writeDay(dateKey, day);
}

export async function setToken(index, used) {
  const tokens = await getTokens();
  tokens[index] = used;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}
```

- [ ] **Step 2: Make `index.html` load `app.js` as a module**

Change `<script src="js/app.js"></script>` to:

```html
<script type="module" src="js/app.js"></script>
```

- [ ] **Step 3: Import the contract at the top of `js/app.js`**

Add as the first line of `js/app.js`:

```javascript
import { getDay, getAllDays, getTokens, setCheck, setWorkout, setWater, setNotes, setToken } from './data.js';
```

- [ ] **Step 4: Fix the timezone-unsafe `dateKey` function in `js/app.js`**

The original `dateKey` uses `toISOString()`, which converts local time to UTC and produces the *wrong day* for anyone west of UTC (e.g. Pacific). Replace it with a timezone-safe version:

```javascript
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

Also change the `START`/`END` constants so they parse as **local** midnight, not UTC:

```javascript
const START = new Date('2026-05-18T00:00:00');
const END   = new Date('2026-08-01T00:00:00');
```

- [ ] **Step 5: Add module-level state and helpers in `js/app.js`**

To support optimistic UI (instant interactions) and contain write errors (spec §11), add these module-level variables and helpers near the top of `js/app.js`, just after the import line:

```javascript
let currentDay = null;                       // DayData for viewDate, kept in sync with the DOM
let currentTokens = [false, false, false];   // exception tokens
let allDays = {};                            // { dateKey: DayData } — cache for the streak bar

// Fire-and-forget write with error containment. On failure, flag the body
// and re-render from the source of truth (which reverts the optimistic change).
function persist(promise) {
  promise.catch((err) => {
    console.error('Save failed:', err);
    document.body.classList.add('save-error');
    setTimeout(() => document.body.classList.remove('save-error'), 4000);
    render();
  });
}

// Recompute the daily progress bar from currentDay.
function updateDailyProgress() {
  const checked = CHECKLIST_KEYS.filter((k) => currentDay.checks[k]).length;
  document.getElementById('dpChecked').textContent = checked;
  document.getElementById('dpFill').style.width = (checked / CHECKLIST_KEYS.length * 100) + '%';
}
```

- [ ] **Step 6: Convert `render()` and the render helpers to async in `js/app.js`**

Delete the old `loadDay`, `saveDay`, `loadTokens`, `saveTokens` functions. Then:

- Make `render()` `async`. Near its top, fetch all state and share the `currentDay` object into the cache so the streak bar stays live:

```javascript
const key = dateKey(viewDate);
currentDay = await getDay(key);
allDays = await getAllDays();
allDays[key] = currentDay;     // same object reference — handler edits show in the streak bar
currentTokens = await getTokens();
```

- Replace the streak-calculation `while` loop and global stats with a read from `allDays`:

```javascript
let streak = 0, completedCount = 0;
const checkDate = new Date(today);
while (checkDate >= START) {
  const dd = allDays[dateKey(checkDate)] || { checks: {} };
  const checked = Object.values(dd.checks).filter(Boolean).length;
  if (checked === CHECKLIST_KEYS.length) {
    completedCount++;
    if (checkDate <= today) streak++;
  } else if (checkDate < today) {
    break;
  }
  checkDate.setDate(checkDate.getDate() - 1);
}
```

- Replace `render()`'s existing inline daily-progress code with a call to `updateDailyProgress()`.
- Change `renderStreakBar()` to read the module-level `allDays`: replace its internal `loadDay(d)` call with `allDays[dateKey(d)] || { checks: {} }`. It stays synchronous and takes no parameter.
- Change `renderTokens()` to render from the module-level `currentTokens` (remove its `loadTokens` call; it stays synchronous and takes no parameter).

- [ ] **Step 7: Rewrite the interaction handlers in `js/app.js`**

Replace the bodies of the five handlers and the notes listener. Each updates `currentDay`/`currentTokens` and the DOM immediately, then calls `persist()` (fire-and-forget):

```javascript
function toggle(el) {
  const key = el.dataset.key;
  const next = !currentDay.checks[key];
  currentDay.checks[key] = next;
  el.classList.toggle('checked', next);
  if (next) spawnBurst(el);
  updateDailyProgress();
  renderStreakBar();
  persist(setCheck(dateKey(viewDate), key, next));
}

function toggleMeal(key, el) {
  const next = !currentDay.checks[key];
  currentDay.checks[key] = next;
  el.classList.toggle('checked', next);
  if (next) spawnBurst(el);
  const todayEl = document.querySelector('.check-item[data-key="' + key + '"]');
  if (todayEl) todayEl.classList.toggle('checked', next);
  updateDailyProgress();
  persist(setCheck(dateKey(viewDate), key, next));
}

function addWater(oz) {
  currentDay.water = Math.max(0, Math.min(200, (currentDay.water || 0) + oz));
  renderWater(currentDay.water);
  persist(setWater(dateKey(viewDate), currentDay.water));
}

function resetWater() {
  currentDay.water = 0;
  renderWater(0);
  persist(setWater(dateKey(viewDate), 0));
}

function toggleToken(i) {
  currentTokens[i] = !currentTokens[i];
  renderTokens();
  persist(setToken(i, currentTokens[i]));
}
```

For the notes autosave listener, replace its `loadDay`/`saveDay` body with:

```javascript
currentDay.notes = this.value;
persist(setNotes(dateKey(viewDate), this.value));
```

- [ ] **Step 8: Verify**

Serve via `python3 -m http.server 8000`. Open `http://localhost:8000`. Expected:
- App loads with no console errors.
- Toggling checklist items, meal cards, water, tokens, and notes all persist across a page reload.
- The Progress tab streak bar reflects completed days, and updates immediately when you complete a day on the Today tab.
- DevTools → Application → Local Storage still shows `75h_day_*` keys being written.

- [ ] **Step 9: Commit**

```bash
git add index.html js/app.js js/data.js
git commit -m "refactor: add async data.js contract, convert app to ES module"
```

---

# Phase 2 — New features (still localStorage)

### Task 6: Challenge window + buffer days

Implement the 75-day-plus-9-buffer window (spec §9): nav clamping, "Buffer +N" labels, ring cap, buffer markers on the streak bar.

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`

- [ ] **Step 1: Replace the window constants in `js/app.js`**

Replace `START`, `END`, `TOTAL_DAYS`:

```javascript
const START         = new Date('2026-05-18T00:00:00'); // Day 1
const CHALLENGE_END  = new Date('2026-07-31T00:00:00'); // Day 75
const NAV_END        = new Date('2026-08-09T00:00:00'); // last navigable day
const TOTAL_DAYS     = 75;
```

Remove every remaining reference to the old `END` constant; replace `END`-based math with `CHALLENGE_END` (for "days left") and `NAV_END` (for nav bounds). For "days left": `Math.max(0, Math.ceil((CHALLENGE_END - today) / 86400000))`.

- [ ] **Step 2: Add a `dayLabel()` helper in `js/app.js`**

```javascript
function dayLabel(d) {
  const n = dayNumber(d);
  if (n < 1) return 'Challenge starts May 18';
  if (n <= TOTAL_DAYS) return `Day <span>${n}</span> of 75`;
  return `Buffer <span>+${n - TOTAL_DAYS}</span>`;
}
```

In `render()`, set `document.getElementById('dayInfoDisplay').innerHTML = dayLabel(viewDate);` (replacing the old inline `dayInfo` if/else block). The old `isInChallenge()` function is now unused — delete it.

- [ ] **Step 3: Clamp date navigation in `js/app.js`**

In the `prevDay` / `nextDay` click handlers, guard the bounds, and after rendering, disable the buttons at the edges:

```javascript
function clampNav() {
  document.getElementById('prevDay').disabled = viewDate <= START;
  document.getElementById('nextDay').disabled = viewDate >= NAV_END;
}
```

In `prevDay.onclick`: `if (viewDate <= START) return;` before decrementing. In `nextDay.onclick`: `if (viewDate >= NAV_END) return;` before incrementing. Call `clampNav()` at the end of `render()`.

- [ ] **Step 4: Style the disabled nav buttons in `css/styles.css`**

```css
.date-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.date-nav-btn:disabled:hover { border-color: var(--border); color: var(--text-muted); }
```

- [ ] **Step 5: Add buffer markers to the streak bar in `js/app.js`**

In `renderStreakBar()`, after the existing 75-dot loop, append up to 9 buffer dots (uses the module-level `allDays`):

```javascript
for (let i = 0; i < 9; i++) {
  const d = new Date(CHALLENGE_END);
  d.setDate(d.getDate() + i + 1);
  const dd = allDays[dateKey(d)] || { checks: {} };
  const done = Object.values(dd.checks).filter(Boolean).length === CHECKLIST_KEYS.length;
  html += `<div class="streak-dot buffer${done ? ' complete' : ''}" data-day="Buffer +${i+1}"></div>`;
}
```

(This uses the same completion check as the existing 75-dot loop. Task 8 upgrades both this loop and the 75-dot loop to `dayCompletedCount(dd) === DAILY_TOTAL` once workout state moves out of `checks`.)

- [ ] **Step 6: Style buffer dots in `css/styles.css`**

```css
.streak-dot.buffer { border-style: dashed; opacity: 0.7; }
.streak-bar .buffer:first-of-type { margin-left: 10px; }
```

- [ ] **Step 7: Verify**

Serve and open the app. Expected:
- Navigate the date forward to Aug 1 → header reads "Buffer +1"; Aug 5 → "Buffer +5".
- At May 18 the `←` button is disabled; at Aug 9 the `→` button is disabled.
- The Progress tab shows 75 solid-bordered dots followed by 9 dashed-bordered buffer dots.

- [ ] **Step 8: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: add 75-day challenge window with 9 buffer days"
```

### Task 7: Future-day notes-only rule

On days after today, disable every completion input; keep the Notes textarea editable (spec §10).

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `css/styles.css`

- [ ] **Step 1: Add a future-day banner element to `index.html`**

Inside `<div class="panel active" id="panel-today">`, as the first child (before `.daily-progress`):

```html
<div class="future-banner" id="futureBanner">Future day — notes only</div>
```

- [ ] **Step 2: Add an `isFuture()` helper and apply a body class in `js/app.js`**

```javascript
function isFuture(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d > today;
}
```

In `render()`, after computing the view: `document.body.classList.toggle('future-view', isFuture(viewDate));`

- [ ] **Step 3: Guard every completion handler in `js/app.js`**

At the top of `toggle()`, `toggleMeal()`, `addWater()`, and `resetWater()`, add:

```javascript
if (isFuture(viewDate)) return;
```

(Do **not** guard the notes autosave listener or `toggleToken()` — notes stay editable on future days, and tokens are not day-scoped.)

- [ ] **Step 4: Style the locked state in `css/styles.css`**

```css
.future-banner {
  display: none;
  background: rgba(224,122,58,0.12);
  border: 1px solid rgba(224,122,58,0.3);
  color: var(--accent2);
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 8px 12px;
  border-radius: 5px;
  margin-bottom: 16px;
  text-align: center;
}
body.future-view .future-banner { display: block; }
body.future-view .check-group .check-item,
body.future-view .meal-grid,
body.future-view .water-tracker .water-bottles,
body.future-view #waterReset {
  opacity: 0.4;
  pointer-events: none;
}
/* Notes stay fully usable */
body.future-view .notes-area { opacity: 1; pointer-events: auto; }
```

- [ ] **Step 5: Verify**

Serve and open the app. Expected:
- Navigate to tomorrow → the orange "Future day — notes only" banner appears; checklist items, meal cards, and water buttons are dimmed and unclickable.
- The Notes textarea on a future day still accepts text and saves it (reload, navigate back to that day → note persists).
- Navigate back to today → everything is interactive again.

- [ ] **Step 6: Commit**

```bash
git add index.html js/app.js css/styles.css
git commit -m "feat: future days are notes-only"
```

### Task 8: Workout logging (done + free-text note)

Move workout completion out of `checks` into the `workouts` map and add a free-text "what I actually did" field per workout (spec §6, §8.3).

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/styles.css`

- [ ] **Step 1: Restructure the two workout check-items in `index.html`**

Replace the `data-key="workout1"` check-item (Morning section) and the `data-key="workout2"` check-item (Evening section). Each becomes a check-item with `data-workout="1"` / `data-workout="2"` (no `data-key`), and gains a text input. For workout 1:

```html
<div class="check-item workout-item" data-workout="1">
  <div class="checkbox"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
  <span class="check-emoji" id="w1emoji">🚴</span>
  <div class="check-label">
    <span id="w1label">Workout #1 — 45 min</span>
    <span class="sub" id="w1sub">Indoor · See workout tab for today's type</span>
    <input type="text" class="workout-note" id="w1note" placeholder="What did you actually do?">
  </div>
</div>
```

Do the same for workout 2 with `data-workout="2"`, `id="w2..."`, and `id="w2note"`.

- [ ] **Step 2: Update the checklist constants in `js/app.js`**

```javascript
const CHECKLIST_KEYS = ['water_wake','photo','breakfast','lunch','snack','dinner','sweet','water_total','reading']; // 9
const DAILY_TOTAL = 11; // 9 checks + 2 workout done flags

function dayCompletedCount(day) {
  const checks = Object.values(day.checks || {}).filter(Boolean).length;
  const w = day.workouts || { 1: {}, 2: {} };
  return checks + (w[1] && w[1].done ? 1 : 0) + (w[2] && w[2].done ? 1 : 0);
}
```

Now that workouts no longer live in `checks`, day-completion must also count the 2 workout `done` flags. Update all three places that test day-completion to use `dayCompletedCount(dd) === DAILY_TOTAL`:

- `render()`'s streak `while` loop — replace `checked === CHECKLIST_KEYS.length` with `dayCompletedCount(dd) === DAILY_TOTAL`.
- `renderStreakBar()`'s 75-dot loop — replace its `checked === CHECKLIST_KEYS.length` with `dayCompletedCount(dd) === DAILY_TOTAL`.
- `renderStreakBar()`'s buffer-dot loop (Task 6) — replace `Object.values(dd.checks).filter(Boolean).length === CHECKLIST_KEYS.length` with `dayCompletedCount(dd) === DAILY_TOTAL`.
- Replace the body of `updateDailyProgress()` (added in Task 5) so it counts via `dayCompletedCount`:

```javascript
function updateDailyProgress() {
  const checked = dayCompletedCount(currentDay);
  document.getElementById('dpChecked').textContent = checked;
  document.getElementById('dpFill').style.width = (checked / DAILY_TOTAL * 100) + '%';
}
```

The `#dpTotal` element in `index.html` already reads `11` — leave it as is.

- [ ] **Step 3: Render workout state in `render()` in `js/app.js`**

After `currentDay` is set, for each slot `s` in `[1, 2]`:

```javascript
[1, 2].forEach((s) => {
  const item = document.querySelector(`.workout-item[data-workout="${s}"]`);
  item.classList.toggle('checked', !!currentDay.workouts[s].done);
  document.getElementById('w' + s + 'note').value = currentDay.workouts[s].note || '';
});
```

- [ ] **Step 4: Add workout event wiring in `wireEvents()` in `js/app.js`**

```javascript
document.querySelectorAll('.workout-item[data-workout]').forEach((item) => {
  const slot = Number(item.dataset.workout);
  const noteEl = document.getElementById('w' + slot + 'note');
  // Toggle done — but not when the click originated in the text input
  item.addEventListener('click', (e) => {
    if (e.target === noteEl) return;
    if (isFuture(viewDate)) return;
    toggleWorkout(slot, item);
  });
  // Debounced note save
  let t;
  noteEl.addEventListener('input', () => {
    if (isFuture(viewDate)) return;
    clearTimeout(t);
    currentDay.workouts[slot].note = noteEl.value;
    t = setTimeout(() => {
      persist(setWorkout(dateKey(viewDate), slot, currentDay.workouts[slot]));
    }, 500);
  });
});
```

- [ ] **Step 5: Add `toggleWorkout()` in `js/app.js`**

```javascript
function toggleWorkout(slot, item) {
  const next = !currentDay.workouts[slot].done;
  currentDay.workouts[slot].done = next;
  item.classList.toggle('checked', next);
  if (next) spawnBurst(item);
  updateDailyProgress();
  renderStreakBar();
  persist(setWorkout(dateKey(viewDate), slot, currentDay.workouts[slot]));
}
```

- [ ] **Step 6: Style the workout note input in `css/styles.css`**

```css
.workout-note {
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
.workout-note:focus { outline: none; border-color: var(--accent); }
.workout-note::placeholder { color: var(--text-dim); }
```

- [ ] **Step 7: Verify**

Serve and open the app. Expected:
- Each workout item has a "What did you actually do?" text field.
- Clicking a workout item (away from the text field) toggles its done state and confetti; the daily progress counts it toward `/11`.
- Typing in a workout note and reloading the page keeps the text.
- Clicking inside the text field does NOT toggle the checkbox.
- Completing all 9 checks + both workouts marks the day complete in the streak bar.

- [ ] **Step 8: Commit**

```bash
git add index.html js/app.js css/styles.css
git commit -m "feat: per-workout done state and free-text logging"
```

### Task 9: MyFitnessPal shortcut

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`

- [ ] **Step 1: Add the shortcut button to the Meals panel in `index.html`**

Immediately after `<div class="section-header">Today's Meals</div>` in `#panel-meals`:

```html
<a class="mfp-link" href="https://www.myfitnesspal.com/food/diary" target="_blank" rel="noopener">
  📲 Open MyFitnessPal to log
</a>
```

(A universal link: on a device with the MFP app installed it opens the app; otherwise the website.)

- [ ] **Step 2: Style the button in `css/styles.css`**

```css
.mfp-link {
  display: inline-block;
  margin-bottom: 16px;
  background: var(--bg3);
  border: 1px solid var(--border2);
  color: var(--accent2);
  text-decoration: none;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.5px;
  padding: 8px 14px;
  border-radius: 5px;
  transition: all 0.15s;
}
.mfp-link:hover { border-color: var(--accent2); }
```

- [ ] **Step 3: Verify**

Serve and open the app, go to the Meals tab. Expected: an "Open MyFitnessPal to log" button appears above the meal cards and opens MyFitnessPal in a new tab when clicked.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: add MyFitnessPal shortcut on Meals tab"
```

---

# Phase 3 — Firebase sync

### Task 10: Firebase project setup + `config.js`

**This task is performed by the user** (the Firebase console cannot be automated). The implementing agent should pause here and surface these instructions.

**Files:**
- Create: `js/config.js`
- Create: `firestore.rules`

- [ ] **Step 1: User creates the Firebase project**

1. Go to <https://console.firebase.google.com> → **Add project** → name it `75hard` → disable Google Analytics → Create.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** (set a support email) → Save.
3. **Build → Firestore Database → Create database** → Start in **production mode** → pick a location → Enable.
4. **Project settings (gear icon) → General → Your apps → Web (`</>`)** → register an app named `75hard` (do NOT enable Hosting) → copy the `firebaseConfig` object shown.

- [ ] **Step 2: Create `js/config.js`** (user pastes their real values)

```javascript
// js/config.js — Firebase init. Paste YOUR firebaseConfig values below.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

const app = initializeApp(firebaseConfig);

// Offline persistence so the app works with no signal and syncs on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);
```

- [ ] **Step 3: Create `firestore.rules`** (reference copy of the rules; also paste into the console)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

In the Firebase console: **Firestore Database → Rules**, replace the contents with the above, **Publish**.

- [ ] **Step 4: Verify**

`js/config.js` exists with real (non-`PASTE_`) values. `firestore.rules` exists and the same rules are published in the console (the Rules tab shows them).

- [ ] **Step 5: Commit**

```bash
git add js/config.js firestore.rules
git commit -m "chore: add Firebase config and Firestore security rules"
```

### Task 11: Create `js/auth.js`

**Files:**
- Create: `js/auth.js`

- [ ] **Step 1: Create `js/auth.js`**

```javascript
// js/auth.js — Google sign-in. The ONLY file that touches the auth flow.
import { auth } from './config.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let currentUser = null;
const provider = new GoogleAuthProvider();

export function onAuthChange(cb) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    cb(user);
  });
}

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function signOut() {
  return fbSignOut(auth);
}

export function getCurrentUser() {
  return currentUser;
}
```

> Note: if `signInWithPopup` proves unreliable inside the installed iOS PWA later, switch to `signInWithRedirect` (imported from the same module) — same provider, no other change.

- [ ] **Step 2: Verify**

In the browser console on the served app, run `import('./js/auth.js').then(m => console.log(Object.keys(m)))`.
Expected: logs `["onAuthChange", "signIn", "signOut", "getCurrentUser"]` with no errors.

- [ ] **Step 3: Commit**

```bash
git add js/auth.js
git commit -m "feat: add auth.js with Google sign-in"
```

### Task 12: Sign-in gate

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/app.js`

- [ ] **Step 1: Add the gate markup to `index.html`**

Immediately after `<body>`, before `<div class="app">`:

```html
<div class="signin-gate" id="signinGate">
  <div class="signin-card">
    <h1>75 Hard</h1>
    <p>Sign in to track your challenge across all your devices.</p>
    <button id="signinBtn">Sign in with Google</button>
  </div>
</div>
```

Add `id="appRoot"` to the existing `<div class="app">`.

- [ ] **Step 2: Add a Sign-out control to `index.html`**

Inside `.topbar`, after the `.progress-block` div:

```html
<button class="signout-btn" id="signoutBtn">Sign out</button>
```

- [ ] **Step 3: Style the gate in `css/styles.css`**

```css
.signin-gate {
  display: none;
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 2000;
  align-items: center;
  justify-content: center;
}
.signin-gate.visible { display: flex; }
.signin-card { text-align: center; padding: 32px; max-width: 320px; }
.signin-card h1 {
  font-family: 'Playfair Display', serif;
  font-size: 44px; font-weight: 900; color: var(--accent);
}
.signin-card p { color: var(--text-muted); font-size: 12px; margin: 12px 0 24px; }
.signin-card button, .signout-btn {
  background: var(--bg3); border: 1px solid var(--border2);
  color: var(--text); font-family: 'DM Mono', monospace;
  font-size: 12px; padding: 10px 18px; border-radius: 5px; cursor: pointer;
}
.signin-card button:hover, .signout-btn:hover { border-color: var(--accent); color: var(--accent); }
.signout-btn { font-size: 9px; padding: 5px 10px; align-self: flex-start; }
#appRoot { display: none; }
#appRoot.visible { display: block; }
```

- [ ] **Step 4: Wire auth state in `js/app.js`**

Add to the imports: `import { onAuthChange, signIn, signOut, getCurrentUser } from './auth.js';`

Replace the bare `render()` call in the init section with:

```javascript
const gate = document.getElementById('signinGate');
const appRoot = document.getElementById('appRoot');

document.getElementById('signinBtn').addEventListener('click', () => {
  signIn().catch((e) => alert('Sign-in failed: ' + e.message));
});
document.getElementById('signoutBtn').addEventListener('click', () => signOut());

wireEvents();

onAuthChange((user) => {
  if (user) {
    gate.classList.remove('visible');
    appRoot.classList.add('visible');
    render();
  } else {
    appRoot.classList.remove('visible');
    gate.classList.add('visible');
  }
});
```

Remove the standalone `render()` and `wireEvents()` calls that ran unconditionally at load.

- [ ] **Step 5: Verify**

Serve and open the app. Expected:
- The sign-in screen shows first.
- Clicking "Sign in with Google" opens the Google popup; after signing in, the tracker appears.
- A "Sign out" button in the top bar returns you to the sign-in screen.
- (Data still reads/writes localStorage at this point — Firestore swap is Task 13.)

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: add Google sign-in gate"
```

### Task 13: Swap `data.js` to Firestore

Rewrite `data.js` internals to use Firestore. The exported signatures and `DayData` shape are unchanged, so `app.js` needs no changes.

**Files:**
- Modify: `js/data.js` (full rewrite of the body; same exports)

- [ ] **Step 1: Rewrite `js/data.js`**

```javascript
// js/data.js — Firestore-backed storage layer. Same contract as the localStorage version.
import { db } from './config.js';
import { getCurrentUser } from './auth.js';
import {
  doc, getDoc, getDocs, collection, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function uid() {
  const u = getCurrentUser();
  if (!u) throw new Error('Not signed in');
  return u.uid;
}

function dayRef(dateKey) {
  return doc(db, 'users', uid(), 'days', dateKey);
}

function defaultDay() {
  return {
    checks: {},
    workouts: { 1: { done: false, note: '' }, 2: { done: false, note: '' } },
    water: 0,
    notes: '',
  };
}

function normalizeDay(d) {
  const w = d.workouts || {};
  return {
    checks: d.checks || {},
    workouts: {
      1: { done: false, note: '', ...(w['1']) },
      2: { done: false, note: '', ...(w['2']) },
    },
    water: d.water || 0,
    notes: d.notes || '',
  };
}

export async function getDay(dateKey) {
  const snap = await getDoc(dayRef(dateKey));
  return snap.exists() ? normalizeDay(snap.data()) : defaultDay();
}

export async function getAllDays() {
  const snap = await getDocs(collection(db, 'users', uid(), 'days'));
  const out = {};
  snap.forEach((d) => { out[d.id] = normalizeDay(d.data()); });
  return out;
}

export async function getTokens() {
  const snap = await getDoc(doc(db, 'users', uid(), 'meta', 'state'));
  return snap.exists() && snap.data().tokens ? snap.data().tokens : [false, false, false];
}

// set* use setDoc({merge:true}): deep-merges a single field path, and also
// creates the document if it does not exist yet (updateDoc would fail on a new day).
export async function setCheck(dateKey, key, value) {
  await setDoc(dayRef(dateKey),
    { checks: { [key]: value }, updatedAt: serverTimestamp() },
    { merge: true });
}

export async function setWorkout(dateKey, slot, { done, note }) {
  await setDoc(dayRef(dateKey),
    { workouts: { [slot]: { done, note } }, updatedAt: serverTimestamp() },
    { merge: true });
}

export async function setWater(dateKey, oz) {
  await setDoc(dayRef(dateKey),
    { water: oz, updatedAt: serverTimestamp() },
    { merge: true });
}

export async function setNotes(dateKey, text) {
  await setDoc(dayRef(dateKey),
    { notes: text, updatedAt: serverTimestamp() },
    { merge: true });
}

export async function setToken(index, used) {
  const tokens = await getTokens();
  tokens[index] = used;
  await setDoc(doc(db, 'users', uid(), 'meta', 'state'), { tokens }, { merge: true });
}
```

- [ ] **Step 2: Verify (single device)**

Serve and open the app, sign in. Expected:
- Toggle several checklist items, add water, write a note, log a workout.
- In the Firebase console → Firestore Database → Data: a `users/{your-uid}/days/{today}` document exists with `checks`, `water`, `notes`, `workouts`.
- Reload the page → all values are still there (now loaded from Firestore, not localStorage).

- [ ] **Step 3: Verify (cross-device sync)**

Open the served app in a second browser profile (or another device on the same network using your machine's LAN IP), sign in with the same Google account. Toggle something in one, reload the other. Expected: the change appears.

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat: back data layer with Firestore"
```

### Task 14: Offline indicator + refresh-on-refocus

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/app.js`

- [ ] **Step 1: Add the indicator elements to `index.html`**

As the first children of `<div class="app" id="appRoot">`:

```html
<div class="offline-bar" id="offlineBar">Offline — changes will sync when you reconnect</div>
<div class="save-error-bar" id="saveErrorBar">Couldn't save — check your connection</div>
```

The `save-error-bar` is shown by the `persist()` helper from Task 5, which adds the `save-error` class to `<body>` for 4 seconds when a write fails.

- [ ] **Step 2: Style both bars in `css/styles.css`**

```css
.offline-bar, .save-error-bar {
  display: none;
  background: rgba(224,122,58,0.15);
  border: 1px solid rgba(224,122,58,0.4);
  color: var(--accent2);
  font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
  text-align: center; padding: 7px; border-radius: 5px; margin-bottom: 16px;
}
body.offline .offline-bar { display: block; }
body.save-error .save-error-bar { display: block; }
```

- [ ] **Step 3: Wire connectivity + refocus in `js/app.js`**

Add to the init section:

```javascript
function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

// Re-read from the backend when the app/window regains focus — catches
// edits made on another device (spec §7: no live listeners in v1).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && getCurrentUser()) render();
});
```

- [ ] **Step 4: Verify**

Serve and open the app, sign in. Expected:
- DevTools → Network → set to "Offline": the orange offline bar appears; toggling items still works (queued locally).
- Set back to "Online": the bar disappears; the Firestore console shows the queued writes arrive.
- Edit a value in a second browser profile, then switch back to the first tab → on refocus the value updates.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: offline indicator and refresh-on-refocus"
```

---

# Phase 4 — PWA

### Task 15: App icon + manifest

**Files:**
- Create: `icons/icon.svg`
- Create: `icons/apple-touch-icon.png`
- Create: `manifest.webmanifest`
- Modify: `index.html`

- [ ] **Step 1: Create `icons/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f0e0c"/>
  <text x="256" y="330" font-family="Georgia, 'Playfair Display', serif"
        font-size="240" font-weight="900" fill="#e8c547" text-anchor="middle">75</text>
</svg>
```

- [ ] **Step 2: Create `icons/apple-touch-icon.png`**

iOS home-screen icons must be PNG. Generate a 180×180 PNG from `icon.svg`: open `icons/icon.svg` in the macOS **Preview** app → **File → Export** → Format **PNG** → save as `icons/apple-touch-icon.png`. (Exact pixel size is not critical; 180×180 or larger is fine.)

- [ ] **Step 3: Create `manifest.webmanifest`**

```json
{
  "name": "75 Hard Tracker",
  "short_name": "75 Hard",
  "description": "Personal 75 Hard challenge tracker",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f0e0c",
  "theme_color": "#0f0e0c",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 4: Link the manifest and icons in `index.html` `<head>`**

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0f0e0c">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
```

- [ ] **Step 5: Verify**

Serve and open the app. DevTools → Application → Manifest. Expected: the manifest loads with name "75 Hard Tracker", no errors, and the icon previews.

- [ ] **Step 6: Commit**

```bash
git add icons/ manifest.webmanifest index.html
git commit -m "feat: add PWA manifest and app icons"
```

### Task 16: Service worker (offline app shell)

**Files:**
- Create: `service-worker.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `service-worker.js`**

```javascript
const CACHE = '75hard-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/data.js', './js/auth.js', './js/config.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only handle our own origin; Firebase/gstatic traffic goes straight to the network.
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

- [ ] **Step 2: Register the service worker in `js/app.js`**

Add to the init section:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
```

- [ ] **Step 3: Verify**

Serve and open the app. DevTools → Application → Service Workers. Expected: the worker is registered and "activated". Reload with Network set to "Offline" → the app shell still loads (sign-in screen appears even offline).

> Note: the Firebase SDK is loaded cross-origin from gstatic.com and is not in the app-shell cache; a brand-new device must be online once for the SDK to load. After that, Firestore's own offline persistence serves data.

- [ ] **Step 4: Commit**

```bash
git add service-worker.js js/app.js
git commit -m "feat: add service worker for offline app shell"
```

---

# Phase 5 — Deploy

### Task 17: Publish to GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# 75 Hard Tracker

A personal, synced 75 Hard challenge tracker. Plain HTML/CSS/JS, no build step,
Firebase-backed, installable as a PWA.

## Setup

1. Create a Firebase project (Auth → Google enabled, Firestore created).
2. Paste your Firebase web config into `js/config.js`.
3. Publish the rules in `firestore.rules` to Firestore.
4. Add your GitHub Pages domain to Firebase Auth → Settings → Authorized domains.

## Run locally

    python3 -m http.server 8000

Open <http://localhost:8000>.

## Deploy

Hosted via GitHub Pages from the `main` branch.
```

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: add README"
git remote add origin https://github.com/<your-username>/75hard.git   # if not already set
git push -u origin main
```

- [ ] **Step 3: User enables GitHub Pages**

On GitHub: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / root → Save**. Wait for the deployment; note the URL `https://<your-username>.github.io/75hard/`.

- [ ] **Step 4: User adds the domain to Firebase**

Firebase console → **Authentication → Settings → Authorized domains → Add domain** → enter `<your-username>.github.io`.

- [ ] **Step 5: Restrict the API key (recommended)**

Google Cloud Console → **APIs & Services → Credentials** → the auto-created Browser key → **Application restrictions → Websites** → add `<your-username>.github.io/*`.

- [ ] **Step 6: Verify**

Open `https://<your-username>.github.io/75hard/` on your phone. Expected:
- Sign in with Google works.
- Toggle items; open the URL on a second device, sign in, reload → data is shared.
- In Safari: Share → **Add to Home Screen** → the app installs with the "75" icon and launches full-screen.

- [ ] **Step 7: Commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: deployment fixes"
git push
```

---

## Done

The tracker is now a synced, installable, hosted PWA. Future work (out of scope, per spec §16): a native React Native app reusing the Firestore backend and the `data.js` contract.
