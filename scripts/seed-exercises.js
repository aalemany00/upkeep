#!/usr/bin/env node
// One-time (re-runnable) seed script: builds exercises.json, the app's
// static exercise catalog, from wger.de's open exercise database
// (CC-BY-SA 4.0, free, no API key). Not run by end users — just by
// whoever maintains the app, whenever the catalog needs refreshing.
//
// Usage: node seed-exercises.js

const BASE = "https://wger.de/api/v2/exerciseinfo/?format=json&limit=100&language=2";
const OUT_FILE = new URL("../exercises.json", import.meta.url);

const COMPOUND_EQUIPMENT = new Set(["Barbell", "SZ-Bar", "Smith machine"]);
const COMPOUND_CATEGORIES = new Set(["Chest", "Back", "Legs", "Shoulders"]);

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function classify(category, equipmentNames) {
  const isBodyweight = equipmentNames.length === 0 || equipmentNames.includes("none (bodyweight exercise)");
  const isCompound = !isBodyweight && COMPOUND_CATEGORIES.has(category) && equipmentNames.some((e) => COMPOUND_EQUIPMENT.has(e));

  if (isBodyweight) return { sets: 3, lo: 8, hi: 15, inc: 0 };
  if (isCompound) return { sets: 3, lo: 6, hi: 10, inc: 5 };
  return { sets: 3, lo: 10, hi: 15, inc: 2.5 };
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
  const { sets, lo, hi, inc } = classify(category, equipmentNames);

  return {
    id: raw.id,
    name: en.name.trim(),
    category,
    muscles: muscleNames,
    equipment: equipmentNames.length ? equipmentNames : ["Bodyweight"],
    image,
    cue,
    sets, lo, hi, inc
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
