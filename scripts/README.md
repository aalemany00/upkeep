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

## Automated weekly run (optional, recommended)

Running this by hand means notes only appear when you remember to — which
doesn't scale once other people (friends/family/classmates) are relying on
it. `.github/workflows/coach-note.yml` runs this same script on a schedule
(Sundays by default) via GitHub Actions, so it happens without you.

**This is still free** — it authenticates with a Claude *subscription* OAuth
token, not a paid API key, so it draws on the same course Claude Code access
the script already uses locally, not pay-as-you-go billing. GitHub Actions
minutes are free too at this scale (one short run a week, well under the
free tier). You still need instructor sign-off before anything that *isn't*
this — this only automates the existing manual script, same architecture.

One-time setup (do this yourself — these are real credentials, don't share
them with anyone, including in chat with an AI):

1. **Generate a Claude subscription token.** On a machine where you're
   logged into the Claude Code CLI, run:
   ```bash
   claude setup-token
   ```
   Follow the prompt — it opens a browser flow and prints a long-lived
   token (valid about a year) tied to your own subscription/course access.
2. **Base64-encode your Firebase service account key** (the same
   `serviceAccountKey.json` from the one-time setup above):
   ```bash
   # Windows (PowerShell):
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("scripts/serviceAccountKey.json")) | Set-Clipboard
   # macOS/Linux:
   base64 -i scripts/serviceAccountKey.json | pbcopy   # or | xclip on Linux
   ```
3. **Add two repository secrets** (GitHub repo → Settings → Secrets and
   variables → Actions → New repository secret):
   - `CLAUDE_CODE_OAUTH_TOKEN` — the token from step 1.
   - `FIREBASE_SERVICE_ACCOUNT_KEY_B64` — the base64 string from step 2.
4. That's it. The workflow runs automatically every Sunday — check the
   **Actions** tab in GitHub to see past runs, or click **Run workflow**
   there to trigger one manually and confirm it's working.

To change the schedule, edit the `cron` line in
`.github/workflows/coach-note.yml` — [crontab.guru](https://crontab.guru) is
useful for writing the schedule expression. Note: GitHub only runs scheduled
workflows from the repo's default branch, and (on public repos) disables the
schedule after 60 days with no other repository activity — pushing any
commit resets that clock.
