#!/usr/bin/env node
// Weekly coach note — the Artifact 3 "AI does real work every run" piece.
//
// Reads the last 7 days of logged health data + goals from Firestore, asks
// Claude Code (headless, `claude -p`, no API key) to read it and decide
// what's worth saying, then writes the result back as a coachNotes doc the
// web app displays. Run manually whenever you want a fresh note — there's
// no server behind the static site to trigger this automatically.
//
// Usage:  node coach-note.js
// Setup:  see README.md in this folder.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const here = (name) => new URL(name, import.meta.url);

const serviceAccount = JSON.parse(readFileSync(here("serviceAccountKey.json")));
const config = JSON.parse(readFileSync(here("config.json")));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const uid = config.uid;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function stripInternalFields(entry) {
  const { createdAt, ...rest } = entry;
  return rest;
}

function buildPrompt(entries, goals, start, end) {
  const lines = entries.map((e) => `- [${e.dateKey}] ${e.type}: ${JSON.stringify(stripInternalFields(e))}`);
  return `You are a supportive, concrete health coach. Below is one user's raw logged data for ${dateKey(start)} through ${dateKey(end)}, and their daily goals. Read it, do the analysis yourself (don't ask me anything back), and respond with ONLY a single JSON object, no markdown code fences, no commentary outside the JSON, matching exactly this shape:

{"summary": "1-2 sentence overview of the week", "wins": ["short bullet", ...], "concerns": ["short bullet", ...], "suggestions": ["short, concrete, actionable bullet", ...]}

Keep each list to at most 4 items. Be specific — use the actual numbers from the data — not generic advice. If a category has little or no data, say so briefly instead of inventing detail. Never invent entries that are not in the data below.

GOALS: ${JSON.stringify(goals)}

LOGGED ENTRIES:
${lines.join("\n")}
`;
}

// Plain-code boundary check: Claude's output must parse into exactly this
// shape before anything gets written. If it doesn't, we write nothing
// rather than let a broken note silently reach the app.
function parseNote(raw) {
  let text = raw.trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  text = text.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;
  for (const key of ["wins", "concerns", "suggestions"]) {
    if (parsed[key] !== undefined && !Array.isArray(parsed[key])) return null;
  }

  return {
    summary: parsed.summary,
    wins: parsed.wins || [],
    concerns: parsed.concerns || [],
    suggestions: parsed.suggestions || []
  };
}

async function main() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const entriesSnap = await db
    .collection("users").doc(uid).collection("entries")
    .where("createdAt", ">=", Timestamp.fromDate(start))
    .orderBy("createdAt", "asc")
    .get();
  const entries = entriesSnap.docs.map((d) => d.data());

  if (!entries.length) {
    console.error("No logged entries in the last 7 days — nothing to summarize. Log some data in the app first.");
    process.exit(1);
  }

  const goalsSnap = await db.collection("users").doc(uid).collection("meta").doc("goals").get();
  const goals = goalsSnap.exists ? goalsSnap.data() : {};

  const prompt = buildPrompt(entries, goals, start, end);

  console.log(`Asking Claude Code to review ${entries.length} entries from ${dateKey(start)} to ${dateKey(end)}...`);
  const raw = execFileSync("claude", ["-p", prompt], { encoding: "utf8", maxBuffer: 1024 * 1024 });

  const note = parseNote(raw);
  if (!note) {
    console.error("Claude's output didn't parse as the expected JSON shape. Nothing written.\n\nRaw output:\n", raw);
    process.exit(1);
  }

  await db.collection("users").doc(uid).collection("coachNotes").add({
    ...note,
    weekStart: dateKey(start),
    weekEnd: dateKey(end),
    createdAt: Timestamp.now()
  });

  console.log(`Coach note written for ${dateKey(start)} – ${dateKey(end)}. Check the Coach tab in the app.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
