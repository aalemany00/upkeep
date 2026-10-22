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

## 2026-10-22 — Gym expansion: split tabs, real exercise catalog, progression

- Asked for a much bigger gym feature: Food and Gym as their own tabs (not
  shared with the general Log), a gym section "as in-depth as Overload" —
  every exercise, suggested progression, form images, a calendar — plus an
  onboarding flow (bio, goal, availability) where the coach suggests a split
  from my free time, adjustable anytime.
- Scoped it down with Claude before building: confirmed calendar import
  (Google Calendar, etc.) is a separate, much bigger piece (real OAuth setup)
  and deferred it — this round ships Upkeep's own built-in calendar, no
  external import yet.
- Exercise data: seeded `exercises.json` (932 exercises) from wger.de's open
  database — free, no API key, CC-BY-SA 4.0, not scraped from Overload.
  About 30% have a real form photo; the rest fall back to text cues. Good
  enough, not "every exercise has a photo."
- Split assignment and the double-progression engine (`gym.js`) are plain
  code, not an AI call — same design shape as the Lift Log spec I shared
  earlier, built fresh for Upkeep's own exercise categories, not copied.
  Recomputes instantly whenever availability changes in Goals.
- Hit a real multi-hour debugging detour testing this: intermittent
  `Failed to fetch` / `net::ERR_CONNECTION_RESET` loading the exercise
  catalog. Chased two wrong leads first (a service-worker install race, then
  Python's basic dev server choking on concurrent requests) before finding
  the real, boring cause — a split document that had been saved earlier with
  an empty catalog (from one of those broken test runs), so every exercise
  slot pointed at nothing. Fixed by rebuilding the split, and hardened
  `rebuildSplit` to refuse to save silently if the catalog isn't loaded.
  Also replaced the local dev server with a tiny dependency-free Node
  server (`.claude/dev-server.js`) since Python's really was flakier under
  concurrent load, even though it wasn't this bug's actual cause.
- Verified the whole loop for real: onboarding → split assigned → logged a
  real set on the exercise catalog's "Barbell Clean and press" → came back
  on the next scheduled day and got a correct "same weight, beat last time's
  12/11/10 with 13/12/11" progression target → ran `coach-note.js` and got a
  note that correctly named the actual exercise, weight, and reps logged.

## 2026-10-22 — Onboarding review screen + account settings

- Asked for two things: a way to review the coach's main suggestions right
  after giving it my info, and an account settings area to view/change that
  info later.
- Confirmed the architecture limit again before building: there's no way to
  trigger a live AI call the instant a setting is saved without a backend,
  which goes back to the paid-API tradeoff already ruled out. Landed on:
  the onboarding review is the plain-code split summary made visible (no AI
  involved, since the split itself was never AI-generated), and settings
  changes instantly recompute the split (already free) plus show a banner
  that a fresh coach review is due, since actually generating one still
  needs `coach-note.js` run by hand.
- Added the review screen (shown once, right after onboarding, before the
  app itself) and a "Your info" section in Goals (age/sex/height/weight,
  editable anytime — previously onboarding-only with no way back to it).
- Found two real bugs testing this with a second throwaway account on the
  same device without reloading the page: `renderCoachPreview` silently
  left a previous account's coach note on screen when the new account had
  none (it only handled "has a note," not "really has zero"), and the
  onboarding form/review screen could do the same to a fresh account if a
  previous one in the same tab had just finished onboarding. Fixed both —
  every account switch now explicitly re-renders every view instead of
  leaving whatever the last account's state happened to be on screen. This
  was never a real Firestore/security leak (confirmed each account's actual
  data was correctly isolated), just a client-side rendering gap, but
  worth catching given multiple people share this app.
- Asked Claude to actually test the full flow itself: create an account,
  fill in onboarding, then go change the settings. Good thing I asked —
  it found a third real bug this way: saving a changed availability in
  Goals silently kept the old split. The profile write's own live-sync
  listener was resetting the day-picker state mid-submit, before the goals
  doc got written with the new days. Fixed by snapshotting the selected
  days at the start of the save instead of re-reading that variable after
  the write. Confirmed fixed by re-running the exact same test (new
  account → onboarding → change days in Goals → checked Firestore directly
  for the new split).

## 2026-10-22 — Delete account

- Asked for an in-app way to permanently delete an account and its data
  from Firebase, not just stop using it.
- Added a "Delete account" danger zone to Goals: re-enter your password
  (Firebase won't let you delete an account without a recent sign-in),
  then it deletes every Firestore doc under that user and the Firebase
  Auth user itself, in that order — deleting Auth first would lock out the
  Firestore cleanup, since the security rules check who's signed in.
- Tested the whole thing with a throwaway account: wrong password shows a
  clear error and changes nothing; the correct password actually deletes
  it, confirmed with the Admin SDK that the Auth user was really gone
  afterward (not just signed out).

## 2026-10-22 — More goal types, coach-computed daily goals, diet catalog, free-form exercise logging

- Four asks at once: more goal types than just build-muscle/lose-fat; daily
  calorie/protein/water/steps goals computed for me instead of typed in
  (except target weight and vitamins, which stay manual since the app has
  no way to know those); an in-depth diet suggestion system with real
  variety, not the same food every day; and gym logging that's both
  suggestion-based (what's already there) and fully free-form, like
  Overload's exercise search.
- Confirmed scope with Claude first: six goal types (added maintain,
  endurance, general health); the computed goals are defaults I can still
  override by hand, not locked; added a daily-activity-level question to
  onboarding since the calorie formula needs it to mean anything.
- Nutrition math (`nutrition.js`) is plain code — Mifflin-St Jeor BMR ×
  activity factor × goal offset, protein per pound of bodyweight — not an
  AI call, same reasoning as the gym split/progression engine.
- Diet suggestions: a curated 60-item food catalog (`foods.json`, 15 each
  of breakfast/lunch/dinner/snack, deliberately varied across cuisines and
  diets) shown in Food with shuffle + one-tap logging, alongside the
  existing manual entry for anything not in the list.
- Gym: kept the suggested-slot UI, added a real exercise search (the same
  932-exercise catalog) so I can log anything, not just what's assigned —
  own progression target, own set grid, same Save.
- Found two real bugs while testing this myself (new account → change
  goal type → check the saved number; log a free-form exercise → reload →
  check it's still there):
  1. The daily-goals override logic initially would have silently
     clobbered a manual edit on every save, not just when something
     relevant changed — caught before it shipped by tracing through what
     "editable default" actually requires.
  2. A genuinely saved free-form exercise vanished on page reload. The
     Gym day's in-memory draft gets built (and then cached) from whatever
     `workoutLogs` holds the moment the tab first renders, which can
     happen before Firestore's live listener delivers its first real
     batch — so the draft got built empty, cached, and never rebuilt even
     after the real data arrived a moment later. Fixed by forcing exactly
     one rebuild the first time that listener actually delivers data.
     Confirmed fixed by re-running the same test.

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
- Calendar import (real external calendar sync) — deferred, needs its own
  OAuth setup scoping.
- Exercise images are only ~30% covered by wger's data; could swap in a
  better-covered source later if the gaps bother me in practice.

## Where Claude misread or I had to correct it

- When I said other people would use this, Claude's first instinct was a
  "bring your own AI account/API key" design — the opposite of what I
  wanted. I wanted pure convenience (tracking health stuff is already a
  hassle); the fix was one shared, free mechanism (the coach script loops
  over every signed-up user) instead of pushing setup or cost onto them.
