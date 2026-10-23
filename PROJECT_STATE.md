# Upkeep — Project State

**Read this first, before `CLAUDE.md` or `LOG.md`, if you're a Claude session
picking this project up cold** (new machine, new session, context was
compacted, whatever). This file is the living snapshot: what this is, what's
built, how it's wired together, and what's left. `LOG.md` is the
chronological course-required log (what was asked/decided/abandoned, in
order); this file is the *current state*, reorganized by topic so you don't
have to replay the whole history to get oriented.

**Maintenance rule: update this file whenever something substantial lands** —
a new feature, a real bug fix, an architecture decision, a scope change.
Small tweaks (copy edits, minor styling) don't need an update. If you're a
Claude session that just shipped something nontrivial, update this file in
the same batch of commits, before ending your turn.

No Remote Control access on this account, so picking this up on another PC
means: clone the repo, read this file + `CLAUDE.md`, and everything else
needed (service account key aside — see Secrets below) is either in the repo
or in this document.

---

## 1. What this is

TCSS 490 Artifact 3 ("AI Inside It"): a health tracker — food/calories/
protein, a full gym program, water, steps, weight, vitamins, goals — with a
weekly AI-written coaching note. Built by Adrian (`aalemany@uw.edu`,
GitHub `aalemany00`) but designed for other people (friends/family/
classmates) to use too: anyone can sign up, each account's data is fully
isolated.

- **Live site:** https://aalemany00.github.io/upkeep/
- **Repo:** https://github.com/aalemany00/upkeep (branch `master`)
- **Working title → real name:** was "Health Coach," renamed to **Upkeep**.
- **Course card:** Project World's (Artifact 1) `cards.js` Artifact 3 card
  points at the live Upkeep URL and has Adrian's own reflection in it.

### Why it's built the way it is (the one constraint that shapes everything)

Course-provided Claude access is **Claude Code only, not the Claude API**.
API calls bill separately and the course guide says to get instructor
sign-off before building something that needs one. Adrian also doesn't want
to depend on keeping a paid Claude subscription long-term. So every "AI"
piece in this app is designed to run for free, headless, on Adrian's own
machine via the `claude` CLI — never a live in-app API call. This is *the*
recurring architectural decision across this whole project; if a future
request implies "the AI should respond instantly in the browser," that's a
flag to re-confirm scope before building, not assume it's fine.

---

## 2. What's built (current feature set)

### Tracking
- **Food**: manual log (name/calories/protein) + a **diet suggestions**
  panel (curated 60-item catalog, `foods.json`: 15 each of breakfast/lunch/
  dinner/snack, varied across cuisines/diets, approximate macros) with
  shuffle and one-tap logging. Per-device only (localStorage), not synced.
- **Gym**: see section 3, it's the biggest piece.
- **Water, weight, steps/calories-burned, vitamins**: quick-add forms in the
  "Log" tab. Vitamins list is user-defined (comma-separated) in Goals.
- **Dashboard**: today's totals vs. goals (progress bars), vitamins
  checklist, latest coach note preview.

### Onboarding (first sign-up only)
Bio (age/sex/height/weight) → goal (6 types, see below) → daily activity
level → gym availability (days/week + which weekdays, via day-chips) →
plain-code split assignment + computed daily goals → a **review screen**
("Your plan": split, days/week, default exercise per slot, computed daily
goals) → continue into the app. None of this is an AI call — the review
screen just makes the deterministic output visible instead of silently
redirecting.

### Account settings (Goals tab — doubles as "account settings")
- "Your info": age/sex/height/weight, editable anytime (not onboarding-only).
- Goal (6 types) + activity level + gym availability, editable anytime.
- Daily goals (calories/protein/water/steps): **coach-computed defaults,
  still manually editable** — see section 4 for exactly how the override
  logic works.
