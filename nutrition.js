// Pure functions: no DOM/Firebase. Daily calorie/protein/water/steps goals,
// computed from profile + goal + activity level — plain code, not an AI
// call, same boundary as gym.js's split assignment (see CLAUDE.md).

export const GOAL_LABELS = {
  gain: "Build muscle",
  lean: "Lose fat",
  both: "Recomposition (both)",
  maintain: "Maintain weight",
  endurance: "Improve endurance / cardio",
  general: "General health (no specific body-comp goal)"
};

// kcal/day offset from maintenance.
const GOAL_CALORIE_OFFSET = { gain: 250, lean: -250, both: 0, maintain: 0, endurance: 0, general: 0 };

// grams of protein per lb of bodyweight.
const GOAL_PROTEIN_PER_LB = { gain: 1.0, lean: 1.0, both: 0.9, maintain: 0.8, endurance: 0.7, general: 0.7 };

export const ACTIVITY_LEVELS = {
  sedentary: { label: "Sedentary (little/no exercise)", factor: 1.2, steps: 6000, waterBonusMl: 0 },
  light: { label: "Lightly active (1-3 days/week)", factor: 1.375, steps: 8000, waterBonusMl: 250 },
  moderate: { label: "Moderately active (3-5 days/week)", factor: 1.55, steps: 10000, waterBonusMl: 500 },
  active: { label: "Active (6-7 days/week)", factor: 1.725, steps: 12000, waterBonusMl: 750 },
  veryActive: { label: "Very active (physical job + training)", factor: 1.9, steps: 14000, waterBonusMl: 1000 }
};

function bmr(sex, weightKg, heightCm, age) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78; // "other": midpoint of the male/female constants
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

// profile: {age, sex, heightIn}. weightLb: current/latest weight (falls back
// to profile.startWeightLb by the caller if nothing's logged yet).
export function computeDailyGoals(profile, goalType, activityLevel, weightLb) {
  const activity = ACTIVITY_LEVELS[activityLevel] || ACTIVITY_LEVELS.moderate;
  const heightCm = (profile.heightIn || 0) * 2.54;
  const weightKg = (weightLb || 0) * 0.4536;

  const tdee = bmr(profile.sex, weightKg, heightCm, profile.age || 0) * activity.factor;
  const calorieGoal = roundTo(tdee + (GOAL_CALORIE_OFFSET[goalType] ?? 0), 50);
  const proteinGoal = roundTo((GOAL_PROTEIN_PER_LB[goalType] ?? 0.8) * weightLb, 5);
  const waterGoal = roundTo(weightLb * 15 + activity.waterBonusMl, 50);
  const stepsGoal = activity.steps;

  return { calorieGoal, proteinGoal, waterGoal, stepsGoal };
}
