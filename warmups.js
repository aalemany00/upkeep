// Static, hand-written warm-up/cool-down/stretch routines — same "bundled,
// no AI call, no new account" pattern as exercises.json/foods.json. Keyed by
// the gym day type (matches gym.js's SPLIT_TEMPLATES day types) so the Gym
// day panel can show a relevant warm-up before the lifts and a cool-down
// after, plus one generic cardio routine and one always-available daily
// stretch routine (not gym-day-gated — stretching matters on rest days too).
//
// Each step is `{ step, why }` — the "why" is a short, honest explanation of
// what the movement is actually doing (loosen a joint, raise tissue
// temperature, lengthen a muscle), not a vague "warms you up." This is what
// a user asked for after noticing a one-sided muscle imbalance during a
// workout and wanting to understand *why* something might start hurting,
// not just a checklist with no reasoning behind it.

export const WARMUPS_BY_DAYTYPE = {
  "Full Body": [
    { step: "5 min light cardio (bike, row, or brisk walk)", why: "Raises muscle temperature and blood flow before anything gets loaded — cold muscle is stiffer and more strain-prone." },
    { step: "10x bodyweight squats", why: "Takes the hips/knees/ankles through the same range they'll see under a bar, without the load yet." },
    { step: "10x arm circles each direction", why: "Lubricates the shoulder joint through a full range before pressing or pulling loads it." },
    { step: "10x walking lunges", why: "Warms the hips and knees through a single-leg pattern, which a static squat warm-up alone doesn't cover." },
    { step: "10x inchworms", why: "Mobilizes the hamstrings and spine and gets the core/shoulders primed together in one movement." }
  ],
  Upper: [
    { step: "5 min light cardio or rowing", why: "Raises muscle temperature before upper-body pressing/pulling work." },
    { step: "10x arm circles each direction", why: "Lubricates the shoulder joint through a full range before it's loaded." },
    { step: "15x band pull-aparts (or light rows)", why: "Activates the upper back/rear delts, which otherwise get under-used until they're needed to stabilize a heavier press." },
    { step: "10x push-ups (slow, controlled)", why: "A light, bodyweight rehearsal of the pressing pattern before adding load." },
    { step: "10x scapular shrugs on a bar or dead hang", why: "Preps the shoulder blades to move properly before pulling exercises ask them to." }
  ],
  Lower: [
    { step: "5 min light cardio or bike", why: "Raises muscle temperature before squatting/hinging patterns load the legs." },
    { step: "10x bodyweight squats", why: "Rehearses the squat pattern through a full range before weight is added." },
    { step: "10x walking lunges", why: "Warms the hips and knees through a single-leg pattern a squat alone doesn't cover." },
    { step: "10x leg swings each leg (front-back, side-side)", why: "Takes the hip through its full range in multiple directions, since lifting mostly moves it in just one plane." },
    { step: "10x glute bridges", why: "Activates the glutes before a hip hinge exercise asks them to do the real work, instead of the lower back compensating." }
  ],
  Push: [
    { step: "5 min light cardio", why: "Raises muscle temperature before pressing work." },
    { step: "10x arm circles each direction", why: "Lubricates the shoulder joint before it's loaded overhead or horizontally." },
    { step: "10x push-ups (slow, controlled)", why: "A light rehearsal of the horizontal press pattern before adding load." },
    { step: "15x band pull-aparts", why: "Balances out all the pressing with a pulling movement, so the shoulder isn't warmed up only on one side of the joint." },
    { step: "10x shoulder dislocates (band or stick)", why: "Takes the shoulder through an exaggerated range to check and improve overhead mobility before pressing overhead." }
  ],
  Pull: [
    { step: "5 min light cardio or rowing", why: "Raises muscle temperature before pulling work." },
    { step: "10x scapular shrugs on a bar or dead hang", why: "Preps the shoulder blades to retract/depress properly before rows and pull-ups ask them to." },
    { step: "15x band pull-aparts", why: "Activates the upper back and rear delts at light load before they're asked to pull real weight." },
    { step: "10x cat-cow stretches", why: "Mobilizes the spine, which rounds and extends through most rowing and pulling movements." },
    { step: "10x light rows (band or cable)", why: "A light rehearsal of the pulling pattern before adding real load." }
  ],
  Legs: [
    { step: "5 min light cardio or bike", why: "Raises muscle temperature before squatting/hinging patterns load the legs." },
    { step: "10x bodyweight squats", why: "Rehearses the squat pattern through a full range before weight is added." },
    { step: "10x walking lunges", why: "Warms the hips and knees through a single-leg pattern a squat alone doesn't cover." },
    { step: "10x leg swings each leg (front-back, side-side)", why: "Takes the hip through its full range in multiple directions, since lifting mostly moves it in just one plane." },
    { step: "10x glute bridges", why: "Activates the glutes before a hip hinge exercise asks them to do the real work, instead of the lower back compensating." }
  ]
};

