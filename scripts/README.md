# Weekly coach note

A script you run yourself — not a button in the app, since the app is a
static site with no server to trigger anything from. This is the Artifact 3
"AI does real work every run" piece: Claude Code reads your last 7 days of
logged data and decides what's worth telling you.

## One-time setup

1. **Node.js** installed (any recent LTS).
2. **Claude Code CLI** installed and logged in (`claude` on your PATH) — this
   uses your course Claude Code access, not the paid API.
3. Install script dependencies:
   ```bash
   cd scripts
   npm install
   ```
4. **Service account key** (lets this script read/write Firestore directly,
   bypassing the per-user security rules the web app is restricted by):
   Firebase console → Project settings → Service accounts → Generate new
   private key. Save the downloaded file as `scripts/serviceAccountKey.json`
   (gitignored — never commit it).
5. **Your Firebase Auth UID**: Firebase console → Authentication → Users →
   copy the "User UID" for your account. Copy `config.example.json` to
   `config.json` and paste it in (`config.json` is gitignored too).

## Running it

```bash
cd scripts
node coach-note.js
```

It prints what it's doing, asks Claude Code to summarize the week, validates
the shape of what comes back, and writes a new note to Firestore if it's
valid (nothing is written if Claude's output doesn't parse — see
`coach-note.js`'s `parseNote` for the check). Open the app's **Coach** tab
to see it.

Run this whenever you want a fresh note — once a week is the intended
rhythm, but there's nothing stopping you from running it more often if
you've logged enough new data to make it worth it.
