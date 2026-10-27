#!/usr/bin/env node
// One-off migration: re-applies seed-exercises.js's classify() heuristic to
// the EXISTING exercises.json in place (same ids/names/images/cues — only
// sets/lo/hi/inc/unit change). Run this whenever classify() changes, instead
// of a full re-seed, so the catalog doesn't need a live wger.de fetch just
// to pick up a better rep-range/progression heuristic.
//
// Usage: node reclassify-exercises.js

import { readFileSync, writeFileSync } from "node:fs";
import { classify } from "./seed-exercises.js";

const FILE = new URL("../exercises.json", import.meta.url);
const catalog = JSON.parse(readFileSync(FILE));

let changed = 0;
const byUnit = {};
for (const ex of catalog) {
  const next = classify(ex.name, ex.category, ex.equipment);
  const prevKey = `${ex.sets},${ex.lo},${ex.hi},${ex.inc},${ex.unit || "reps"}`;
  const nextKey = `${next.sets},${next.lo},${next.hi},${next.inc},${next.unit}`;
  if (prevKey !== nextKey) changed++;
  Object.assign(ex, next);
  byUnit[next.unit] = (byUnit[next.unit] || 0) + 1;
}

writeFileSync(FILE, JSON.stringify(catalog, null, 2));
console.log(`Reclassified ${catalog.length} exercises (${changed} changed their sets/rep-range/increment).`);
console.log("By unit:", byUnit);
