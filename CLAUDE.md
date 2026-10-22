# Upkeep

TCSS 490 Artifact 3 ("AI Inside It"). A health tracker — food/calories/
protein, gym workouts, water, steps, weight, vitamins/supplements, and goals —
synced between phone and PC, with a weekly AI-written coaching note. Built
for Adrian but usable by other people (friends/family/classmates) too: any
number of people can sign up, each sees only their own data.

## Stack

- Plain HTML/CSS/JS, no build step, deployed as a static site to GitHub Pages
  (same approach as Artifact 2).
- Installable as a PWA (manifest + service worker) so it works full-screen on
  a phone home screen.
- Firebase (Auth + Firestore) for sign-in and multi-device sync. Free tier.
- No paid AI API. Account creation for any third-party service (Firebase,
  etc.) is Adrian's own action, not something I do for him.

## Where the AI is (the Artifact 3 requirement)

The model does real, deciding work every time the coaching script runs — it
is not just the tool used to build this app.

- **What the model owns:** `scripts/coach-note.js` gathers the last 7 days of
  logged food/exercise/water/weight/vitamins + the user's goals into a single
  prompt, then runs it through Claude Code **headless** (`claude -p`, no API
  key, uses Adrian's course Claude Code access — same pattern the course
  guide names as a free example). Claude reads the week's numbers, decides
  what's worth saying, and writes a short structured note: what's on track,
  what's not, and one or two concrete suggestions.
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
