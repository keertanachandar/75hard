// js/data.js — Firestore-backed storage layer. Same contract as the localStorage version.
import { db } from './config.js';
import { getCurrentUser } from './auth.js';
import {
  doc, getDoc, getDocs, collection, setDoc, serverTimestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function uid() {
  const u = getCurrentUser();
  if (!u) throw new Error('Not signed in');
  return u.uid;
}

function dayRef(dateKey) {
  return doc(db, 'users', uid(), 'days', dateKey);
}

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

export async function setCheck(dateKey, key, value, via = 'direct') {
  await setDoc(dayRef(dateKey), {
    checks: { [key]: value },
    events: arrayUnion(ev('check', dateKey, { key, value, via })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
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

export async function logAppOpen() {
  const tKey = todayKey();
  await setDoc(dayRef(tKey), {
    events: arrayUnion(ev('open', tKey, {})),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
