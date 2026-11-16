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

// wger leaves `equipment` empty for a chunk of machine/cable exercises
// (confirmed against the live catalog, not a parsing bug on our end — the
// raw API response itself has no equipment tags for these). toEntry()
// below falls back to ["Bodyweight"] whenever equipment comes back empty,
// which is right for an actual bodyweight movement but wrong here: it
// means these show up as always-available regardless of someone's actual
// equipment (reported by a user whose home gym has no chest press machine,
// but got suggested "Chest Press" anyway). Checked against the name so the
// fallback becomes "Cable machine" — the closest EQUIPMENT_OPTIONS entry —
// instead, for exactly the exercises this would otherwise mislabel.
export const UNTAGGED_MACHINE_NAME_RE = /machine|cable|leg press|smith|pec deck|lat pulldown/i;

// A second, hand-reviewed batch: exercises whose *name* doesn't say
// "machine" (so UNTAGGED_MACHINE_NAME_RE above misses them — "Chest
// Press," not "Chest Press Machine") but whose own wger description makes
// clear they're only performable on a specific machine (seat height,
// weight stack, named commercial machine lines like Hammerstrength/
// Legend). Deliberately NOT a broader description-text regex — tried one
// (matching on "seat"/"pad"/"machine" in the cue) and it false-positived on
// genuinely bodyweight/TRX/plate exercises whose cue text happens to
// mention a machine in passing (e.g. "Reverse Nordic Curl" explicitly says
// "alternative to Leg Extension machine with no equipment," "Rack
// Deadlift"/"Hack Squats" can be done on a free rack OR a machine, so
// forcing either to Cable-machine-only would wrongly exclude a barbell-only
// user). Checked each of these individually against its own wger
// description before adding it here. Keyed by wger's own exercise id
// (`raw.id` below), which is stable across re-seeds.
export const KNOWN_UNTAGGED_MACHINE_IDS = new Set([
  378, // Leg Raises, Standing — leg raise machine
  1280, // Biceps Close Grip Pull Down — lat pull down machine
  1737, // Assisted chin-ups — machine-assisted (counterweights)
  1143, // Back extensión — seat/back pad adjustment, hyperextension machine
  622, // Standing Calf Raises — calf raise machine
  135, // Butterfly — pec deck/butterfly machine
  137, // Butterfly Narrow Grip — same machine, narrow grip
  129, // Chest Press — seated chest press machine (confirmed: cue mentions seat height/foot pedal)
  1831, // Hammerstrength Decline Chest Press — named commercial machine
  1918, // Legend Chest Press — named commercial machine, plate-loaded
  1773, // Legend Incline Bench Press — Legend Fitness LeverEdge machine, despite the "Bench Press" name
  1935, // Belt Squat — needs a belt squat machine/rig
  369, // Leg Extension — leg extension machine
  1521, // Pendular hack — pendulum hack machine
  2620, // Reverse V-Squat — V-squat machine
  12, // Seated Hip Adduction — hip adduction machine
  1449 // ClimbMill — stair-climber cardio machine
]);

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
    equipment: equipmentNames.length
      ? equipmentNames
      : [UNTAGGED_MACHINE_NAME_RE.test(name) || KNOWN_UNTAGGED_MACHINE_IDS.has(raw.id) ? "Cable machine" : "Bodyweight"],
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
