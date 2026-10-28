# Upkeep

TCSS 490 Artifact 3 ("AI Inside It"). A health tracker — food/calories/
protein, gym workouts, water, steps, sleep, weight, vitamins/supplements,
and goals — synced between phone and PC, with a weekly AI-written coaching
note. Built
for Adrian but usable by other people (friends/family/classmates) too: any
number of people can sign up, each sees only their own data.

**Read `PROJECT_STATE.md` first.** It's the living, topic-organized snapshot
of the whole project — current features, architecture, data model, dev
setup, known gaps, and testing conventions — meant to let a session with no
memory of prior conversations pick this up cold (no Remote Control access
on this account, so a new machine/session relies entirely on the repo + that
file). `LOG.md` below is the course-required chronological record (what was
asked/decided/abandoned, in order); update **both** whenever something
substantial lands — a new feature, a real bug fix, an architecture decision.

## Stack

- Plain HTML/CSS/JS, no build step, deployed as a static site to GitHub Pages
  (same approach as Artifact 2).
- Installable as a PWA (manifest + service worker) so it works full-screen on
  a phone home screen.
- Firebase (Auth + Firestore) for sign-in and multi-device sync. Free tier.
- No paid AI API. Account creation for any third-party service (Firebase,
  etc.) is Adrian's own action, not something I do for him.
- Exercise catalog (`exercises.json`) is a static, pre-built dataset seeded
  once from wger.de's open exercise database (free, no key, CC-BY-SA 4.0) via
  `scripts/seed-exercises.js` — not a live API call at runtime.
