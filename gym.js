// Pure gym logic: no DOM, no Firebase. Split assignment + double-progression,
// both plain code — the model never touches this math (see CLAUDE.md).

// wger.de's muscle names (Latin, matching exercises.json's `muscles` field)
// grouped into the labels our slot templates use.
const MUSCLE_GROUPS = {
  chest: ["Pectoralis major"],
  lats: ["Latissimus dorsi"],
  upperBack: ["Trapezius"],
  shoulders: ["Anterior deltoid"],
  biceps: ["Biceps brachii", "Brachialis"],
  triceps: ["Triceps brachii"],
  quads: ["Quadriceps femoris"],
  hamstrings: ["Biceps femoris"],
  glutes: ["Gluteus maximus"],
  calves: ["Gastrocnemius", "Soleus"],
  abs: ["Rectus abdominis", "Obliquus externus abdominis"]
};

function musclesFor(...groups) {
  return groups.flatMap((g) => MUSCLE_GROUPS[g]);
}

// Bump this whenever SLOT_TEMPLATES/candidatesForSlot/PATTERNS changes in a
// way that should reach already-onboarded users, not just new signups.
// Stored on every split doc; app.js compares it on load and silently
// rebuilds (same daysPerWeek, no AI call, logged history untouched) if a
// user's stored split predates the current logic — otherwise a fix here
// would only apply to the next person who re-onboards or changes
// availability, not to anyone with an existing split already in Firestore.
export const SPLIT_ALGO_VERSION = 3;

// Equipment a user can pick from in Goals (exercises.json's `equipment`
// field, minus the two "no equipment needed" markers below, which are
// always treated as available — nobody needs to opt into bodyweight work).
export const EQUIPMENT_OPTIONS = [
  "Barbell",
  "SZ-Bar",
  "Dumbbell",
  "Kettlebell",
  "Cable machine",
  "Bench",
  "Incline bench",
  "Pull-up bar",
  "Resistance band",
  "Swiss Ball",
  "Gym mat"
];
const NO_EQUIPMENT_NEEDED = new Set(["Bodyweight", "none (bodyweight exercise)"]);

// `availableEquipment` is a Set (what the user has) or null/undefined
// (no restriction — the default for anyone who hasn't set this up, so
// existing users see no behavior change until they opt in via Goals).
function hasAvailableEquipment(ex, availableEquipment) {
  if (!availableEquipment) return true;
  return ex.equipment.every((eq) => NO_EQUIPMENT_NEEDED.has(eq) || availableEquipment.has(eq));
}

// Human-readable muscle target shown in the UI alongside each slot's
// movement-pattern label (e.g. "Squat pattern — Quads"), so the muscle being
// trained is visible, not just the pattern name. Keyed by label text because
// the same label always targets the same muscle(s) across every day type
// that uses it (see SLOT_TEMPLATES below).
export const MUSCLE_LABEL_BY_SLOT = {
  "Squat pattern": "Quads",
  "Horizontal press": "Chest",
  "Horizontal pull": "Back",
  "Hip hinge": "Hamstrings & Glutes",
  "Shoulder press": "Shoulders",
  Core: "Abs",
  "Vertical pull": "Lats",
  Biceps: "Biceps",
  Triceps: "Triceps",
  "Leg press / lunge": "Quads & Glutes",
  Calves: "Calves",
  "Incline / fly": "Chest",
  "Lateral raise": "Shoulders",
  "Rear delt / upper back": "Upper Back"
};

// Movement-pattern keywords, matched against exercise names, so a slot
// prefers exercises that actually perform its pattern instead of just any
// exercise that happens to touch the right muscle. Without this, e.g. a
// squat (quads + glutes) satisfies the "Hip hinge" slot's muscle filter
// (hamstrings + glutes) too, so the same squat gets suggested for both a
// squat slot and a hinge slot on the same day. candidatesForSlot() falls
// back to the plain muscle filter if a pattern matches nothing, so this
// only narrows the pool, never empties it.
const LUNGE_VARIANT = /split|bulgarian|lunge|step[- ]?up/i;
const PATTERNS = {
  // Excludes lunge/split-squat variants so a "squat"-named lunge doesn't
  // compete with Leg press/lunge's own pool for the same slot-option set.
  squat: (name) => /squat/i.test(name) && !LUNGE_VARIANT.test(name),
  legPressLunge: /press|lunge|split squat|bulgarian|step[- ]?up/i,
  hipHinge: /deadlift|rdl|romanian|good morning|hip thrust|glute bridge|hyperextension|swing|hinge/i,
  horizontalPress: /bench press|chest press|push[- ]?up/i,
  inclineFly: /incline|fly|pec deck|decline/i,
  shoulderPress: /overhead press|shoulder press|military press|arnold press/i,
  lateralRaise: /lateral raise/i,
  verticalPull: /pull[- ]?up|pulldown|chin[- ]?up/i,
  horizontalPull: /row/i,
  rearDelt: /rear delt|face pull|reverse fly|shrug/i,
  curl: /curl/i,
  triceps: /tricep|pushdown|skull ?crusher|dip|extension/i,
  core: /plank|crunch|sit[- ]?up|leg raise|russian twist|ab wheel|mountain climber|dead bug|bicycle/i,
  calves: /calf/i
};

