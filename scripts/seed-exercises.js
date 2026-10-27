#!/usr/bin/env node
// One-time (re-runnable) seed script: builds exercises.json, the app's
// static exercise catalog, from wger.de's open exercise database
// (CC-BY-SA 4.0, free, no API key). Not run by end users — just by
// whoever maintains the app, whenever the catalog needs refreshing.
//
// Usage: node seed-exercises.js

const BASE = "https://wger.de/api/v2/exerciseinfo/?format=json&limit=100&language=2";
const OUT_FILE = new URL("../exercises.json", import.meta.url);

// "Loaded" equipment actually adds external resistance you can add plates/
// pins to; props like a pull-up bar, a bench, or a mat assist a bodyweight
// movement without loading it, so an exercise tagged only with those is
// still bodyweight for progression purposes (fixes pull-ups etc. previously
// falling through to the generic isolation bucket and getting a plate-sized
// weight increment they can't actually use).
const LOAD_BARBELL = new Set(["Barbell", "SZ-Bar", "Smith machine"]);
const LOAD_DB_KB = new Set(["Dumbbell", "Kettlebell"]);
const LOAD_MACHINE = new Set(["Cable machine"]);
const COMPOUND_CATEGORIES = new Set(["Chest", "Back", "Legs", "Shoulders"]);

// Isometric holds (planks, wall sits, dead hangs, L-sits, ...) aren't
// reps at all — tracked in seconds instead, with its own rep-range fields
// reused as a time range (lo/hi seconds). A general-fitness hold
// progression (build time at one difficulty before moving to a harder
// variation) is the same "add a little, then add a little more" shape as
// double progression, just measured in time instead of reps.
const ISOMETRIC_RE = /\bplank\b|wall sit|hollow (body )?hold|\bl-?sit\b|dead ?hang|isometric|static hold|glute bridge hold|wall squat hold/i;

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Rep ranges and weight increments by exercise role, not one-size-fits-all:
//   - Isometric holds: time-based, not reps at all.
//   - Bodyweight: progress by reps/tempo/a harder variation, never plates
//     (inc 0) — a compound bodyweight move (pull-up, dip, push-up) is hard
//     enough at a lower rep count than an isolation-style bodyweight move
//     (most core work), which suits a higher-rep range instead.
//   - Barbell compound lifts (squat/deadlift/bench/OHP/row): the classic
//     strength-leaning rep range, so the coarsest increment this app uses
//     (a whole plate per side) actually gets hit regularly instead of
//     grinding reps up through a wide hypertrophy range first.
//   - Dumbbell/kettlebell/machine compound work: still a big muscle group,
//     but harder to load as heavy and often loaded in smaller increments —
//     a hypertrophy rep range fits better than a pure strength range.
//   - Everything else (isolation/accessory work): the standard isolation
//     hypertrophy/endurance range, with a light increment.
export function classify(name, category, equipmentNames) {
  if (ISOMETRIC_RE.test(name)) {
    return { sets: 3, lo: 20, hi: 60, inc: 0, unit: "sec" };
  }

  const isPrimary = COMPOUND_CATEGORIES.has(category);
  const hasBarbell = equipmentNames.some((e) => LOAD_BARBELL.has(e));
  const hasDbKb = equipmentNames.some((e) => LOAD_DB_KB.has(e));
  const hasMachine = equipmentNames.some((e) => LOAD_MACHINE.has(e));
  const isLoaded = hasBarbell || hasDbKb || hasMachine;

  if (!isLoaded) {
    return isPrimary
      ? { sets: 3, lo: 6, hi: 12, inc: 0, unit: "reps" }
      : { sets: 3, lo: 10, hi: 20, inc: 0, unit: "reps" };
  }
  if (hasBarbell && isPrimary) {
    return { sets: 3, lo: 5, hi: 8, inc: 5, unit: "reps" };
  }
  if (isPrimary) {
    return { sets: 3, lo: 8, hi: 12, inc: hasDbKb ? 2.5 : 5, unit: "reps" };
  }
  return { sets: 3, lo: 10, hi: 15, inc: 2.5, unit: "reps" };
}

async function fetchAllPages() {
  const all = [];
  let url = BASE;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wger API error ${res.status} for ${url}`);
    const page = await res.json();
    all.push(...page.results);
    url = page.next;
    if (url) console.log(`  fetched ${all.length} / ${page.count}...`);
  }
  return all;
}

function toEntry(raw) {
  const en = raw.translations.find((t) => t.language === 2 && t.name && t.name.trim());
  if (!en) return null;

  const category = raw.category?.name || "Other";
  const equipmentNames = (raw.equipment || []).map((e) => e.name);
  const muscleNames = (raw.muscles || []).map((m) => m.name);
  const image = raw.images && raw.images.length ? raw.images[0].image : null;
  const cue = stripHtml(en.description).slice(0, 300) || "Controlled reps, full range of motion, stop a rep or two before form breaks.";
  const name = en.name.trim();
  const { sets, lo, hi, inc, unit } = classify(name, category, equipmentNames);

  return {
    id: raw.id,
    name,
    category,
    muscles: muscleNames,
    equipment: equipmentNames.length ? equipmentNames : ["Bodyweight"],
    image,
    cue,
    sets, lo, hi, inc, unit
  };
}

async function main() {
  console.log("Fetching exercise catalog from wger.de...");
  const raw = await fetchAllPages();

  const seen = new Set();
  const entries = [];
  for (const r of raw) {
    const entry = toEntry(r);
    if (!entry) continue;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const withImages = entries.filter((e) => e.image).length;
  console.log(`Built ${entries.length} exercises (${withImages} with a form photo).`);
  console.log("Source: wger.de open exercise database, CC-BY-SA 4.0 (per-exercise author history is in wger's own API, not duplicated here).");

  await import("node:fs/promises").then((fs) => fs.writeFile(OUT_FILE, JSON.stringify(entries, null, 2)));
  console.log(`Wrote ${OUT_FILE.pathname.replace(/^\//, "")}`);
}

// Only run the live fetch when this file is executed directly (`node
// seed-exercises.js`) — not when `classify` is imported elsewhere (e.g. the
// reclassify-exercises.js migration script), which should never trigger a
// network call to wger.de just to reuse the classification heuristic.
const { pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