export const COOLDOWNS_BY_DAYTYPE = {
  "Full Body": [
    { step: "30s quad stretch each leg", why: "Lengthens a muscle that just did repeated squatting/pressing work, while it's still warm." },
    { step: "30s hamstring stretch each leg", why: "Lengthens a muscle that just did repeated hip-hinge work, while it's still warm." },
    { step: "30s chest doorway stretch", why: "Counters the forward-rounded position pressing work tends to leave the chest/shoulders in." },
    { step: "30s child's pose", why: "Gently decompresses the lower back and stretches the hips after a loaded session." }
  ],
  Upper: [
    { step: "30s chest doorway stretch", why: "Counters the forward-rounded position pressing work tends to leave the chest/shoulders in." },
    { step: "30s overhead triceps stretch each arm", why: "Lengthens the triceps after repeated pressing work." },
    { step: "30s cross-body shoulder stretch each arm", why: "Targets the rear shoulder, which gets loaded isometrically during rows/pulls." },
    { step: "30s child's pose", why: "Gently decompresses the shoulders and upper back after a loaded session." }
  ],
  Lower: [
    { step: "30s quad stretch each leg", why: "Lengthens a muscle that just did repeated squatting work, while it's still warm." },
    { step: "30s hamstring stretch each leg", why: "Lengthens a muscle that just did repeated hip-hinge work, while it's still warm." },
    { step: "30s calf stretch each leg", why: "Calves work isometrically through almost every lower-body lift and tighten up quickly." },
    { step: "30s seated figure-4 glute stretch each side", why: "Targets the glutes/hip rotators, which get heavily loaded in squats and hinges." }
  ],
  Push: [
    { step: "30s chest doorway stretch", why: "Counters the forward-rounded position pressing work tends to leave the chest/shoulders in." },
    { step: "30s overhead triceps stretch each arm", why: "Lengthens the triceps after repeated pressing work." },
    { step: "30s cross-body shoulder stretch each arm", why: "Targets the front/side shoulder after overhead and horizontal pressing." }
  ],
  Pull: [
    { step: "30s lat stretch each side", why: "Lengthens the lats after repeated pulling/rowing work." },
    { step: "30s cross-body shoulder stretch each arm", why: "Targets the rear shoulder, which does a lot of isometric work stabilizing rows and pull-ups." },
    { step: "30s child's pose", why: "Gently decompresses the shoulders and upper back after a loaded session." }
  ],
  Legs: [
    { step: "30s quad stretch each leg", why: "Lengthens a muscle that just did repeated squatting work, while it's still warm." },
    { step: "30s hamstring stretch each leg", why: "Lengthens a muscle that just did repeated hip-hinge work, while it's still warm." },
    { step: "30s calf stretch each leg", why: "Calves work isometrically through almost every lower-body lift and tighten up quickly." },
    { step: "30s seated figure-4 glute stretch each side", why: "Targets the glutes/hip rotators, which get heavily loaded in squats and hinges." }
  ]
};

export const CARDIO_WARMUP = [
  { step: "5 min easy-pace walk or jog to get moving", why: "Raises heart rate and muscle temperature gradually instead of starting at full pace cold." },
  { step: "10x leg swings each leg (front-back, side-side)", why: "Takes the hip through its full range before repetitive, single-plane running/walking." },
  { step: "10x walking lunges", why: "Warms the hips and knees through a longer stride than normal walking/running uses." },
  { step: "3x 20-second gradual pickups to near-race pace", why: "Lets the body adjust to faster turnover before actually holding that pace." }
];
export const CARDIO_COOLDOWN = [
  { step: "5 min easy walk to bring your heart rate down", why: "Lets heart rate and blood pressure come down gradually instead of stopping abruptly." },
  { step: "30s quad stretch each leg", why: "Lengthens a muscle that just did repeated work, while it's still warm." },
  { step: "30s hamstring stretch each leg", why: "Lengthens a muscle that just did repeated work, while it's still warm." },
  { step: "30s calf stretch each leg", why: "Calves absorb a lot of repetitive impact in running/walking and tighten up quickly." }
];

// Not gated behind a gym day — shown every day regardless of whether it's a
// training day, since daily flexibility work is a general-health habit, not
// a gym-performance one. A short, full-body routine (~8-10 min) covering
// the areas most affected by sitting and by lifting.
export const DAILY_STRETCH_ROUTINE = [
  { step: "Neck rolls, 30s each direction", why: "Releases tension from the neck/upper traps, which tightens up from both desk posture and shrugging/pressing work." },
  { step: "Shoulder rolls, 15x each direction", why: "Keeps the shoulder joint moving freely through a range lifting alone doesn't always cover." },
  { step: "Chest doorway stretch, 30s", why: "Counters the forward-rounded posture that comes from sitting and from pressing-heavy training." },
  { step: "Cat-cow, 10x", why: "Moves the spine through flexion and extension, which otherwise gets little daily movement outside of lifting." },
  { step: "Hip flexor stretch (kneeling lunge), 30s each side", why: "Hip flexors shorten from sitting most of the day — tight hip flexors are a common contributor to lower-back tightness." },
  { step: "Hamstring stretch, 30s each leg", why: "Hamstrings tighten from both sitting and from squatting/hinging, and limit hip mobility when short." },
  { step: "Quad stretch, 30s each leg", why: "Balances out the hip flexor/hamstring work above and keeps the front of the hip and knee mobile." },
  { step: "Calf stretch, 30s each leg", why: "Tight calves limit ankle mobility, which shows up as a knees-caving or heels-lifting squat." }
];
