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
