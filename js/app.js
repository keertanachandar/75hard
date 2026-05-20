import { getDay, getAllDays, getTokens, setCheck, setWorkoutDone, setVitamin, setWater, setNotes, setItemNote, setToken, logAppOpen } from './data.js';
import { onAuthChange, signIn, signOut, getCurrentUser } from './auth.js';

  // ── Constants ──────────────────────────────────────────
  const START         = new Date('2026-05-18T00:00:00'); // Day 1
  const CHALLENGE_END  = new Date('2026-07-31T00:00:00'); // Day 75
  const NAV_END        = new Date('2026-08-09T00:00:00'); // last navigable day
  const TOTAL_DAYS     = 75;

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const WORKOUTS = {
    1: { emoji:'🚴', label:'Peloton', tag:'tag-cardio', sub:'45 min · indoor cardio' },
    2: { emoji:'💪', label:'Strength Training', tag:'tag-strength', sub:'Functional training or ClassPass strength' },
    3: { emoji:'🚴', label:'Peloton', tag:'tag-cardio', sub:'45 min · indoor cardio' },
    4: { emoji:'💪', label:'Strength Training', tag:'tag-strength', sub:'Functional training or ClassPass strength' },
    5: { emoji:'🧘', label:'Recovery Yoga', tag:'tag-recovery', sub:'At home or ClassPass yoga · light day' },
    6: { emoji:'💪', label:'Strength or Peloton', tag:'tag-strength', sub:'Your choice · weekend flexibility' },
    0: { emoji:'🚴', label:'Long Bike Ride or Hike', tag:'tag-outdoor', sub:'Weekend outdoor workout' },
  };

  const MEALS = {
    1: { // Monday
      lunch: { name:'Salad mix bowl', detail:'Crispy chickpeas + tofu + soft boiled egg + olive oil lemon dressing' },
      dinner: { name:'🌯 Chipotle bowl', detail:'Sofritas + beans + guac · no tortilla · order at 5pm' },
    },
    2: { // Tuesday
      lunch: { name:'Salad mix bowl', detail:'Crispy chickpeas + tofu + soft boiled egg' },
      dinner: { name:'🍳 Cauliflower fried rice', detail:'Eggs + edamame + carrots · make 2 portions' },
    },
    3: { // Wednesday
      lunch: { name:'Tuesday leftovers', detail:'Cauliflower fried rice from last night' },
      dinner: { name:'🍳 Cauliflower fried rice (bag 2)', detail:'Make 2 portions → covers Wed + Thu dinner' },
    },
    4: { // Thursday
      lunch: { name:'Wednesday leftovers', detail:'Cauliflower fried rice' },
      dinner: { name:'⚡ Wednesday leftovers reheated', detail:'Eat by 6pm · leave for improv 6:30pm' },
    },
    5: { // Friday
      lunch: { name:'Thursday leftovers', detail:'From Wednesday cook' },
      dinner: { name:'🍕 Homemade pizza or clean takeout', detail:'Indian · Mediterranean · Thai · Chipotle' },
    },
    6: { // Saturday
      lunch: { name:'Flexible', detail:'Follow diet rules · log in MFP' },
      dinner: { name:'Flexible', detail:'Cook or clean takeout · plan Friday night' },
    },
    0: { // Sunday
      lunch: { name:'Flexible', detail:'Follow diet rules · log in MFP' },
      dinner: { name:'Flexible + Sunday prep', detail:'Hard boil eggs · air fry chickpeas + tofu · portion berries' },
    },
  };

  // Threshold the water_total check derives from. Keep in sync with the
  // last WATER_CHECKPOINTS entry.
  const WATER_GOAL_OZ = 100;
  const WATER_CHECKPOINTS = [
    { label: 'Wakeup', oz: 16 },
    { label: 'Breakfast', oz: 32 },
    { label: 'Lunch', oz: 48 },
    { label: 'Afternoon snack', oz: 64 },
    { label: 'Pre-workout #2', oz: 80 },
    { label: 'Dinner + evening', oz: WATER_GOAL_OZ },
  ];

  const CHECKLIST_KEYS = ['water_wake','vitamins','photo','breakfast','lunch','snack','dinner','sweet','water_total','reading']; // 10
  const DAILY_TOTAL = 12; // 10 checks + 2 workout done flags

  function dayCompletedCount(day) {
    const checks = Object.values(day.checks || {}).filter(Boolean).length;
    const w = day.workouts || { 1: {}, 2: {} };
    return checks + (w[1] && w[1].done ? 1 : 0) + (w[2] && w[2].done ? 1 : 0);
  }

  // ── State ──────────────────────────────────────────────
  let viewDate = new Date();
  viewDate.setHours(0,0,0,0);

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

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
      render().catch((err2) => console.error('Recovery render failed:', err2));
    });
  }

  // Recompute the daily progress bar from currentDay.
  function updateDailyProgress() {
    const checked = dayCompletedCount(currentDay);
    document.getElementById('dpChecked').textContent = checked;
    document.getElementById('dpFill').style.width = (checked / DAILY_TOTAL * 100) + '%';
  }

  // ── Helpers ────────────────────────────────────────────
  function dayNumber(d) {
    const diff = Math.floor((d - START) / 86400000) + 1;
    return diff;
  }

  function dayLabel(d) {
    const n = dayNumber(d);
    if (n < 1) return 'Challenge starts May 18';
    if (n <= TOTAL_DAYS) return `Day <span>${n}</span> of 75`;
    return `Buffer <span>+${n - TOTAL_DAYS}</span>`;
  }

  // Short calendar label for a Date, e.g. "May 18".
  function shortDate(d) {
    return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }

  // Earliest navigable day: today while the challenge hasn't started yet,
  // otherwise day 1 — so you can always return to today from day 1.
  function navLowerBound() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today < START ? today : START;
  }

  function clampNav() {
    document.getElementById('prevDay').disabled = viewDate <= navLowerBound();
    document.getElementById('nextDay').disabled = viewDate >= NAV_END;
  }

  function getDayOfWeek(d) { return d.getDay(); } // 0=Sun,1=Mon,...

  function isFuture(d) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d > today;
  }

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

  // ── Render ─────────────────────────────────────────────
  async function render() {
    const key = dateKey(viewDate);
    currentDay = await getDay(key);
    allDays = await getAllDays();
    allDays[key] = currentDay;     // same object reference — handler edits show in the streak bar
    currentTokens = await getTokens();

    const dow = getDayOfWeek(viewDate);

    document.body.classList.toggle('future-view', isFuture(viewDate));

    // Date display
    document.getElementById('currentDateDisplay').textContent =
      DAYS[dow] + ', ' + MONTHS[viewDate.getMonth()] + ' ' + viewDate.getDate();

    document.getElementById('dayInfoDisplay').innerHTML = dayLabel(viewDate);

    // Global ring
    const today = new Date(); today.setHours(0,0,0,0);
    const elapsed = Math.max(0, Math.min(75, Math.floor((today - START) / 86400000) + 1));
    const pct = elapsed / 75;
    const circ = 188.5;
    document.getElementById('ringFill').style.strokeDashoffset = circ - (circ * pct);
    document.getElementById('dayNum').textContent = Math.max(0, elapsed);

    const daysLeft = Math.max(0, Math.ceil((CHALLENGE_END - today) / 86400000));
    document.getElementById('daysLeft').textContent = daysLeft;

    // Streak calc
    let streak = 0, completedCount = 0;
    const checkDate = new Date(today);
    while (checkDate >= START) {
      const dd = allDays[dateKey(checkDate)] || { checks: {} };
      if (dayCompletedCount(dd) === DAILY_TOTAL) {
        completedCount++;
        if (checkDate <= today) streak++;
      } else if (checkDate < today) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    document.getElementById('streakStat').textContent = '🔥 ' + streak + ' day streak';
    document.getElementById('completedStat').textContent = '✓ ' + completedCount + ' days complete';

    // Workout for day
    const w = WORKOUTS[dow];
    document.getElementById('w1emoji').textContent = w.emoji;
    document.getElementById('w1label').textContent = 'Workout #1 — ' + w.label;
    document.getElementById('w1sub').textContent = w.sub;

    // Evening walk note
    if (dow === 4) { // Thursday
      document.getElementById('w2sub').textContent = '5:00–5:45pm · before improv at 7pm';
    } else if (dow === 1) { // Monday
      document.getElementById('w2sub').textContent = 'Walk to Chipotle + back after violin · 6:30pm';
    } else {
      document.getElementById('w2sub').textContent = 'Leave ~7:15pm · must be continuous 45 min';
    }

    // Meals
    const m = MEALS[dow];
    document.getElementById('lunchSub').textContent = m.lunch.name + ' · ' + m.lunch.detail;
    document.getElementById('dinnerSub').textContent = m.dinner.name + ' · ' + m.dinner.detail;

    // Render checkboxes
    CHECKLIST_KEYS.forEach(key => {
      const el = document.querySelector('[data-key="' + key + '"]');
      if (!el) return;
      if (currentDay.checks[key]) { el.classList.add('checked'); }
      else { el.classList.remove('checked'); }
    });

    // Render workout done state
    [1, 2].forEach((s) => {
      const item = document.querySelector(`.workout-item[data-workout="${s}"]`);
      if (!item) return;
      item.classList.toggle('checked', !!currentDay.workouts[s].done);
    });

    // Per-item notes: fill each input, expand items that already have a note.
    document.querySelectorAll('#panel-today .check-item').forEach((item) => {
      const input = item.querySelector('.item-note-input');
      if (!input) return;
      const note = itemNoteValue(itemKey(item));
      input.value = note;
      item.classList.toggle('has-note', note.length > 0);
      item.classList.toggle('note-open', note.length > 0);
    });

    // Vitamin children
    renderVitamins();

    // Progress bar
    updateDailyProgress();

    // Notes
    document.getElementById('notesArea').value = currentDay.notes || '';

    // Meals panel
    const mealGrid = document.getElementById('mealGrid');
    const meals = [
      { time: 'Breakfast · 8:30am', name: 'Standard breakfast', detail: '2 eggs + ¼ cup egg whites + veg + ¾ cup Greek yogurt + ½ cup frozen berries · ~420 cal · ~35g protein', key: 'breakfast' },
      { time: 'Lunch · 12:30pm', name: m.lunch.name, detail: m.lunch.detail, key: 'lunch' },
      { time: 'Snack · 3pm', name: 'Apple + almond butter', detail: 'Or cuties + almonds · ~200 cal', key: 'snack' },
      { time: 'Dinner', name: m.dinner.name, detail: m.dinner.detail, key: 'dinner' },
      { time: 'Sweet slot · after dinner', name: 'Pick one from the list below', detail: 'Intentional, not reactive · already in your 1,950 cal', key: 'sweet' },
    ];

    mealGrid.innerHTML = meals.map(meal => `
      <div class="meal-card ${currentDay.checks[meal.key] ? 'checked' : ''}" data-meal-key="${meal.key}">
        <div class="meal-time">${meal.time}<div class="meal-checkmark"><svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg></div></div>
        <div class="meal-name">${meal.name}</div>
        <div class="meal-detail">${meal.detail}</div>
      </div>
    `).join('');

    // Water
    renderWater(currentDay.water || 0);

    // Streak bar
    renderStreakBar();

    // Tokens
    renderTokens();

    // Nav clamp
    clampNav();
  }

  function renderWater(oz) {
    document.getElementById('waterOz').innerHTML = oz + ' <span>oz</span>';
    document.getElementById('waterFill').style.width = Math.min(100, oz / 100 * 100) + '%';

    const cp = document.getElementById('waterCheckpoints');
    cp.innerHTML = WATER_CHECKPOINTS.map(c => `
      <div class="wcp ${oz >= c.oz ? 'done' : ''}">
        <span>${c.label}</span>
        <span class="wcp-oz">${c.oz}oz ${oz >= c.oz ? '✓' : ''}</span>
      </div>
    `).join('');
  }

  function renderStreakBar() {
    const bar = document.getElementById('streakBar');
    const today = new Date(); today.setHours(0,0,0,0);
    let html = '';
    for (let i = 0; i < 75; i++) {
      const d = new Date(START);
      d.setDate(d.getDate() + i);
      const dd = allDays[dateKey(d)] || { checks: {} };
      const completed = dayCompletedCount(dd) === DAILY_TOTAL;
      const partial = !completed && dayCompletedCount(dd) > 0;
      let cls = '';
      if (d.getTime() === today.getTime()) cls += ' today';
      if (completed) cls += ' complete';
      else if (partial) cls += ' partial';
      const isInRange = d <= today;
      html += `<div class="streak-dot${cls}" data-day="Day ${i+1}\n${shortDate(d)}" style="opacity:${isInRange ? 1 : 0.3}"></div>`;
    }
    for (let i = 0; i < 9; i++) {
      const d = new Date(CHALLENGE_END);
      d.setDate(d.getDate() + i + 1);
      const dd = allDays[dateKey(d)] || { checks: {} };
      const done = dayCompletedCount(dd) === DAILY_TOTAL;
      const isToday = d.getTime() === today.getTime();
      html += `<div class="streak-dot buffer${done ? ' complete' : ''}${isToday ? ' today' : ''}" data-day="Buffer +${i+1}\n${shortDate(d)}"></div>`;
    }
    bar.innerHTML = html;
  }

  function renderTokens() {
    const row = document.getElementById('tokenRow');
    row.innerHTML = currentTokens.map((used, i) => `
      <div class="token-card ${used ? 'used' : ''}" data-token-index="${i}">
        <div class="t-label">Token ${i+1}</div>
        <div class="t-icon">🎟️</div>
        <div class="t-status">${used ? 'Used' : 'Available'}</div>
      </div>
    `).join('');
    const remaining = currentTokens.filter(t => !t).length;
    row.innerHTML += `<div style="align-self:center;font-size:11px;color:var(--text-muted)">${remaining}/3 tokens remaining<br><span style="font-size:10px">Click to toggle · must declare in advance</span></div>`;
  }

  // ── Interactions ───────────────────────────────────────
  function toggle(el) {
    if (isFuture(viewDate)) return;
    const key = el.dataset.key;
    if (key === 'vitamins') { toggleVitaminsParent(); return; }
    // water_wake stays a normal independent toggle (drinking 16oz from a
    // 40oz bottle, the water-tab math gets awkward if it's auto-synced).
    if (key === 'water_total') { toggleWaterShortcut('water_total', WATER_GOAL_OZ); return; }
    const next = !currentDay.checks[key];
    currentDay.checks[key] = next;
    el.classList.toggle('checked', next);
    if (next) spawnBurst(el);
    updateDailyProgress();
    renderStreakBar();
    persist(setCheck(dateKey(viewDate), key, next));
  }

  function toggleMeal(key, el) {
    if (isFuture(viewDate)) return;
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
    if (isFuture(viewDate)) return;
    currentDay.water = Math.max(0, Math.min(200, (currentDay.water || 0) + oz));
    renderWater(currentDay.water);
    persist(setWater(dateKey(viewDate), currentDay.water, oz));
    syncWaterChecks();
    updateDailyProgress();
    renderStreakBar();
  }

  function resetWater() {
    if (isFuture(viewDate)) return;
    currentDay.water = 0;
    renderWater(0);
    persist(setWater(dateKey(viewDate), 0, 'reset'));
    syncWaterChecks();
    updateDailyProgress();
    renderStreakBar();
  }

  // Derive the water_total check (@100oz) from the water total. Persists a
  // flip as via='cascade'. Caller refreshes progress + streak.
  function syncWaterChecks() {
    const w = currentDay.water || 0;
    syncOneWaterCheck('water_total', w >= WATER_GOAL_OZ);
  }

  function syncOneWaterCheck(key, want) {
    if (!!currentDay.checks[key] === want) return;
    currentDay.checks[key] = want;
    const el = document.querySelector(`.check-item[data-key="${key}"]`);
    if (el) el.classList.toggle('checked', want);
    persist(setCheck(dateKey(viewDate), key, want, 'cascade'));
  }

  // User clicked a water milestone check: jump the water total across the
  // threshold, persist both writes, and let the other water check follow.
  function toggleWaterShortcut(key, threshold) {
    if (isFuture(viewDate)) return;
    const cur = currentDay.water || 0;
    const want = cur < threshold;
    const newWater = want ? threshold : 0;
    const delta = newWater - cur;
    currentDay.water = newWater;
    currentDay.checks[key] = want;
    renderWater(newWater);
    const el = document.querySelector(`.check-item[data-key="${key}"]`);
    if (el) {
      el.classList.toggle('checked', want);
      if (want) spawnBurst(el);
    }
    persist(setWater(dateKey(viewDate), newWater, delta));
    persist(setCheck(dateKey(viewDate), key, want, 'direct'));
    syncWaterChecks();
    updateDailyProgress();
    renderStreakBar();
  }

  function toggleToken(i) {
    currentTokens[i] = !currentTokens[i];
    renderTokens();
    persist(setToken(i, currentTokens[i]));
  }

  function spawnBurst(el) {
    const rect = el.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.textContent = ['✨','🎉','⭐','💪','🔥'][Math.floor(Math.random()*5)];
    burst.style.left = (rect.left + rect.width/2) + 'px';
    burst.style.top = (rect.top + rect.height/2) + 'px';
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 700);
  }

  function toggleWorkout(slot, item) {
    const next = !currentDay.workouts[slot].done;
    currentDay.workouts[slot].done = next;
    item.classList.toggle('checked', next);
    if (next) spawnBurst(item);
    updateDailyProgress();
    renderStreakBar();
    persist(setWorkoutDone(dateKey(viewDate), slot, next));
  }

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

  // ── Notes autosave ─────────────────────────────────────
  let notesTimer;
  document.getElementById('notesArea').addEventListener('input', function() {
    // Snapshot the date + text now: a debounced save that fires after the user
    // navigates to another day must still write to the day they typed on.
    const dk = dateKey(viewDate);
    const text = this.value;
    currentDay.notes = text;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      persist(setNotes(dk, text));
    }, 500);
  });

  // ── Date navigation ────────────────────────────────────
  document.getElementById('prevDay').onclick = () => {
    if (viewDate <= navLowerBound()) return;
    viewDate.setDate(viewDate.getDate() - 1);
    render();
  };

  document.getElementById('nextDay').onclick = () => {
    if (viewDate >= NAV_END) return;
    viewDate.setDate(viewDate.getDate() + 1);
    render();
  };

  document.getElementById('goToday').onclick = () => {
    viewDate = new Date(); viewDate.setHours(0,0,0,0);
    render();
  };

  // ── Tabs ───────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = function() {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('panel-' + this.dataset.tab).classList.add('active');
    };
  });

  // ── Event wiring ───────────────────────────────────────
  function wireEvents() {
    // Delegated checklist toggles (Today panel)
    document.getElementById('panel-today').addEventListener('click', (e) => {
      if (e.target.closest('.item-note-input') || e.target.closest('.note-toggle')) return;
      const vchild = e.target.closest('.vitamin-child[data-vitamin]');
      if (vchild) { toggleVitamin(vchild.dataset.vitamin); return; }
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

    // Water buttons
    document.querySelectorAll('.bottle-btn[data-water]').forEach((btn) => {
      btn.addEventListener('click', () => addWater(Number(btn.dataset.water)));
    });
    document.getElementById('waterReset').addEventListener('click', resetWater);

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
        // Snapshot the date + text now: a debounced save that fires after the
        // user navigates to another day must still write to the day they typed on.
        const dk = dateKey(viewDate);
        const text = input.value;
        item.classList.toggle('has-note', text.length > 0);
        // optimistic local update (mirrors the day-note autosave)
        if (key === 'workout1') currentDay.workouts[1].note = text;
        else if (key === 'workout2') currentDay.workouts[2].note = text;
        else currentDay.itemNotes[key] = text;
        clearTimeout(t);
        t = setTimeout(() => {
          persist(setItemNote(dk, key, text));
        }, 500);
      });
    });
  }

  // ── Init ───────────────────────────────────────────────
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
      logAppOpen().catch((e) => console.warn('logAppOpen failed:', e));
    } else {
      appRoot.classList.remove('visible');
      gate.classList.add('visible');
    }
  });

  function updateOnline() {
    document.body.classList.toggle('offline', !navigator.onLine);
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  // Re-read from the backend when the app/window regains focus — catches
  // edits made on another device (no live listeners in v1).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getCurrentUser()) {
      render().catch((e) => console.error('Refocus render failed:', e));
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
      .catch((err) => console.warn('Service worker registration failed:', err));
    });
  }
