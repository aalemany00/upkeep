#!/usr/bin/env node
// One-off migration: re-fetches wger.de's exercise descriptions (full text,
// no arbitrary length cap this time — the UI now collapses/expands a long
// one instead of the data layer cutting it off mid-sentence) and updates
// just the `cue` field on the existing exercises.json, by id. Doesn't touch
// sets/lo/hi/inc/unit/muscles/equipment/images — those came from
// classify()/reclassify-exercises.js, not this script.
//
// Usage: node refresh-cues.js

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://wger.de/api/v2/exerciseinfo/?format=json&limit=100&language=2";
const FILE = new URL("../exercises.json", import.meta.url);

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

async function main() {
  console.log("Fetching full descriptions from wger.de...");
  const raw = await fetchAllPages();

  const cueById = new Map();
  for (const r of raw) {
    const en = r.translations.find((t) => t.language === 2 && t.name && t.name.trim());
    if (!en) continue;
    const cue = stripHtml(en.description) || "Controlled reps, full range of motion, stop a rep or two before form breaks.";
    cueById.set(r.id, cue);
  }

  const catalog = JSON.parse(readFileSync(FILE));
  let updated = 0;
  for (const ex of catalog) {
    const fresh = cueById.get(ex.id);
    if (fresh && fresh !== ex.cue) {
      ex.cue = fresh;
      updated++;
    }
  }

  writeFileSync(FILE, JSON.stringify(catalog, null, 2));
  console.log(`Updated ${updated} of ${catalog.length} cues with full (untruncated) text.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
