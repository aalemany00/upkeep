# Weekly coach note

A script you run yourself — not a button in the app, since the app is a
static site with no server to trigger anything from. This is the Artifact 3
"AI does real work every run" piece: Claude Code reads a week of logged
data and decides what's worth telling the user.

Runs for **every signed-up user**, not just one — it lists everyone
registered in Firebase Auth and generates a note for each one who has
logged anything in the last 7 days. This is meant for a handful of real
people (friends, family, classmates) who ask you to run it for them, not
the general public: every note is one `claude -p` call on *your own*
Claude Code access, run manually, on your own machine. Scaling this to
strangers signing up on their own would need a real server and the paid
Claude API, which the course guide says needs instructor sign-off first
(see the repo's `CLAUDE.md`).

## One-time setup

1. **Node.js** installed (any recent LTS).
2. **Claude Code CLI** installed and logged in (`claude` on your PATH) — this
   uses your course Claude Code access, not the paid API.
3. Install script dependencies:
   ```bash
   cd scripts
   npm install
   ```
4. **Service account key** (lets this script read/write Firestore and list
   Auth users directly, bypassing the per-user security rules the web app
   is restricted by): Firebase console → ⚙️ Project settings → Service
   accounts → Generate new private key. Save the downloaded file as
   `scripts/serviceAccountKey.json` (gitignored — never commit it).

That's it — no per-user config needed; the script discovers users itself.

## Running it

```bash
cd scripts
node coach-note.js
```

It lists every registered user, and for each one with recent activity:
asks Claude Code to summarize their week, validates the shape of what
comes back, and writes a new note to that user's own Firestore data if
it's valid (nothing is written for a user if Claude's output doesn't parse
— see `coach-note.js`'s `parseNote` for the check). Each person sees their
own note in their own app's **Coach** tab.

Run this whenever you want fresh notes generated — once a week is the
intended rhythm, but there's nothing stopping you from running it more
often.
