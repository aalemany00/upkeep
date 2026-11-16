#!/usr/bin/env node
// One-off migration: wger leaves `equipment` empty for a chunk of
// machine/cable exercises (confirmed against the live catalog, not a
// parsing bug on our end), and the old seed-exercises.js fallback turned
// that into `["Bodyweight"]` — meaning these showed up as always-available
// regardless of someone's actual equipment (reported by a user whose home
// gym has no chest press machine, but got suggested "Chest Press" anyway).
// seed-exercises.js's toEntry() now defaults an untagged exercise to
// "Cable machine" instead of "Bodyweight" when its name matches
// UNTAGGED_MACHINE_NAME_RE, but that only affects a future live re-seed —
// this script re-applies the same correction to the EXISTING exercises.json
// in place, same ids/names/images/cues/sets/rep-ranges, only `equipment`
// changes, and only for entries that were exactly `["Bodyweight"]` (the
// fallback value) to begin with — an exercise wger explicitly tagged
// "Bodyweight" on purpose is left alone.
//
// Usage: node fix-untagged-machine-equipment.js

import { readFileSync, writeFileSync } from "node:fs";
import { UNTAGGED_MACHINE_NAME_RE, KNOWN_UNTAGGED_MACHINE_IDS } from "./seed-exercises.js";

const FILE = new URL("../exercises.json", import.meta.url);

const catalog = JSON.parse(readFileSync(FILE));

let changed = 0;
for (const ex of catalog) {
  const wasFallbackBodyweight = Array.isArray(ex.equipment) && ex.equipment.length === 1 && ex.equipment[0] === "Bodyweight";
  if (wasFallbackBodyweight && (UNTAGGED_MACHINE_NAME_RE.test(ex.name) || KNOWN_UNTAGGED_MACHINE_IDS.has(ex.id))) {
    ex.equipment = ["Cable machine"];
    changed++;
    console.log(`  ${ex.id} | ${ex.name}`);
  }
}

writeFileSync(FILE, JSON.stringify(catalog, null, 2));
console.log(`Retagged ${changed} of ${catalog.length} exercises from the "Bodyweight" fallback to "Cable machine".`);