// One slot = one "kind" of movement for the day, with a muscle target the
// exercise catalog is filtered against (and, where it matters for avoiding
// overlap between slots, a movement-pattern keyword preference). The user
// can swap within the matching options; the first option is just a
// reasonable default.
const SLOT_TEMPLATES = {
  // Every day type's slots, combined across a full week of that split, must
  // cover every entry in MUSCLE_GROUPS at least once — this isn't goal-
  // specific (assignSplit doesn't look at goal type at all), so "don't skip
  // a body part" holds for every goal, not just recomposition. Full Body
  // used to stop at 6 slots and skip biceps/triceps/calves entirely for a
  // 1-day/week split; it now covers all 11 groups in one day.
  "Full Body": [
    { label: "Squat pattern", muscles: musclesFor("quads"), pattern: PATTERNS.squat },
    { label: "Horizontal press", muscles: musclesFor("chest"), pattern: PATTERNS.horizontalPress },
    { label: "Horizontal pull", muscles: musclesFor("lats", "upperBack"), pattern: PATTERNS.horizontalPull },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes"), pattern: PATTERNS.hipHinge },
    { label: "Shoulder press", muscles: musclesFor("shoulders"), pattern: PATTERNS.shoulderPress },
    { label: "Biceps", muscles: musclesFor("biceps"), pattern: PATTERNS.curl },
    { label: "Triceps", muscles: musclesFor("triceps"), pattern: PATTERNS.triceps },
    { label: "Calves", muscles: musclesFor("calves"), pattern: PATTERNS.calves },
    { label: "Core", muscles: musclesFor("abs"), pattern: PATTERNS.core }
  ],
  Upper: [
    { label: "Horizontal press", muscles: musclesFor("chest"), pattern: PATTERNS.horizontalPress },
    { label: "Vertical pull", muscles: musclesFor("lats"), pattern: PATTERNS.verticalPull },
    { label: "Shoulder press", muscles: musclesFor("shoulders"), pattern: PATTERNS.shoulderPress },
    { label: "Horizontal pull", muscles: musclesFor("upperBack", "lats"), pattern: PATTERNS.horizontalPull },
    { label: "Biceps", muscles: musclesFor("biceps"), pattern: PATTERNS.curl },
    { label: "Triceps", muscles: musclesFor("triceps"), pattern: PATTERNS.triceps }
  ],
  Lower: [
    { label: "Squat pattern", muscles: musclesFor("quads"), pattern: PATTERNS.squat },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes"), pattern: PATTERNS.hipHinge },
    { label: "Leg press / lunge", muscles: musclesFor("quads", "glutes"), pattern: PATTERNS.legPressLunge },
    { label: "Calves", muscles: musclesFor("calves"), pattern: PATTERNS.calves },
    { label: "Core", muscles: musclesFor("abs"), pattern: PATTERNS.core }
  ],
  Push: [
    { label: "Horizontal press", muscles: musclesFor("chest"), pattern: PATTERNS.horizontalPress },
    { label: "Shoulder press", muscles: musclesFor("shoulders"), pattern: PATTERNS.shoulderPress },
    { label: "Incline / fly", muscles: musclesFor("chest"), pattern: PATTERNS.inclineFly },
    { label: "Lateral raise", muscles: musclesFor("shoulders"), pattern: PATTERNS.lateralRaise },
    { label: "Triceps", muscles: musclesFor("triceps"), pattern: PATTERNS.triceps }
  ],
  Pull: [
    { label: "Vertical pull", muscles: musclesFor("lats"), pattern: PATTERNS.verticalPull },
    { label: "Horizontal pull", muscles: musclesFor("upperBack", "lats"), pattern: PATTERNS.horizontalPull },
    { label: "Rear delt / upper back", muscles: musclesFor("upperBack"), pattern: PATTERNS.rearDelt },
    { label: "Biceps", muscles: musclesFor("biceps"), pattern: PATTERNS.curl },
    { label: "Core", muscles: musclesFor("abs"), pattern: PATTERNS.core }
  ],
  Legs: [
    { label: "Squat pattern", muscles: musclesFor("quads"), pattern: PATTERNS.squat },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes"), pattern: PATTERNS.hipHinge },
    { label: "Leg press / lunge", muscles: musclesFor("quads", "glutes"), pattern: PATTERNS.legPressLunge },
    { label: "Calves", muscles: musclesFor("calves"), pattern: PATTERNS.calves },
    { label: "Core", muscles: musclesFor("abs"), pattern: PATTERNS.core }
  ]
};

