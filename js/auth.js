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
