# Plans/Changes Log — Artifact 3 (Health Coach)

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

## Open items

- Create the actual Firebase project (my own action, not the agent's) and
  drop the real config into `firebase-config.js`.
- Set up `scripts/serviceAccountKey.json` and `scripts/config.json` so the
  coach-note script can run — see `scripts/README.md`.
- Decide on a real name (currently "Health Coach" working title).
- First real week of logged data + first generated coach note, to see if the
  advice is actually useful or needs prompt changes.
- Push to its own GitHub repo and enable Pages (not done yet — only a local
  repo so far).
- Update the Artifact 3 card in Project World's `cards.js` once deployed.

## Where Claude misread or I had to correct it

- (fill in as it comes up)
