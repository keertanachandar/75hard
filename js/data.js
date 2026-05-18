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