- Local dev server: `node .claude/dev-server.js <dir> <port>` (see repo
  root's `.claude/launch.json`), not Python's `http.server` — Python's
  single-request-at-a-time handling caused real `net::ERR_CONNECTION_RESET`s
  under this app's concurrent asset requests during testing.

## Gym: split assignment and progression (plain code, not the model)

- `gym.js` is pure functions, no DOM/Firebase: `assignSplit(daysPerWeek,
  catalog)` deterministically maps availability to a standard split (1 day =
  Full Body, 2 = Upper/Lower, 3 = Push/Pull/Legs, up to 6), filling each
  slot from the catalog by target muscle group. `targetFor(history,
  exerciseMeta)` is a double-progression engine (same shape as a standard
  lifting program: hit the top of your rep range on every set → add weight
  next time; flat for 3 sessions → suggests a swap).
- Both run instantly in the browser, no AI call, every time: onboarding, and
  again whenever availability changes in Goals (old logged history is never
  touched, only the forward-looking split).
- The weekly coach note's prompt explicitly says not to recompute per-set
  targets itself — that's this module's job — and only comment on
  cross-session patterns (stalling, skipped days, uneven effort).
- Onboarding ends on a plain "Your plan" review screen (split, days/week,
  default exercise per slot) before dropping into the app — still no AI
  call, just the `assignSplit` output made visible instead of silent.
- Goals has a "Delete account" danger zone: re-enter your password (Firebase
  requires a recent sign-in before it allows deletion), then it wipes every
  Firestore doc under that user (entries, workoutLogs, coachNotes, goals,
  profile, split) before deleting the Firebase Auth user itself. Tested
  both paths (wrong password → clear error, correct password → account and
  data actually gone, confirmed via the Admin SDK).
- "Your info" in Goals doubles as account settings (age/sex/height/weight,
  editable anytime, not just at onboarding). Saving any of it, the goal, or
  availability bumps `profile.updatedAt`; if that's newer than the latest
  coach note, a banner says a fresh coach review is due — there's no backend
  to trigger `coach-note.js` automatically the instant you save, so this is
  a visible reminder, not a live regeneration.
- Six goal types (`nutrition.js`'s `GOAL_LABELS`): build muscle, lose fat,
  recomposition, maintain, endurance, general health.
- Daily calorie/protein/water/steps goals are computed by `nutrition.js`
  (BMR × activity-level factor × goal offset, plus a protein-per-lb target)
  from profile + goal + activity level — plain code, not the model, same
  boundary as the split/progression logic. They're defaults, not locked:
  saving Goals only overwrites a field if something that feeds the formula
  changed AND the field wasn't manually edited away from what was already
  stored (tested both paths — a manual override survives an unrelated
  save, and changing the goal type recomputes it).
- Sleep goal is **not** computed like calories/protein/water/steps — general
  sleep guidance doesn't scale with BMR/activity the way energy needs do, so
  it's a flat default (8h, same "always manual" treatment as target weight)
  shown via a fallback (`goals.sleepGoal || 8`) wherever it's displayed,
  rather than written to Firestore until the user actually changes it in
  Goals.
- Diet suggestions (`foods.json`, Food tab): a curated, varied static
  catalog (15 each of breakfast/lunch/dinner/snack, real variety across
  diets/cuisines, approximate macros like Lift Log's meal builder) — a
  slot per meal with shuffle and a one-tap "Log this" that writes straight
  into the same food entries the manual form uses. Per-device only
  (localStorage, keyed by uid), not synced — it's just what you're
  thinking of eating, not real data.
- Gym day logging has two layers: the day's suggested slots (from the
  split), and a free-form "Add any other exercise" search over the full
  932-exercise catalog for logging anything else, with its own progression
  target (same `targetFor` engine, keyed by exercise id regardless of
  which layer logged it). Extra entries are tagged `extra: true` in
  Firestore and matched back to the UI by that flag, not array position —
  matching slot entries by `slotLabel` instead of index, specifically
  because position-based matching breaks once entries can be skipped or
  interleaved with extras.

## Where the AI is (the Artifact 3 requirement)

The model does real, deciding work every time the coaching script runs — it
is not just the tool used to build this app.

- **What the model owns:** `scripts/coach-note.js` gathers the last 7 days of
  logged food/water/weight/vitamins + gym sessions (exercise names, sets,
  weights) + the user's profile/goal/availability into a single prompt, then
  runs it through Claude Code **headless** (`claude -p`, no API key, uses
  Adrian's course Claude Code access — same pattern the course guide names
  as a free example). Claude reads the week's numbers, decides what's worth
  saying, and writes a short structured note: what's on track, what's not,
  and one or two concrete suggestions.
- **What plain code checks:** the script validates the note is non-empty
  JSON matching the expected shape before writing it to Firestore; if Claude's
  output doesn't parse, the script logs an error and writes nothing (no
  silently-broken note ever reaches the app). All the arithmetic — daily
  totals, goal percentages, streaks — is computed by plain JS in the app
  itself, never left to the model. The model only ever writes the prose note,
  never the numbers it's commenting on.
- **Why this shape, not a live in-app chat:** a live chat coach would need an
  Anthropic API key, which bills separately from Claude Code access — the
  course guide says to check with an instructor before that. The weekly-note
  shape (inspired by how overload67.com frames its own AI feature, without
  copying its implementation) gets the same "your coach reviewed your week"
  value for free.
- **How to generate a note:** see `scripts/README.md`. It's a manual/
  scheduled step Adrian runs himself (there's no server to trigger it from
  the static site), not a button in the web app. It loops over every
  signed-up user (via Admin Auth `listUsers`), not just Adrian — but it's
  still one person (Adrian) manually running it on his own Claude Code
  access for everyone, not a public auto-scaling service. That's a
  deliberate limit, not a gap: scaling further needs the paid API, which
  needs instructor sign-off first (see "Stack" above).

## Working with Adrian

- Adrian reviews and decides; I write the code. Explain changes in plain
  language rather than expecting him to read every line.
- Never ghost-write his course reflections, plans/changes log entries, or
  "where the AI misread me" notes — those are his words. I can help with
  wording he's stuck on.
- Batch changes rather than many tiny round trips.
- Keep a running log of what was asked, what changed, and what was abandoned
  in `LOG.md` as we go (course requirement for every artifact).
- No paid services, no API keys committed to the repo. Firebase config is
  public-safe (restricted by Firestore security rules, not secrecy); a
  service-account key for the coach script stays local and gitignored.
