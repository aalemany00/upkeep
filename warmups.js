// Static, hand-written warm-up/cool-down routines — same "bundled, no AI
// call, no new account" pattern as exercises.json/foods.json. Keyed by the
// gym day type (matches gym.js's SPLIT_TEMPLATES day types) so the Gym day
// panel can show a relevant warm-up before the lifts and a cool-down after,
// plus one generic cardio routine for the Cardio section.

export const WARMUPS_BY_DAYTYPE = {
  "Full Body": ["5 min light cardio (bike, row, or brisk walk)", "10x bodyweight squats", "10x arm circles each direction", "10x walking lunges", "10x inchworms"],
  Upper: ["5 min light cardio or rowing", "10x arm circles each direction", "15x band pull-aparts (or light rows)", "10x push-ups (slow, controlled)", "10x scapular shrugs on a bar or dead hang"],
  Lower: ["5 min light cardio or bike", "10x bodyweight squats", "10x walking lunges", "10x leg swings each leg (front-back, side-side)", "10x glute bridges"],
  Push: ["5 min light cardio", "10x arm circles each direction", "10x push-ups (slow, controlled)", "15x band pull-aparts", "10x shoulder dislocates (band or stick)"],
  Pull: ["5 min light cardio or rowing", "10x scapular shrugs on a bar or dead hang", "15x band pull-aparts", "10x cat-cow stretches", "10x light rows (band or cable)"],
  Legs: ["5 min light cardio or bike", "10x bodyweight squats", "10x walking lunges", "10x leg swings each leg (front-back, side-side)", "10x glute bridges"]
};

export const COOLDOWNS_BY_DAYTYPE = {
  "Full Body": ["30s quad stretch each leg", "30s hamstring stretch each leg", "30s chest doorway stretch", "30s child's pose"],
  Upper: ["30s chest doorway stretch", "30s overhead triceps stretch each arm", "30s cross-body shoulder stretch each arm", "30s child's pose"],
  Lower: ["30s quad stretch each leg", "30s hamstring stretch each leg", "30s calf stretch each leg", "30s seated figure-4 glute stretch each side"],
  Push: ["30s chest doorway stretch", "30s overhead triceps stretch each arm", "30s cross-body shoulder stretch each arm"],
  Pull: ["30s lat stretch each side", "30s cross-body shoulder stretch each arm", "30s child's pose"],
  Legs: ["30s quad stretch each leg", "30s hamstring stretch each leg", "30s calf stretch each leg", "30s seated figure-4 glute stretch each side"]
};

export const CARDIO_WARMUP = ["5 min easy-pace walk or jog to get moving", "10x leg swings each leg (front-back, side-side)", "10x walking lunges", "3x 20-second gradual pickups to near-race pace"];
export const CARDIO_COOLDOWN = ["5 min easy walk to bring your heart rate down", "30s quad stretch each leg", "30s hamstring stretch each leg", "30s calf stretch each leg"];