// Which day types a week of N days cycles through. Deliberately simple,
// well-known splits rather than anything exotic.
export const SPLIT_TEMPLATES = {
  1: { name: "Full Body", dayTypes: ["Full Body"] },
  2: { name: "Upper / Lower", dayTypes: ["Upper", "Lower"] },
  3: { name: "Push / Pull / Legs", dayTypes: ["Push", "Pull", "Legs"] },
  4: { name: "Upper / Lower x2", dayTypes: ["Upper", "Lower", "Upper", "Lower"] },
  5: { name: "Push / Pull / Legs + Upper / Lower", dayTypes: ["Push", "Pull", "Legs", "Upper", "Lower"] },
  6: { name: "Push / Pull / Legs x2", dayTypes: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"] }
};

function clampDays(daysPerWeek) {
  return Math.min(6, Math.max(1, Math.round(daysPerWeek) || 1));
}

function matchesPattern(pattern, name) {
  return typeof pattern === "function" ? pattern(name) : pattern.test(name);
}

// Common shorthand people actually write in a workout log (DB bench press,
// RDL, OH extension) that the wger catalog never abbreviates — expanded
// before matching so free-form search isn't limited to exact wording. Word-
// boundary matched so this doesn't mangle a word that merely contains these
// letters (e.g. "band").
const SEARCH_ABBREVIATIONS = [
  [/\bdb\b/gi, "dumbbell"],
  [/\bbb\b/gi, "barbell"],
  [/\bkb\b/gi, "kettlebell"],
  [/\boh\b/gi, "overhead"],
  [/\brdl\b/gi, "romanian deadlift"],
  [/\bohp\b/gi, "overhead press"]
];

function expandSearchAbbreviations(query) {
  return SEARCH_ABBREVIATIONS.reduce((q, [pattern, replacement]) => q.replace(pattern, replacement), query);
}

// Free-form exercise search used by the Gym tab's "add any other exercise"
// box. A plain whole-phrase substring match (the original implementation)
// fails on anything typed in a different word order or with a word the
// catalog doesn't use (e.g. "seated DB shoulder press" when the catalog
// just has "Shoulder Press, Dumbbells" — no "seated" in it at all) — this
// instead scores every exercise by how many of the typed words it contains
// and ranks by that, so a partial/reordered/abbreviated match still surfaces
// the closest real exercises instead of "no matches."
export function searchExercises(query, catalog, limit = 10) {
  const words = expandSearchAbbreviations(query.toLowerCase())
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!words.length) return [];

  return catalog
    .map((ex) => {
      const name = ex.name.toLowerCase();
      const matchCount = words.filter((w) => name.includes(w)).length;
      return { ex, matchCount };
    })
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || a.ex.name.localeCompare(b.ex.name))
    .slice(0, limit)
    .map((s) => s.ex);
}

