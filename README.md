# 75 Hard Tracker

A personal, synced 75 Hard challenge tracker. Plain HTML/CSS/JS, no build step,
Firebase-backed, installable as a PWA.

## Setup

1. Create a Firebase project (Authentication → Google enabled, Firestore Database created).
2. Paste your Firebase web config into `js/config.js`.
3. Publish the rules in `firestore.rules` to Firestore (Firestore Database → Rules).
4. Add your GitHub Pages domain to Firebase Authentication → Settings → Authorized domains.

## Run locally

    python3 -m http.server 8000

Open <http://localhost:8000>. (A local server is required — the app uses ES modules,
which browsers will not load over `file://`.)

## Deploy

Hosted via GitHub Pages from the `main` branch — live at
`https://<your-username>.github.io/75hard/`.

## Structure

| File | Responsibility |
|------|----------------|
| `index.html` | Markup, sign-in gate, PWA hooks |
| `css/styles.css` | All styles |
| `js/config.js` | Firebase init (project keys) |
| `js/auth.js` | Google sign-in / sign-out / auth state |
| `js/data.js` | Storage layer — Firestore reads/writes |
| `js/app.js` | UI logic — render + event wiring |
| `manifest.webmanifest`, `service-worker.js`, `icons/` | PWA: installable, offline app shell |

Design and implementation notes live in `docs/superpowers/`.
