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

// One slot = one "kind" of movement for the day, with a muscle target the
// exercise catalog is filtered against. The user can swap within the
// matching options; the first option is just a reasonable default.
const SLOT_TEMPLATES = {
  "Full Body": [
    { label: "Squat pattern", muscles: musclesFor("quads") },
    { label: "Horizontal press", muscles: musclesFor("chest") },
    { label: "Horizontal pull", muscles: musclesFor("lats", "upperBack") },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes") },
    { label: "Shoulder press", muscles: musclesFor("shoulders") },
    { label: "Core", muscles: musclesFor("abs") }
  ],
  Upper: [
    { label: "Horizontal press", muscles: musclesFor("chest") },
    { label: "Vertical pull", muscles: musclesFor("lats") },
    { label: "Shoulder press", muscles: musclesFor("shoulders") },
    { label: "Horizontal pull", muscles: musclesFor("upperBack", "lats") },
    { label: "Biceps", muscles: musclesFor("biceps") },
    { label: "Triceps", muscles: musclesFor("triceps") }
  ],
  Lower: [
    { label: "Squat pattern", muscles: musclesFor("quads") },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes") },
    { label: "Leg press / lunge", muscles: musclesFor("quads", "glutes") },
    { label: "Calves", muscles: musclesFor("calves") },
    { label: "Core", muscles: musclesFor("abs") }
  ],
  Push: [
    { label: "Horizontal press", muscles: musclesFor("chest") },
    { label: "Shoulder press", muscles: musclesFor("shoulders") },
    { label: "Incline / fly", muscles: musclesFor("chest") },
    { label: "Lateral raise", muscles: musclesFor("shoulders") },
    { label: "Triceps", muscles: musclesFor("triceps") }
  ],
  Pull: [
    { label: "Vertical pull", muscles: musclesFor("lats") },
    { label: "Horizontal pull", muscles: musclesFor("upperBack", "lats") },
    { label: "Rear delt / upper back", muscles: musclesFor("upperBack") },
    { label: "Biceps", muscles: musclesFor("biceps") },
    { label: "Core", muscles: musclesFor("abs") }
  ],
  Legs: [
    { label: "Squat pattern", muscles: musclesFor("quads") },
    { label: "Hip hinge", muscles: musclesFor("hamstrings", "glutes") },
    { label: "Leg press / lunge", muscles: musclesFor("quads", "glutes") },
    { label: "Calves", muscles: musclesFor("calves") },
    { label: "Core", muscles: musclesFor("abs") }
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

function candidatesForSlot(catalog, muscles, excludeIds) {
  return catalog
    .filter((ex) => !excludeIds.has(ex.id) && ex.muscles.some((m) => muscles.includes(m)))
    .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

// Builds a full split from scratch. Deterministic, instant, no AI call —
// this is "plain code decides the mechanical mapping" (see CLAUDE.md);
// the weekly coach note is where qualitative judgment comes in.
export function assignSplit(daysPerWeek, catalog) {
  const days = clampDays(daysPerWeek);
  const template = SPLIT_TEMPLATES[days];

  return {
    name: template.name,
    daysPerWeek: days,
    days: template.dayTypes.map((dayType, i) => {
      const usedToday = new Set();
      return {
        key: `${dayType.replace(/\s+/g, "")}${i}`,
        dayType,
        slots: SLOT_TEMPLATES[dayType].map((slot) => {
          const options = candidatesForSlot(catalog, slot.muscles, usedToday);
          if (options[0]) usedToday.add(options[0].id);
          return {
            label: slot.label,
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
export function targetFor(history, exerciseMeta) {
  const { sets: targetSets, lo, hi, inc } = exerciseMeta;

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