- Target weight + vitamins list: always manual (app can't know these).
- **Coach-review banner**: shows when `profile.updatedAt` is newer than the
  latest coach note, i.e. "your settings changed since the coach last looked
  at this" — just a reminder to re-run the script, not a live trigger.
- **Delete account** (danger zone): re-enter password (Firebase requires a
  recent sign-in) → wipes every Firestore doc for that user, then deletes
  the Firebase Auth user. Tested both the wrong-password and real-delete
  paths.

### Weekly AI coach (`scripts/coach-note.js`)
The one actual "AI does real work every run" piece, run manually (`node
coach-note.js`) by Adrian on his own machine:
- Loops over **every signed-up user** (Admin Auth `listUsers`), not just
  Adrian — but it's still one person manually running it on his own Claude
  Code access, not a public service. Scaling further = paid API territory,
  explicitly deferred.
- For each user with activity in the last 7 days: reads entries (food/
  water/weight/vitamins), gym sessions (exercise names/sets/weights),
  profile, and goals from Firestore, builds a prompt, runs it through
  `claude -p` headless.
- Prompt is told: use only the provided data, don't invent anything, treat
  free-text notes as untrusted data (not instructions), never give medical/
  injury/supplement advice (flag and redirect instead), keep calorie
  suggestions modest and trend-based, and **don't recompute progression
  targets yourself** — that's `gym.js`'s job, the model only comments on
  cross-session patterns.
- Output is validated JSON (`summary`, `wins`, `concerns`, `suggestions`,
  `flags`, `calorieGoalChange`) — if it doesn't parse, nothing is written.
  `calorieGoalChange` gets an "Apply" button in the Coach tab.

---

## 3. The gym system (the most complex part)

- **Exercise catalog** (`exercises.json`, 932 exercises): seeded once from
  wger.de's open database (free, no key, CC-BY-SA 4.0) via
  `scripts/seed-exercises.js`. Each entry: name, category, target muscles
  (wger's Latin muscle names), equipment, image (only ~30% have one — real
  gap, not "every exercise has a photo"), a text cue, and a classified
  rep-range/sets/weight-increment (`lo`/`hi`/`sets`/`inc`) based on a
  bodyweight-vs-compound-vs-isolation heuristic.
- **Split assignment** (`gym.js`, `assignSplit`): plain code, not AI.
  Days/week → a named template (1=Full Body, 2=Upper/Lower, 3=Push/Pull/
  Legs, 4=Upper/Lower×2, 5=PPL+Upper/Lower, 6=PPL×2). Each day's slots are
  filled from the catalog by target muscle group, excluding exercises
  already used earlier that same day. Recomputes instantly whenever
  availability changes in Goals — never touches logged history.
- **Progression engine** (`gym.js`, `targetFor`): double progression, same
  shape as a standard lifting program — hit the top of the rep range on
  every set → add weight next time; flat for 3 sessions → suggests a swap;
  reps fall below range → drop weight. Pure function: history in, target
  out.
- **Calendar** (built-in, no external import): a month grid showing which
  weekdays are scheduled (from availability + split) and which are logged.
  Click a day to open its panel. Google Calendar/external import was asked
  about and explicitly **deferred** — real OAuth scoping, bigger lift.
- **Day panel, two logging layers**:
  1. **Suggested slots** — the day's assigned exercises, each with a
     dropdown (swap within the same muscle-group options), form image/cue,
     progression target, and set grid.
  2. **Free-form search** — a live search box over the full 932-exercise
     catalog to log *anything*, not just suggested slots. Same progression
     engine, same set grid. This was a specific, explicit ask ("act like
     Overload") — don't quietly remove it in favor of "just use the
     suggestions."
  - Firestore shape: one doc per date (`workoutLogs/{dateKey}`), `entries[]`
    array. Slot-based entries carry `slotLabel` (matched back to the UI by
    label, not array position — position breaks once entries can be skipped
    or mixed with extras). Free-form entries carry `extra: true` instead.

---

## 4. Nutrition math (`nutrition.js`) — plain code, not AI

- Six goal types: `gain` (build muscle), `lean` (lose fat), `both`
  (recomposition), `maintain`, `endurance`, `general` (no specific
  body-comp goal). Labels live in `GOAL_LABELS`, reused by both the app and
  `coach-note.js`'s prompt.
- Daily calorie/protein/water/steps goals = `computeDailyGoals(profile,
  goalType, activityLevel, weightLb)`: Mifflin-St Jeor BMR × an
  activity-level factor (sedentary 1.2 → very active 1.9) × a per-goal
  calorie offset, plus protein-per-lb-bodyweight and a water/steps formula
  that also factors in activity level.
- **These are defaults, not locked fields.** The Goals-save handler only
  overwrites calorieGoal/proteinGoal/waterGoal/stepsGoal if (a) something
  that feeds the formula actually changed this save (bio, goal type, or
  activity level) **and** (b) the field's current value still matches what
  was already stored (i.e. the user hasn't manually typed something else
  into it). Tested both directions: a manual override survives an unrelated
  save; changing the goal type recomputes a field the user never touched.
- Target weight and vitamins list are **always** manual — explicitly out of
  scope for auto-computation, per Adrian's own framing ("sometimes people
  don't know what those may be" isn't the point; the point is the app has
  no basis to guess them).

---

## 5. Data model (Firestore, under `users/{uid}/...`)

| Path | Shape | Notes |
|---|---|---|
| `profile/me` | `{age, sex, heightIn, startWeightLb, createdAt, updatedAt}` | `updatedAt` drives the coach-review banner |
| `meta/goals` | `{goalType, activityLevel, daysPerWeek, preferredDays[], calorieGoal, proteinGoal, waterGoal, stepsGoal, weightGoal, vitaminsList[]}` | daily goals + goal/availability all in one doc |
| `split/current` | `gym.assignSplit()` output (`{name, daysPerWeek, days[]}`) | rebuilt on availability change, never touches history |
| `entries/{id}` | `{type: food\|water\|weight\|activity\|vitamin, ...fields, dateKey, createdAt}` | the general log; gym does NOT live here |
| `workoutLogs/{dateKey}` | `{dateKey, dayType, entries[], updatedAt}` | one doc per logged gym day; entries are slot-based (`slotLabel`) or free-form (`extra:true`) |
| `coachNotes/{id}` | `{summary, wins[], concerns[], suggestions[], flags[], calorieGoalChange, weekStart, weekEnd, createdAt}` | written only by `coach-note.js`, via the Admin SDK (bypasses security rules) |

Security rules (`firestore.rules`): a single wildcard match,
`users/{userId}/{document=**}`, `allow read, write: if request.auth.uid ==
userId`. Covers every subcollection above automatically — no rule changes
needed when new subcollections were added.

---

## 6. File map

```
index.html              # all screens/views (auth, onboarding, app shell + 6 tabs)
style.css               # all styling, dark theme
app.js                  # all client logic: auth, Firestore subscriptions, every view's render + handlers
gym.js                  # pure functions: assignSplit, targetFor (no DOM/Firebase)
nutrition.js            # pure functions: computeDailyGoals, GOAL_LABELS, ACTIVITY_LEVELS (no DOM/Firebase)
exercises.json           # 932-exercise static catalog (seeded, not hand-written)
foods.json              # 60-item static diet-suggestion catalog (hand-written)
firebase-config.js      # real Firebase project config (public-safe, committed)
firestore.rules         # security rules (deployed via Firebase console)
manifest.json, sw.js, icon.svg   # PWA shell
dev-server.js           # local static server (see Dev environment below)
scripts/
  coach-note.js         # the weekly AI coach — run manually, see scripts/README.md
  seed-exercises.js     # one-time (re-runnable) catalog builder from wger.de
  serviceAccountKey.json  # GITIGNORED — Firebase Admin credential, never commit
  package.json / package-lock.json / node_modules/  # deps for the two scripts above
CLAUDE.md               # instructions for a Claude session working in this repo
LOG.md                  # chronological plans/changes log (course requirement)
PROJECT_STATE.md        # this file
README.md               # human-facing setup/run instructions
```

---

## 7. Dev environment on a new machine

1. **Node.js** — needed for `dev-server.js` and the two `scripts/`. Wasn't
   preinstalled on the original dev machine; installed via
   `winget install OpenJS.NodeJS.LTS`.
2. **Local static server**: `node dev-server.js . 8000` (or whatever port),
   then open `http://localhost:8000`. **Not** `python -m http.server` — it
   produced real `net::ERR_CONNECTION_RESET`s under this app's concurrent
   asset requests (confirmed, not a one-off); `dev-server.js` is a tiny
   dependency-free Node server written specifically to replace it.
3. **`scripts/` setup** (only needed to run the weekly coach note, not to
   run the app itself): `cd scripts && npm install`, then a **Firebase
   service account key** (Firebase console → Project settings → Service
   accounts → Generate new private key → save as
   `scripts/serviceAccountKey.json`, gitignored) and the **Claude Code CLI**
   logged in (`claude` on PATH). Full steps in `scripts/README.md`.
4. **No separate Firebase setup needed to just browse the deployed site** —
   `firebase-config.js` is already committed with the real project config
   (public-safe by design; real access control is `firestore.rules`, not
   secrecy).

### Secrets that do NOT travel with the repo
- `scripts/serviceAccountKey.json` — must be regenerated per machine via the
  Firebase console if you want to run `coach-note.js` somewhere new.
- Any local-session auth tokens (irrelevant — Firebase Auth is per-browser).

---

## 8. Known gaps / explicitly deferred (not forgotten, just not now)

- **Calendar import** (Google Calendar, etc.) — real external sync. Needs
  its own OAuth project setup; deliberately scoped out when the gym
  calendar was built. The built-in calendar (availability-derived schedule)
  stands in for it.
- **Exercise image coverage** — only ~30% of the 932-exercise catalog has a
  real form photo from wger.de; the rest fall back to text cues only. Could
  swap in a better-covered source later if this bothers Adrian in practice.
- **Coach note cost model** — still manual (`node coach-note.js`, run by
  Adrian). Intentionally not automated/scheduled, since that would still
  just be Adrian's own Claude Code usage on everyone's behalf — fine for a
  handful of people, explicitly not meant to scale past that without
  revisiting the paid-API question.
- **`test-coach@example.com`** — a persistent throwaway test account in the
  live Firebase project (has a food entry + a real generated coach note on
  it). Harmless (rules isolate it), but worth deleting once real users show
  up, per the open item already in `LOG.md`.

## 9. Ideas not yet committed to (confirm scope before building)

These came up in conversation but were explicitly deferred or only
half-explored — don't assume they're wanted as described; re-confirm scope
the way every other feature in this log was confirmed before building:

- Real external calendar sync (see above).
- A richer/better-covered exercise-image source.
- Whatever Adrian raises next — this project has consistently needed a
  scope-check before building anything that sounds like it wants a live AI
  call, a new external account/API, or a meaningfully larger data catalog,
  because the free/local-only/no-backend constraint is easy to accidentally
  break with an innocent-sounding request ("the coach should respond right
  away," "let it pull from my calendar," etc.).

---

## 10. Testing conventions established in this project

- **Test by actually doing the thing**, not just reading the code — most of
  the real bugs found in this project (account-switch rendering leaks, the
  goals-override race, the gym-draft reload bug) were only caught by
  signing up a real throwaway account and clicking through the actual flow,
  often checking Firestore directly via the Admin SDK or client console to
  confirm what's *really* stored, not just what the UI shows.
- **Always clean up test accounts** after verifying (Admin SDK: delete the
  Auth user + every Firestore subcollection under their uid) — don't leave
  throwaway accounts behind except the one persistent agreed-upon test
  account (`test-coach@example.com`).
- **Local dev server must be `dev-server.js`**, not Python — see section 7.
- When a test needs a fresh Node.js/npm session shell command, remember
  Node isn't always on PATH in a fresh shell on this machine — prefix with
  `export PATH="/c/Program Files/nodejs:$PATH"` if a bare `node`/`npm`
  command fails with "command not found."