function candidatesForSlot(catalog, muscles, excludeIds, pattern, availableEquipment) {
  const byMuscle = catalog.filter(
    (ex) => !excludeIds.has(ex.id) && ex.muscles.some((m) => muscles.includes(m))
  );
  // Prefer exercises the user can actually do with their equipment. Falls
  // back to the unfiltered muscle match if that would leave nothing (e.g.
  // someone with almost no equipment selected) — equipment should narrow
  // the pool, never leave a slot with zero options.
  const eqFiltered = byMuscle.filter((ex) => hasAvailableEquipment(ex, availableEquipment));
  const equipmentPool = eqFiltered.length ? eqFiltered : byMuscle;
  // Prefer exercises that actually match this slot's movement pattern (e.g.
  // a real hinge for "Hip hinge", not just anything that happens to touch
  // hamstrings/glutes). Fall back to the equipment-filtered match if the
  // pattern filter would leave nothing — a pattern should narrow the pool,
  // never empty it.
  const preferred = pattern ? equipmentPool.filter((ex) => matchesPattern(pattern, ex.name)) : [];
  const pool = preferred.length ? preferred : equipmentPool;
  return pool
    .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

// Builds a full split from scratch. Deterministic, instant, no AI call —
// this is "plain code decides the mechanical mapping" (see CLAUDE.md);
// the weekly coach note is where qualitative judgment comes in.
// `equipmentInput`: either a flat array of EQUIPMENT_OPTIONS strings applied
// to every day (legacy/simple case), or an array of arrays — one equipment
// list per split day, same order as `daysPerWeek`/`preferredDays` — so a
// Monday-at-home, Wednesday-at-the-gym kind of week can suggest differently
// per day instead of one all-or-nothing equipment setting. null/undefined
// or an empty list means no restriction (everything available) for that day.
export function assignSplit(daysPerWeek, catalog, equipmentInput) {
  const days = clampDays(daysPerWeek);
  const template = SPLIT_TEMPLATES[days];
  const perDayEquipment = Array.isArray(equipmentInput) && Array.isArray(equipmentInput[0])
    ? equipmentInput
    : null; // flat list (or nothing) — same equipment set broadcast to every day below

  return {
    name: template.name,
    daysPerWeek: days,
    algoVersion: SPLIT_ALGO_VERSION,
    days: template.dayTypes.map((dayType, i) => {
      const usedToday = new Set();
      const dayEquipmentList = perDayEquipment ? perDayEquipment[i] : equipmentInput;
      const availableEquipment = dayEquipmentList && dayEquipmentList.length ? new Set(dayEquipmentList) : null;
      return {
        key: `${dayType.replace(/\s+/g, "")}${i}`,
        dayType,
        slots: SLOT_TEMPLATES[dayType].map((slot) => {
          const options = candidatesForSlot(catalog, slot.muscles, usedToday, slot.pattern, availableEquipment);
          // Exclude every option shown for this slot, not just the default,
          // from every later slot today — otherwise the same exercise can
          // sit in two slots' dropdowns at once (not literally recommended
          // twice, but the pools overlap, which is the same practical
          // problem: picking it for one slot quietly narrows another).
          options.forEach((o) => usedToday.add(o.id));
          return {
            label: slot.label,
            muscleLabel: MUSCLE_LABEL_BY_SLOT[slot.label] ?? "",
            options: options.map((o) => o.id),
            defaultId: options[0]?.id ?? null
          };
        })
      };
    })
  };
}

// ---------------------------------------------------------------------
// Double-progression engine (same shape as a standard "double progression"
// program: stay at one weight until every set hits the top of the rep
// range, then add weight and restart at the bottom).
// ---------------------------------------------------------------------

// history: array of past logs for ONE exercise, oldest to newest, each
// `{ sets: [{ w, r }, ...] }` with r > 0. exerciseMeta: `{ sets, lo, hi, inc }`.
// `minIncrementLb`: the smallest weight jump actually available (e.g. a
// gym whose dumbbells only go up by 5lb) — 0/undefined means "trust each
// exercise's own built-in increment as-is" (prior behavior, so anyone who
// hasn't set this in Goals sees no change). Only applied to exercises that
// are loadable at all (inc > 0); it never forces a weight jump onto a
// bodyweight-classified movement (inc === 0), since those progress by
// reps/tempo, not plates.
export function targetFor(history, exerciseMeta, minIncrementLb = 0) {
  const { sets: targetSets, lo, hi, inc: exerciseInc } = exerciseMeta;
  const inc = exerciseInc > 0 ? Math.max(exerciseInc, minIncrementLb || 0) : exerciseInc;

  if (!history.length) {
    return { status: "new", weight: null, note: `First time — pick a weight where your first set lands in ${lo}-${hi} reps with a couple left in the tank.` };
  }

  const last = history[history.length - 1];
  const lastSets = last.sets;
  const topWeight = Math.max(...lastSets.map((s) => s.w || 0));
  const allAtTop = lastSets.length >= targetSets && lastSets.every((s) => s.r >= hi);
  const avgReps = lastSets.reduce((a, s) => a + s.r, 0) / lastSets.length;

  if (allAtTop) {
    if (topWeight === 0) {
      return { status: "up", weight: 0, note: `Hit ${hi} reps on every set — make it harder (slower tempo, added weight if possible), then rebuild from ${lo}.` };
    }
    const next = topWeight + inc;
    return { status: "up", weight: next, note: `Hit ${hi} on every set last time — go up to ${next} and aim for ${lo}+ reps.` };
  }

  if (history.length >= 3) {
    const last3 = history.slice(-3);
    const weights = last3.map((h) => Math.max(...h.sets.map((s) => s.w || 0)));
    const totalReps = last3.map((h) => h.sets.reduce((a, s) => a + s.r, 0));
    if (weights[0] === weights[1] && weights[1] === weights[2] && totalReps[2] <= totalReps[0]) {
      return { status: "stall", weight: topWeight, note: `Flat for 3 sessions at ${topWeight} — try a different exercise for this slot, or drop about 10% and rebuild.` };
    }
  }

  if (avgReps < lo - 0.5 && topWeight > 0) {
    const next = Math.max(0, topWeight - Math.max(inc, 2.5));
    return { status: "down", weight: next, note: `Reps dropped below ${lo} last time — drop to ${next} and rebuild toward ${hi}.` };
  }

  const aim = lastSets.map((s) => Math.min(hi, s.r + 1));
  return { status: "hold", weight: topWeight, aim, note: `Same weight (${topWeight}) — beat last time's ${lastSets.map((s) => s.r).join("/")} with ${aim.join("/")}.` };
}
