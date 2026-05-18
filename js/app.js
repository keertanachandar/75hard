  // ── Constants ──────────────────────────────────────────
  const START = new Date('2026-05-18');
  const END   = new Date('2026-08-01');
  const TOTAL_DAYS = 75;

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

  const WATER_CHECKPOINTS = [
    { label: 'On wakeup', oz: 32 },
    { label: 'With breakfast', oz: 48 },
    { label: 'With lunch', oz: 64 },
    { label: 'Afternoon snack', oz: 80 },
    { label: 'Goal reached', oz: 100 },
  ];

  const CHECKLIST_KEYS = ['water_wake','workout1','photo','breakfast','lunch','snack','workout2','dinner','sweet','water_total','reading'];

  // ── State ──────────────────────────────────────────────
  let viewDate = new Date();
  viewDate.setHours(0,0,0,0);

  function dateKey(d) {
    return d.toISOString().slice(0,10);
  }

  function loadDay(d) {
    const k = dateKey(d);
    const saved = localStorage.getItem('75h_day_' + k);
    return saved ? JSON.parse(saved) : { checks: {}, water: 0, notes: '' };
  }

  function saveDay(d, data) {
    localStorage.setItem('75h_day_' + dateKey(d), JSON.stringify(data));
  }

  function loadTokens() {
    const s = localStorage.getItem('75h_tokens');
    return s ? JSON.parse(s) : [false, false, false];
  }

  function saveTokens(t) {
    localStorage.setItem('75h_tokens', JSON.stringify(t));
  }

  // ── Helpers ────────────────────────────────────────────
  function dayNumber(d) {
    const diff = Math.floor((d - START) / 86400000) + 1;
    return diff;
  }

  function isInChallenge(d) {
    return d >= START && d <= END;
  }

  function getDayOfWeek(d) { return d.getDay(); } // 0=Sun,1=Mon,...

  // ── Render ─────────────────────────────────────────────
  function render() {
    const data = loadDay(viewDate);
    const dow = getDayOfWeek(viewDate);
    const dayNum = dayNumber(viewDate);
    const inChallenge = isInChallenge(viewDate);

    // Date display
    document.getElementById('currentDateDisplay').textContent =
      DAYS[dow] + ', ' + MONTHS[viewDate.getMonth()] + ' ' + viewDate.getDate();

    let dayInfo = '';
    if (inChallenge) {
      dayInfo = 'Day <span>' + dayNum + '</span> of 75';
    } else if (viewDate < START) {
      dayInfo = 'Challenge starts May 18';
    } else {
      dayInfo = 'Challenge complete! 🎉';
    }
    document.getElementById('dayInfoDisplay').innerHTML = dayInfo;

    // Global ring
    const today = new Date(); today.setHours(0,0,0,0);
    const elapsed = Math.max(0, Math.min(75, Math.floor((today - START) / 86400000) + 1));
    const pct = elapsed / 75;
    const circ = 188.5;
    document.getElementById('ringFill').style.strokeDashoffset = circ - (circ * pct);
    document.getElementById('dayNum').textContent = Math.max(0, elapsed);

    const daysLeft = Math.max(0, Math.ceil((END - today) / 86400000));
    document.getElementById('daysLeft').textContent = daysLeft;

    // Streak calc
    let streak = 0;
    let completedCount = 0;
    let checkDate = new Date(today);
    while (checkDate >= START) {
      const dd = loadDay(checkDate);
      const checked = Object.values(dd.checks).filter(Boolean).length;
      if (checked === CHECKLIST_KEYS.length) {
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
      if (data.checks[key]) { el.classList.add('checked'); }
      else { el.classList.remove('checked'); }
    });

    // Progress bar
    const checked = CHECKLIST_KEYS.filter(k => data.checks[k]).length;
    document.getElementById('dpChecked').textContent = checked;
    document.getElementById('dpFill').style.width = (checked / CHECKLIST_KEYS.length * 100) + '%';

    // Notes
    document.getElementById('notesArea').value = data.notes || '';

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
      <div class="meal-card ${data.checks[meal.key] ? 'checked' : ''}" data-meal-key="${meal.key}">
        <div class="meal-time">${meal.time}<div class="meal-checkmark"><svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg></div></div>
        <div class="meal-name">${meal.name}</div>
        <div class="meal-detail">${meal.detail}</div>
      </div>
    `).join('');

    // Water
    renderWater(data.water || 0);

    // Streak bar
    renderStreakBar();

    // Tokens
    renderTokens();
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
      const dd = loadDay(d);
      const checked = Object.values(dd.checks).filter(Boolean).length;
      let cls = '';
      if (d.getTime() === today.getTime()) cls += ' today';
      if (checked === CHECKLIST_KEYS.length) cls += ' complete';
      else if (checked > 0) cls += ' partial';
      const isInRange = d <= today;
      html += `<div class="streak-dot${cls}" data-day="Day ${i+1}" style="opacity:${isInRange ? 1 : 0.3}"></div>`;
    }
    bar.innerHTML = html;
  }

  function renderTokens() {
    const tokens = loadTokens();
    const row = document.getElementById('tokenRow');
    row.innerHTML = tokens.map((used, i) => `
      <div class="token-card ${used ? 'used' : ''}" data-token-index="${i}">
        <div class="t-label">Token ${i+1}</div>
        <div class="t-icon">🎟️</div>
        <div class="t-status">${used ? 'Used' : 'Available'}</div>
      </div>
    `).join('');
    const remaining = tokens.filter(t => !t).length;
    row.innerHTML += `<div style="align-self:center;font-size:11px;color:var(--text-muted)">${remaining}/3 tokens remaining<br><span style="font-size:10px">Click to toggle · must declare in advance</span></div>`;
  }

  // ── Interactions ───────────────────────────────────────
  function toggle(el) {
    const key = el.dataset.key;
    const data = loadDay(viewDate);
    data.checks[key] = !data.checks[key];
    saveDay(viewDate, data);
    if (data.checks[key]) {
      el.classList.add('checked');
      spawnBurst(el);
    } else {
      el.classList.remove('checked');
    }
    const checked = CHECKLIST_KEYS.filter(k => data.checks[k]).length;
    document.getElementById('dpChecked').textContent = checked;
    document.getElementById('dpFill').style.width = (checked / CHECKLIST_KEYS.length * 100) + '%';
    renderStreakBar();
  }

  function toggleMeal(key, el) {
    const data = loadDay(viewDate);
    data.checks[key] = !data.checks[key];
    saveDay(viewDate, data);
    el.classList.toggle('checked', data.checks[key]);
    if (data.checks[key]) spawnBurst(el);
    const checked = CHECKLIST_KEYS.filter(k => data.checks[k]).length;
    document.getElementById('dpChecked').textContent = checked;
    document.getElementById('dpFill').style.width = (checked / CHECKLIST_KEYS.length * 100) + '%';
    // Sync today panel
    const todayEl = document.querySelector('[data-key="' + key + '"]');
    if (todayEl) {
      if (data.checks[key]) todayEl.classList.add('checked');
      else todayEl.classList.remove('checked');
    }
  }

  function addWater(oz) {
    const data = loadDay(viewDate);
    data.water = Math.max(0, Math.min(200, (data.water || 0) + oz));
    saveDay(viewDate, data);
    renderWater(data.water);
  }

  function resetWater() {
    const data = loadDay(viewDate);
    data.water = 0;
    saveDay(viewDate, data);
    renderWater(0);
  }

  function toggleToken(i) {
    const tokens = loadTokens();
    tokens[i] = !tokens[i];
    saveTokens(tokens);
    renderTokens();
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

  // ── Notes autosave ─────────────────────────────────────
  let notesTimer;
  document.getElementById('notesArea').addEventListener('input', function() {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      const data = loadDay(viewDate);
      data.notes = this.value;
      saveDay(viewDate, data);
    }, 500);
  });

  // ── Date navigation ────────────────────────────────────
  document.getElementById('prevDay').onclick = () => {
    viewDate.setDate(viewDate.getDate() - 1);
    render();
  };

  document.getElementById('nextDay').onclick = () => {
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

  // ── Init ───────────────────────────────────────────────
  wireEvents();
  render();
