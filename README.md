# Health Coach (working title)

TCSS 490 Artifact 3. A personal health tracker — food/calories/protein, gym
workouts, water, steps, weight, vitamins, and goals — synced between phone
and PC, with a weekly AI-written coaching note.

## Run locally

No build step. Serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Setup (one-time, do this yourself)

1. Create a free [Firebase](https://firebase.google.com/) project.
2. Enable **Authentication** (Email/Password, or Google sign-in) and
   **Firestore Database** (production mode).
3. Copy your Firebase web app config into `firebase-config.js` (see the
   placeholder in that file).
4. Deploy the security rules in `firestore.rules` (Firebase console →
   Firestore → Rules, or `firebase deploy --only firestore:rules` with the
   Firebase CLI).

## Weekly coach note

See `scripts/README.md` — a separate Node script you run yourself that reads
your last 7 days of logged data and asks Claude Code (headless, no API key)
to write a short coaching note back into the app.

## Deploy

Push to a GitHub repo and enable GitHub Pages (Settings → Pages → deploy
from `main`/`master`, root).

## Status

See `LOG.md` for the plans/changes log.
