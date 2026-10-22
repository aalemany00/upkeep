# Plans/Changes Log — Artifact 3 (Upkeep)

Course requirement: a record of what I set out to build, what I asked the
agent for, what I decided, what I abandoned. Kept here, in this artifact's
own repo, as required.

## 2026-10-22 — Kickoff

- Changed my mind from the original "Learning Improver" placeholder
  (Project World's Artifact 3 card). Building a general health tracker
  instead: food/calories/protein, gym activity, water, steps/calories burned,
  weight, vitamins, goals, and AI-generated advice — used like a coach.
- Looked at two existing student/public projects for inspiration
  (MuseCoach, overload67.com) — explicitly asked Claude not to copy either,
  just to use them as reference points for what a "coach" feature can look
  like.
- Key open question going in: how does the "AI coach" part actually run,
  given course Claude Code access doesn't include the paid Claude API?
  Worked through it with Claude:
  - Asked whether a free claude.ai account could power in-app AI coaching.
    Answer: no — claude.ai (free or paid) and the Claude API are separate
    products; API access needs a billed Anthropic Console key regardless of
    claude.ai subscription tier.
  - Looked at how overload67.com does its AI feature: a weekly batch note
    ("Claude reads your own logs each week and writes a short note"), not a
    live chat — and that's clearly running on their own paid backend key.
  - Decided: copy the *shape* (periodic note, not live chat) but implement it
    for free, using a headless `claude -p` script I run myself against my
    logged data — the course guide's own example of a free Artifact 3 shape.
    This avoids the "ask an instructor before a paid key" situation entirely.
- Decision: Firebase (Auth + Firestore) for storage/multi-device sync, same
  as Artifact 2 — no build step, static site, GitHub Pages deploy.

## 2026-10-22 — First build pass

- Built the full app shell: sign-in/sign-up, Dashboard (today's calories/
  protein/water/steps/weight vs. goals, vitamins checklist, latest coach
  note preview), Log (quick-add forms for food/gym/water/weight/activity/
  vitamins + today's entry list with delete), Goals (daily targets + which
  vitamins to track), Coach (list of past weekly notes).
- Firebase Auth + Firestore for storage, scoped per-user via
  `firestore.rules`; data model is `users/{uid}/entries` (one doc per log),
  `users/{uid}/meta/goals`, `users/{uid}/coachNotes`.
- Wrote `scripts/coach-note.js`: the Artifact 3 AI piece. Reads 7 days of
  Firestore entries + goals, builds a prompt, runs it through `claude -p`
  headless, validates the JSON shape that comes back before writing
  anything (so a malformed response never silently reaches the app).
- Tested locally by serving the static files and clicking through all four
  tabs plus the sign-up flow. Caught and fixed a real bug: the `.screen`
  CSS class's `display: flex` was overriding the native `[hidden]`
  attribute, so the auth screen would never actually hide once signed in —
  added an explicit `[hidden] { display: none !important; }` rule.
- Couldn't test the signed-in data flows (entries syncing, dashboard math
  against real numbers, the coach script's full round trip) — that needs an
  actual Firebase project, which per Artifact 2's convention is my own
  action to set up, not the agent's. `firebase-config.js` still has
  placeholder values.

## 2026-10-22 — Firebase wired up and verified live

- Created the `health-coach-36a28` Firebase project myself (Standard edition
  Firestore, `nam5` multi-region, Production mode), enabled Email/Password
  auth, published `firestore.rules` as-is.
- Gave Claude the real `firebaseConfig` values to drop into
  `firebase-config.js` (safe to commit — it's a public client identifier,
  not a secret).
- First test run hit `auth/configuration-not-found` (expected — Auth wasn't
  enabled yet) and then `permission-denied` on every Firestore read/write
  even after enabling Auth and publishing the rules (rules propagation lag).
  Waited and retried — a real test account, a real food log entry (650
  kcal / 45g protein), and the dashboard math all worked end to end.
- Left the `test-coach@example.com` throwaway test account + its one food
  entry in the project; harmless since rules scope everything per-uid, but
  should delete it from Authentication → Users before this is "done."

## 2026-10-22 — Weekly coach script upgraded + first real run

- Shared a spec/prototype from an unrelated past Claude.ai chat project
  ("Lift Log," a gym tracker) as a "not sure if this is useful" reference.
  Decided with Claude what to actually take from it rather than building
  that separate app: its AI-feedback system-prompt safety framing (not
  medical/dietitian advice, treat free-text notes as untrusted data, flag
  concerning things without diagnosing) and its "AI suggests a goal change,
  I tap Apply" pattern. Explicitly did not adopt its paid-API architecture.
- Added `flags` and `calorieGoalChange` fields to the coach note's JSON
  shape, plus an "Apply" button in the Coach tab that nudges the calorie
  goal by the suggested amount — mirrors Lift Log's pattern but stays on
  the free `claude -p` approach.
- Told Claude multiple people (not just me) will use this app. Clarified
  scope: not a public auto-scaling service (that needs the paid API +
  instructor sign-off, which I explicitly don't want to depend on since I
  may not keep my Claude subscription long-term) — just the coach script
  looping over every signed-up Firebase user instead of one hardcoded UID,
  still run manually by me on my own Claude Code access. Firebase Auth +
  Firestore rules already supported multiple users without any change.
- Installed Node.js (wasn't on this machine) via winget so the script could
  actually run, then installed its npm dependencies.
- Downloaded my own Firebase service account key and dropped it into
  `scripts/serviceAccountKey.json` (gitignored). Note to self: I pasted the
  raw key file contents into chat by mistake instead of just giving the
  path — it got auto-read into the session. Not exposed anywhere public,
  but next time just give Claude the path.
- Ran `node coach-note.js` for real for the first time — found 1 signed-up
  user, generated a real note via `claude -p`, wrote it to Firestore. It
  correctly said there wasn't enough data yet rather than inventing detail,
  which is exactly the boundary check working as intended.

## Open items

- Delete the `test-coach@example.com` test account and its food entry from
  Firebase once real use starts (there's also now a real test coach note
  attached to it).
- ~~Decide on a real name~~ — named **Upkeep** (2026-10-22), picked from a
  shortlist (Upkeep, Baseline, Pulsecheck, CoachLog).
- First real week of logged data + first generated coach note, to see if the
  advice is actually useful or needs prompt changes.
- Push to its own GitHub repo and enable Pages (not done yet — only a local
  repo so far).
- Update the Artifact 3 card in Project World's `cards.js` once deployed.

## Where Claude misread or I had to correct it

- (fill in as it comes up)
