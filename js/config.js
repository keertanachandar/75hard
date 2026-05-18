// js/config.js — Firebase init. Paste YOUR firebaseConfig values below.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
// import { initializeApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClr4hQ0nd_OCQxaKrEFZf7crONxT2E5yQ",
  authDomain: "hard-8596d.firebaseapp.com",
  projectId: "hard-8596d",
  storageBucket: "hard-8596d.firebasestorage.app",
  messagingSenderId: "412780001544",
  appId: "1:412780001544:web:2d5c3b81c36f77c7cfd4bd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Offline persistence so the app works with no signal and syncs on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);
