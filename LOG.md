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

## Open items

- Create the actual Firebase project (my own action, not the agent's).
- Decide on a real name (currently "Health Coach" working title).
- First real week of logged data + first generated coach note, to see if the
  advice is actually useful or needs prompt changes.

## Where Claude misread or I had to correct it

- (fill in as it comes up)
