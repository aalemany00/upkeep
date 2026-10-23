import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, limit, onSnapshot, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { assignSplit, targetFor, MUSCLE_LABEL_BY_SLOT } from "./gym.js";
import { computeDailyGoals, GOAL_LABELS } from "./nutrition.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let currentUid = null;
let unsubEntries = null;
let unsubGoals = null;
let unsubCoach = null;
let unsubProfile = null;
let unsubSplit = null;
let unsubWorkouts = null;

let entries = [];      // last 200 log entries (food/water/weight/activity/vitamin), newest first
let goals = {};        // daily goals + vitamin list + goal type + availability
let coachNotes = [];   // generated weekly notes, newest first
let profile = null;    // bio: age/sex/height/starting weight — null until onboarding finishes
let split = null;      // the assigned workout split (gym.assignSplit output)
let workoutLogs = [];  // one doc per logged gym day, newest first
let workoutLogsReady = false; // has the live workoutLogs subscription delivered its first real snapshot yet

let exerciseCatalog = [];
let exerciseById = new Map();
let foodCatalog = [];
let foodById = new Map();
let dietPicks = {}; // { breakfast: id, lunch: id, dinner: id, snack1: id, snack2: id } — per-device, not synced

let calViewDate = new Date();   // month currently shown in the Gym calendar
let selectedDateKey = null;     // date the Gym day-panel is showing
let showingOnboardingReview = false; // gate: stay on onboarding screen to show the just-built plan

async function fetchJsonWithRetry(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
  }
}

let catalogError = null;
const catalogReady = fetchJsonWithRetry("exercises.json")
  .then((list) => {
    exerciseCatalog = list;
    exerciseById = new Map(list.map((e) => [e.id, e]));
    renderGym();
  })
  .catch((err) => {
    console.error("Could not load exercise catalog", err);
    catalogError = err;
    renderGym();
  });

const foodCatalogReady = fetchJsonWithRetry("foods.json")
  .then((list) => {
    foodCatalog = list;
    foodById = new Map(list.map((f) => [f.id, f]));
    renderDietSuggestions();
  })
  .catch((err) => console.error("Could not load food catalog", err));

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todaysEntries() {
  const key = todayKey();
  return entries.filter((e) => e.dateKey === key);
}

function sumByType(list, type, field) {
  return list.filter((e) => e.type === type).reduce((total, e) => total + (Number(e[field]) || 0), 0);
}

function barWidth(value, goal) {
  if (!goal) return 0;
  return Math.max(0, Math.min(100, (value / goal) * 100));
}

function latestWeightLb() {
  const weightEntries = entries.filter((e) => e.type === "weight");
  return weightEntries.length ? weightEntries[0].lb : null;
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");

document.getElementById("auth-signin-btn").addEventListener("click", (e) => {
  e.preventDefault();
  signInWithEmailAndPassword(auth, authEmail.value, authPassword.value).catch(showAuthError);
});

document.getElementById("auth-signup-btn").addEventListener("click", (e) => {
  e.preventDefault();
  createUserWithEmailAndPassword(auth, authEmail.value, authPassword.value).catch(showAuthError);
});

authForm.addEventListener("submit", (e) => e.preventDefault());

document.getElementById("signout-btn").addEventListener("click", () => signOut(auth));

function showAuthError(err) {
  authError.textContent = err.message.replace("Firebase: ", "");
  authError.hidden = false;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUid = user.uid;
    document.getElementById("auth-screen").hidden = true;
    subscribeAll(user.uid);
  } else {
    currentUid = null;
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("onboarding-screen").hidden = true;
    document.getElementById("app").hidden = true;
    teardownSubscriptions();
  }
});

function updateScreenVisibility() {
  const hasProfile = !!profile;
  if (hasProfile && showingOnboardingReview) {
    document.getElementById("onboarding-screen").hidden = false;
    document.getElementById("app").hidden = true;
    return;
  }
  document.getElementById("onboarding-screen").hidden = hasProfile;
  document.getElementById("app").hidden = !hasProfile;
}

// ---------------------------------------------------------------------
// Onboarding (bio + goal + availability) — shown once, before the profile
// doc exists. The split that comes out of this is plain-code math
// (gym.assignSplit), not an AI call — instant, and recomputed the same way
// whenever availability changes later in Goals.
// ---------------------------------------------------------------------
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DEFAULT_DAY_PATTERN = {
  1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6]
};

function renderDayChips(container, selectedDays, onToggle) {
  container.innerHTML = WEEKDAY_LABELS
    .map((label, i) => `<button type="button" class="chip-btn ${selectedDays.includes(i) ? "taken" : ""}" data-day="${i}">${label}</button>`)
    .join("");
  container.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = Number(btn.dataset.day);
      const next = selectedDays.includes(day) ? selectedDays.filter((d) => d !== day) : [...selectedDays, day].sort((a, b) => a - b);
      onToggle(next);
    });
  });
}

async function rebuildSplit(daysPerWeek) {
  if (!currentUid) return;
  await catalogReady;
  if (!exerciseCatalog.length) {
    alert("Couldn't load the exercise catalog, so your split wasn't rebuilt. Reload the page and try again.");
    return;
  }
  const newSplit = assignSplit(daysPerWeek, exerciseCatalog);
  await setDoc(doc(db, "users", currentUid, "split", "current"), newSplit);
  return newSplit;
}

let onboardingDays = DEFAULT_DAY_PATTERN[3];
const onboardingForm = document.getElementById("onboarding-form");
const onboardingDaysEl = document.getElementById("onboarding-days");

function drawOnboardingDays() {
  renderDayChips(onboardingDaysEl, onboardingDays, (next) => { onboardingDays = next; drawOnboardingDays(); });
}
drawOnboardingDays();

onboardingForm.daysPerWeek.addEventListener("input", (e) => {
  const n = Math.min(6, Math.max(1, Number(e.target.value) || 1));
  onboardingDays = DEFAULT_DAY_PATTERN[n];
  drawOnboardingDays();
});

function renderOnboardingReview(newSplit, goalType, dailyGoals) {
  const el = document.getElementById("onboarding-review-content");
  const dayList = newSplit.days
    .map((day) => {
      const names = day.slots
        .map((s) => {
          const muscleLabel = s.muscleLabel || MUSCLE_LABEL_BY_SLOT[s.label] || s.label;
          return `${muscleLabel}: ${exerciseById.get(s.defaultId)?.name || "—"}`;
        })
        .join(", ");
      return `<li><strong>${day.dayType}:</strong> ${names}</li>`;
    })
    .join("");
  el.innerHTML = `
    <p><strong>${newSplit.name}</strong> — ${newSplit.daysPerWeek} day${newSplit.daysPerWeek === 1 ? "" : "s"}/week, goal: ${GOAL_LABELS[goalType] || goalType}</p>
    <ul>${dayList}</ul>
    <p><strong>Daily goals (computed, editable in Goals):</strong></p>
    <ul>
      <li>${dailyGoals.calorieGoal} kcal</li>
      <li>${dailyGoals.proteinGoal}g protein</li>
      <li>${dailyGoals.waterGoal}ml water</li>
      <li>${dailyGoals.stepsGoal} steps</li>
    </ul>
  `;
}

onboardingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid || !onboardingDays.length) return;
  const data = new FormData(onboardingForm);

  const startWeightLb = Number(data.get("startWeightLb"));
  const goalType = data.get("goalType");
  const activityLevel = data.get("activityLevel");
  const onboardingProfile = {
    age: Number(data.get("age")),
    sex: data.get("sex"),
    heightIn: Number(data.get("heightIn")),
    startWeightLb
  };

  await setDoc(doc(db, "users", currentUid, "profile", "me"), {
    ...onboardingProfile,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });

  const dailyGoals = computeDailyGoals(onboardingProfile, goalType, activityLevel, startWeightLb);

  await setDoc(doc(db, "users", currentUid, "meta", "goals"), {
    goalType,
    activityLevel,
    daysPerWeek: onboardingDays.length,
    preferredDays: onboardingDays,
    ...dailyGoals
  }, { merge: true });

  const newSplit = await rebuildSplit(onboardingDays.length);
  await addEntry("weight", { lb: startWeightLb });

  showingOnboardingReview = true;
  onboardingForm.hidden = true;
  document.getElementById("onboarding-review").hidden = false;
  renderOnboardingReview(newSplit, goalType, dailyGoals);
  updateScreenVisibility();
});

document.getElementById("onboarding-continue-btn").addEventListener("click", () => {
  showingOnboardingReview = false;
  updateScreenVisibility();
});

// ---------------------------------------------------------------------
// Firestore subscriptions (live sync across devices)
// ---------------------------------------------------------------------
function subscribeAll(uid) {
  teardownSubscriptions();

  const entriesQuery = query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(200));
  unsubEntries = onSnapshot(entriesQuery, (snap) => {
    entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderTodayEntries();
    renderFoodEntries();
    renderVitaminChips();
  });

  const goalsRef = doc(db, "users", uid, "meta", "goals");
  unsubGoals = onSnapshot(goalsRef, (snap) => {
    goals = snap.exists() ? snap.data() : {};
    fillGoalsForm();
    renderDashboard();
    renderVitaminChips();
  });

  const coachQuery = query(collection(db, "users", uid, "coachNotes"), orderBy("createdAt", "desc"), limit(20));
  unsubCoach = onSnapshot(coachQuery, (snap) => {
    coachNotes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCoachNotes();
    renderCoachReviewBanner();
  });

  const profileRef = doc(db, "users", uid, "profile", "me");
  unsubProfile = onSnapshot(profileRef, (snap) => {
    profile = snap.exists() ? snap.data() : null;
    updateScreenVisibility();
    fillGoalsForm();
    renderCoachReviewBanner();
  });

  const splitRef = doc(db, "users", uid, "split", "current");
  unsubSplit = onSnapshot(splitRef, (snap) => {
    split = snap.exists() ? snap.data() : null;
    renderGym();
  });

  const workoutsQuery = query(collection(db, "users", uid, "workoutLogs"), orderBy("dateKey", "desc"), limit(200));
  unsubWorkouts = onSnapshot(workoutsQuery, (snap) => {
    workoutLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // gymDraft gets built (and cached by dateKey+dayType) from whatever's
    // in `workoutLogs` the moment the Gym tab first renders — which can
    // happen before this listener's first delivery. Force exactly one
    // rebuild once real data arrives, so a previously-saved day (extras
    // included) doesn't get permanently masked by an empty draft built
    // from the pre-load state (confirmed via testing: without this, a
    // saved "extra" exercise silently vanished on reload).
    if (!workoutLogsReady) { workoutLogsReady = true; gymDraft = null; }
    renderGym();
  });
}

function teardownSubscriptions() {
  if (unsubEntries) unsubEntries();
  if (unsubGoals) unsubGoals();
  if (unsubCoach) unsubCoach();
  if (unsubProfile) unsubProfile();
  if (unsubSplit) unsubSplit();
  if (unsubWorkouts) unsubWorkouts();
  entries = [];
  goals = {};
  coachNotes = [];
  profile = null;
  split = null;
  workoutLogs = [];
  workoutLogsReady = false;
  gymDraft = null;

  // Reset UI left over from a previous account in this same browser tab
  // (shared devices, multiple people signing in/out) so nothing stale
  // lingers for the next person who signs in.
  showingOnboardingReview = false;
  document.getElementById("onboarding-form").hidden = false;
  document.getElementById("onboarding-review").hidden = true;
  resetDeleteAccountUi();
  loadDietPicks();
  renderDietSuggestions();
  renderDashboard();
  renderTodayEntries();
  renderFoodEntries();
  renderVitaminChips();
  renderGym();
  fillGoalsForm();
  renderCoachNotes();
  renderCoachReviewBanner();
}

async function addEntry(type, fields) {
  if (!currentUid) return;
  await addDoc(collection(db, "users", currentUid, "entries"), {
    type,
    ...fields,
    dateKey: todayKey(),
    createdAt: Timestamp.now()
  });
}

async function removeEntry(id) {
  if (!currentUid) return;
  await deleteDoc(doc(db, "users", currentUid, "entries", id));
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.querySelectorAll("[data-switch-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.switchView));
});

function switchView(view) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
function renderDashboard() {
  const today = todaysEntries();
  const calories = sumByType(today, "food", "calories");
  const protein = sumByType(today, "food", "protein");
  const water = sumByType(today, "water", "ml");
  const steps = sumByType(today, "activity", "steps");
  const burned = sumByType(today, "activity", "caloriesBurned");

  const latestWeight = latestWeightLb();

  const stats = [
    { label: "Calories", value: `${calories}`, goal: goals.calorieGoal, raw: calories, unit: "kcal" },
    { label: "Protein", value: `${protein}g`, goal: goals.proteinGoal, raw: protein, unit: "g" },
    { label: "Water", value: `${water}ml`, goal: goals.waterGoal, raw: water, unit: "ml" },
    { label: "Steps", value: `${steps}`, goal: goals.stepsGoal, raw: steps, unit: "steps" },
    { label: "Calories burned", value: `${burned}`, goal: null, raw: burned, unit: "kcal" },
    {
      label: "Weight",
      value: latestWeight !== null ? `${latestWeight} lb` : "—",
      goal: goals.weightGoal,
      raw: latestWeight,
      unit: "lb",
      isWeight: true
    }
  ];

  const container = document.getElementById("dashboard-stats");
  container.innerHTML = stats
    .map((s) => {
      const hasGoal = s.goal && s.raw !== null;
      const pct = hasGoal ? barWidth(s.raw, s.goal) : 0;
      const over = hasGoal && s.raw > s.goal;
      return `
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}</div>
          ${hasGoal ? `
            <div class="bar-track"><div class="bar-fill ${over ? "over" : ""}" style="width:${pct}%"></div></div>
            <div class="stat-label">goal: ${s.goal}${s.unit === "kcal" || s.unit === "g" || s.unit === "ml" || s.unit === "lb" ? " " + s.unit : ""}</div>
          ` : ""}
        </div>`;
    })
    .join("");

  renderCoachPreview();
}

async function applyCalorieChange(delta) {
  if (!currentUid) return;
  const current = goals.calorieGoal || 0;
  await setDoc(doc(db, "users", currentUid, "meta", "goals"), { calorieGoal: current + delta }, { merge: true });
}

function wireApplyButtons(container) {
  container.querySelectorAll("[data-apply-calorie]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCalorieChange(Number(btn.dataset.applyCalorie));
      btn.textContent = "Applied";
      btn.disabled = true;
    });
  });
}

function renderCoachPreview() {
  const el = document.getElementById("dashboard-coach-preview");
  if (!coachNotes.length) {
    el.innerHTML = `<p class="subtle">No coach note yet. See <code>scripts/README.md</code> to generate your first weekly note.</p>`;
    return;
  }
  el.innerHTML = coachNoteHtml(coachNotes[0]);
  wireApplyButtons(el);
}

// ---------------------------------------------------------------------
// Log view
// ---------------------------------------------------------------------
document.querySelectorAll(".log-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = form.dataset.type;
    const data = Object.fromEntries(new FormData(form).entries());
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === "") continue;
      fields[key] = isNaN(Number(value)) ? value : Number(value);
    }
    await addEntry(type, fields);
    form.reset();
  });
});

document.querySelectorAll("[data-quick-ml]").forEach((btn) => {
  btn.addEventListener("click", () => addEntry("water", { ml: Number(btn.dataset.quickMl) }));
});

function renderTodayEntries() {
  const list = document.getElementById("today-entries");
  const today = todaysEntries().filter((e) => e.type !== "food");
  if (!today.length) {
    list.innerHTML = `<li class="entry-row subtle">Nothing logged yet today.</li>`;
    return;
  }
  list.innerHTML = today
    .map((e) => `
      <li class="entry-row">
        <span>${describeEntry(e)}</span>
        <button class="remove-btn" data-remove-id="${e.id}" title="Delete">&times;</button>
      </li>`)
    .join("");

  list.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => removeEntry(btn.dataset.removeId));
  });
}

function renderFoodEntries() {
  const list = document.getElementById("food-entries");
  const today = todaysEntries().filter((e) => e.type === "food");
  if (!today.length) {
    list.innerHTML = `<li class="entry-row subtle">Nothing logged yet today.</li>`;
    return;
  }
  list.innerHTML = today
    .map((e) => `
      <li class="entry-row">
        <span>${describeEntry(e)}</span>
        <button class="remove-btn" data-remove-id="${e.id}" title="Delete">&times;</button>
      </li>`)
    .join("");

  list.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => removeEntry(btn.dataset.removeId));
  });
}

// ---------------------------------------------------------------------
// Diet suggestions — a curated, varied food catalog (foods.json), picked
// per slot and shuffleable, logged with one tap. Per-device only (like
// Lift Log's meal builder) — not synced, since it's just "what am I
// thinking of eating," not real data.
// ---------------------------------------------------------------------
const DIET_SLOTS = [
  { key: "breakfast", label: "Breakfast", category: "breakfast" },
  { key: "lunch", label: "Lunch", category: "lunch" },
  { key: "dinner", label: "Dinner", category: "dinner" },
  { key: "snack1", label: "Snack 1", category: "snack" },
  { key: "snack2", label: "Snack 2", category: "snack" }
];

function dietPicksStorageKey() {
  return `upkeep.dietPicks.${currentUid}`;
}

function loadDietPicks() {
  if (!currentUid) { dietPicks = {}; return; }
  try {
    dietPicks = JSON.parse(localStorage.getItem(dietPicksStorageKey())) || {};
  } catch {
    dietPicks = {};
  }
}

function saveDietPicks() {
  if (!currentUid) return;
  try {
    localStorage.setItem(dietPicksStorageKey(), JSON.stringify(dietPicks));
  } catch { /* localStorage unavailable — picks just won't persist across reloads */ }
}

function foodsInCategory(category) {
  return foodCatalog.filter((f) => f.category === category);
}

function pickForSlot(slot, excludeId) {
  const options = foodsInCategory(slot.category);
  if (!options.length) return null;
  const current = dietPicks[slot.key];
  const pool = options.filter((f) => f.id !== (excludeId ?? current)) ;
  const chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)] : options[0];
  return chosen.id;
}

function renderDietSuggestions() {
  const el = document.getElementById("diet-suggestions");
  if (!el) return;
  if (!foodCatalog.length) {
    el.innerHTML = `<p class="subtle">Loading diet suggestions...</p>`;
    return;
  }

  el.innerHTML = DIET_SLOTS.map((slot) => {
    const options = foodsInCategory(slot.category);
    if (!dietPicks[slot.key] || !foodById.get(dietPicks[slot.key])) {
      dietPicks[slot.key] = options[0]?.id;
    }
    const food = foodById.get(dietPicks[slot.key]);
    if (!food) return "";
    const optionsHtml = options
      .map((f) => `<option value="${f.id}" ${f.id === food.id ? "selected" : ""}>${f.name} (${f.calories} kcal, ${f.protein}g)</option>`)
      .join("");

    return `
      <div class="log-form">
        <h3>${slot.label}</h3>
        <select data-diet-slot="${slot.key}">${optionsHtml}</select>
        <p class="subtle small">${food.detail}</p>
        <p class="subtle small"><strong>${food.calories} kcal, ${food.protein}g protein</strong></p>
        <div class="row">
          <button type="button" class="btn ghost small" data-diet-shuffle="${slot.key}">Shuffle</button>
          <button type="button" class="btn primary small" data-diet-log="${slot.key}">Log this</button>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll("[data-diet-slot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      dietPicks[e.target.dataset.dietSlot] = Number(e.target.value);
      saveDietPicks();
      renderDietSuggestions();
    });
  });
  el.querySelectorAll("[data-diet-shuffle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = DIET_SLOTS.find((s) => s.key === btn.dataset.dietShuffle);
      dietPicks[slot.key] = pickForSlot(slot);
      saveDietPicks();
      renderDietSuggestions();
    });
  });
  el.querySelectorAll("[data-diet-log]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const food = foodById.get(dietPicks[btn.dataset.dietLog]);
      if (food) addEntry("food", { name: food.name, calories: food.calories, protein: food.protein });
    });
  });
}

document.getElementById("food-shuffle-all-btn").addEventListener("click", () => {
  DIET_SLOTS.forEach((slot) => { dietPicks[slot.key] = pickForSlot(slot); });
  saveDietPicks();
  renderDietSuggestions();
});

function describeEntry(e) {
  switch (e.type) {
    case "food": return `🍽 ${e.name} — ${e.calories || 0} kcal${e.protein ? `, ${e.protein}g protein` : ""}`;
    case "water": return `💧 ${e.ml}ml water`;
    case "weight": return `⚖ ${e.lb} lb`;
    case "activity": return `🚶 ${e.steps ? `${e.steps} steps` : ""}${e.steps && e.caloriesBurned ? ", " : ""}${e.caloriesBurned ? `${e.caloriesBurned} kcal burned` : ""}`;
    case "vitamin": return `💊 ${e.name}`;
    default: return e.type;
  }
}

function renderVitaminChips() {
  const list = (goals.vitaminsList || []);
  const today = todaysEntries().filter((e) => e.type === "vitamin");

  const dashEl = document.getElementById("dashboard-vitamins");
  const logEl = document.getElementById("vitamin-quick-list");

  if (!list.length) {
    const msg = `<p class="subtle small">No vitamins set up yet — add some in Goals.</p>`;
    dashEl.innerHTML = msg;
    logEl.innerHTML = msg;
    return;
  }

  const chipsHtml = list
    .map((name) => {
      const takenEntry = today.find((e) => e.name === name);
      return `<button class="chip-btn ${takenEntry ? "taken" : ""}" data-vitamin="${name}" data-entry-id="${takenEntry ? takenEntry.id : ""}">${takenEntry ? "✓ " : ""}${name}</button>`;
    })
    .join("");

  dashEl.innerHTML = chipsHtml;
  logEl.innerHTML = chipsHtml;

  [dashEl, logEl].forEach((container) => {
    container.querySelectorAll("[data-vitamin]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.entryId) {
          await removeEntry(btn.dataset.entryId);
        } else {
          await addEntry("vitamin", { name: btn.dataset.vitamin });
        }
      });
    });
  });
}

// ---------------------------------------------------------------------
// Goals view
// ---------------------------------------------------------------------
function renderCoachReviewBanner() {
  const banner = document.getElementById("coach-review-banner");
  if (!banner) return;
  const updatedAt = profile?.updatedAt;
  const latestNoteAt = coachNotes[0]?.createdAt;
  const needsReview = !!updatedAt && (!latestNoteAt || updatedAt.toMillis() > latestNoteAt.toMillis());
  banner.hidden = !needsReview;
}

const goalsForm = document.getElementById("goals-form");
const goalsDaysEl = document.getElementById("goals-days");
let goalsDays = [1, 3, 5];

function drawGoalsDays() {
  renderDayChips(goalsDaysEl, goalsDays, (next) => { goalsDays = next; drawGoalsDays(); });
}

function fillGoalsForm() {
  goalsForm.age.value = profile?.age ?? "";
  goalsForm.sex.value = profile?.sex || "male";
  goalsForm.heightIn.value = profile?.heightIn ?? "";
  goalsForm.startWeightLb.value = profile?.startWeightLb ?? "";

  goalsForm.calorieGoal.value = goals.calorieGoal ?? "";
  goalsForm.proteinGoal.value = goals.proteinGoal ?? "";
  goalsForm.waterGoal.value = goals.waterGoal ?? "";
  goalsForm.stepsGoal.value = goals.stepsGoal ?? "";
  goalsForm.weightGoal.value = goals.weightGoal ?? "";
  goalsForm.vitaminsList.value = (goals.vitaminsList || []).join(", ");
  goalsForm.goalType.value = goals.goalType || "both";
  goalsForm.activityLevel.value = goals.activityLevel || "moderate";
  goalsForm.daysPerWeek.value = goals.daysPerWeek ?? 3;
  goalsDays = goals.preferredDays || DEFAULT_DAY_PATTERN[goals.daysPerWeek || 3];
  drawGoalsDays();
}

goalsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const data = new FormData(goalsForm);
  const vitaminsList = (data.get("vitaminsList") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Snapshot goalsDays now — writing the profile doc below triggers its
  // onSnapshot listener, which calls fillGoalsForm() and would otherwise
  // reset this module-level variable mid-submit (a real race that silently
  // dropped availability changes — confirmed by testing).
  const selectedDays = goalsDays.slice();

  const availabilityChanged = selectedDays.length !== (goals.daysPerWeek || 0)
    || JSON.stringify(selectedDays) !== JSON.stringify(goals.preferredDays || []);
  const goalType = data.get("goalType");
  const activityLevel = data.get("activityLevel");
  const goalTypeChanged = goalType !== goals.goalType;
  const activityLevelChanged = activityLevel !== goals.activityLevel;

  const newProfileFields = {
    age: Number(data.get("age")),
    sex: data.get("sex"),
    heightIn: Number(data.get("heightIn")),
    startWeightLb: Number(data.get("startWeightLb"))
  };
  const bioChanged = ["age", "sex", "heightIn", "startWeightLb"].some(
    (key) => newProfileFields[key] !== (profile?.[key] ?? (key === "sex" ? undefined : NaN))
  );
  const settingsChanged = availabilityChanged || goalTypeChanged || bioChanged || activityLevelChanged;

  await setDoc(doc(db, "users", currentUid, "profile", "me"), {
    ...newProfileFields,
    ...(settingsChanged ? { updatedAt: Timestamp.now() } : {})
  }, { merge: true });

  // Calories/protein/water/steps are coach-computed by default (plain-code
  // formula, see nutrition.js) but stay user-editable: only overwrite a
  // field here if it wasn't manually changed away from what was already
  // stored AND something that feeds the formula actually changed.
  const shouldRecompute = bioChanged || goalTypeChanged || activityLevelChanged;
  const typedGoalValues = {
    calorieGoal: Number(data.get("calorieGoal")) || null,
    proteinGoal: Number(data.get("proteinGoal")) || null,
    waterGoal: Number(data.get("waterGoal")) || null,
    stepsGoal: Number(data.get("stepsGoal")) || null
  };
  let finalGoalValues = typedGoalValues;
  if (shouldRecompute) {
    const weightLb = latestWeightLb() ?? newProfileFields.startWeightLb;
    const computed = computeDailyGoals(newProfileFields, goalType, activityLevel, weightLb);
    finalGoalValues = {};
    for (const key of Object.keys(typedGoalValues)) {
      const untouched = typedGoalValues[key] === (goals[key] ?? null);
      finalGoalValues[key] = untouched ? computed[key] : typedGoalValues[key];
    }
  }

  await setDoc(doc(db, "users", currentUid, "meta", "goals"), {
    ...finalGoalValues,
    weightGoal: Number(data.get("weightGoal")) || null,
    vitaminsList,
    goalType,
    activityLevel,
    daysPerWeek: selectedDays.length,
    preferredDays: selectedDays
  }, { merge: true });

  if (availabilityChanged && selectedDays.length) {
    await rebuildSplit(selectedDays.length);
  }

  const saved = document.getElementById("goals-saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 2000);
});

// ---------------------------------------------------------------------
// Delete account — irreversible: wipes every Firestore doc under this
// user, then the Firebase Auth user itself. Firebase requires a recent
// sign-in to delete an account, so this re-asks for the password rather
// than silently using the existing (possibly old) session.
// ---------------------------------------------------------------------
const deleteStartBtn = document.getElementById("delete-account-start-btn");
const deleteForm = document.getElementById("delete-account-form");
const deleteCancelBtn = document.getElementById("delete-account-cancel-btn");
const deletePasswordInput = document.getElementById("delete-account-password");
const deleteErrorEl = document.getElementById("delete-account-error");
const deleteProgressEl = document.getElementById("delete-account-progress");

function resetDeleteAccountUi() {
  deleteForm.hidden = true;
  deleteStartBtn.hidden = false;
  deleteForm.reset();
  deleteErrorEl.hidden = true;
  deleteProgressEl.hidden = true;
  deleteForm.querySelector("button[type=submit]").disabled = false;
}

deleteStartBtn.addEventListener("click", () => {
  deleteStartBtn.hidden = true;
  deleteForm.hidden = false;
  deletePasswordInput.focus();
});

deleteCancelBtn.addEventListener("click", resetDeleteAccountUi);

async function deleteAllDocs(colRef) {
  const snap = await getDocs(colRef);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

deleteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid || !auth.currentUser) return;

  deleteErrorEl.hidden = true;
  deleteProgressEl.hidden = false;
  const submitBtn = deleteForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePasswordInput.value);
    await reauthenticateWithCredential(auth.currentUser, credential);

    const uid = currentUid;
    await deleteAllDocs(collection(db, "users", uid, "entries"));
    await deleteAllDocs(collection(db, "users", uid, "workoutLogs"));
    await deleteAllDocs(collection(db, "users", uid, "coachNotes"));
    await deleteDoc(doc(db, "users", uid, "meta", "goals"));
    await deleteDoc(doc(db, "users", uid, "profile", "me"));
    await deleteDoc(doc(db, "users", uid, "split", "current"));

    await deleteUser(auth.currentUser);
    // onAuthStateChanged fires with null from here, which returns to the
    // sign-in screen and resets this form via teardownSubscriptions.
  } catch (err) {
    deleteErrorEl.textContent = err.message.replace("Firebase: ", "");
    deleteErrorEl.hidden = false;
    deleteProgressEl.hidden = true;
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------
// Gym view: split summary, calendar, day panel with progression targets
// ---------------------------------------------------------------------
function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekdayOf(dateKey) {
  return dateFromKey(dateKey).getDay();
}

function distinctDayTypes() {
  if (!split) return [];
  return [...new Set(split.days.map((d) => d.dayType))];
}

function slotsForDayType(dayType) {
  const day = split?.days.find((d) => d.dayType === dayType);
  return day ? day.slots : [];
}

function logForDate(dateKey) {
  return workoutLogs.find((w) => w.dateKey === dateKey) || null;
}

// All past sets logged for one exercise, oldest to newest, excluding the
// date currently being edited (so "today" never informs its own target).
function historyForExercise(exerciseId, excludeDateKey) {
  return workoutLogs
    .filter((w) => w.dateKey !== excludeDateKey && w.dateKey < excludeDateKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .flatMap((w) => w.entries.filter((e) => e.exerciseId === exerciseId).map((e) => ({ sets: e.sets })));
}

// Which split day (if any) this date's weekday is scheduled for.
function scheduledDayTypeFor(dateKey) {
  const preferredDays = goals.preferredDays;
  if (!split || !preferredDays || !preferredDays.length) return null;
  const idx = preferredDays.indexOf(weekdayOf(dateKey));
  if (idx === -1) return null;
  return split.days[idx] || null;
}

let gymDraft = null; // { dateKey, dayType, picks: [exerciseId...], sets: [[{w,r}...]...], extra: [{exerciseId, sets}] }

// Template-slot entries are matched by slotLabel (not array position) so a
// day that skipped a slot, or has extras mixed in, doesn't misalign.
function buildGymDraft(dateKey, dayType) {
  const slots = slotsForDayType(dayType);
  const existing = logForDate(dateKey);
  const existingBySlotLabel = new Map((existing?.entries || []).filter((e) => !e.extra).map((e) => [e.slotLabel, e]));

  const picks = slots.map((slot) => existingBySlotLabel.get(slot.label)?.exerciseId ?? slot.defaultId);
  const sets = slots.map((slot, i) => {
    const exId = picks[i];
    const existingSets = existingBySlotLabel.get(slot.label)?.sets;
    if (existingSets && existingSets.length) {
      return existingSets.map((s) => ({ w: String(s.w ?? ""), r: String(s.r ?? "") }));
    }
    const exMeta = exerciseById.get(exId);
    const tgt = exMeta ? targetFor(historyForExercise(exId, dateKey), exMeta) : null;
    const n = exMeta?.sets || 3;
    return Array.from({ length: n }, () => ({ w: tgt?.weight != null ? String(tgt.weight) : "", r: "" }));
  });

  const extra = (existing?.entries || [])
    .filter((e) => e.extra)
    .map((e) => ({
      exerciseId: e.exerciseId,
      sets: (e.sets || []).map((s) => ({ w: String(s.w ?? ""), r: String(s.r ?? "") }))
    }));

  return { dateKey, dayType, picks, sets, extra };
}

function exerciseSlotCardHtml(ex, tgt, sets, rowAttrs) {
  const rows = sets
    .map((row, j) => `
      <span class="n">${j + 1}</span>
      <input type="number" inputmode="decimal" step="any" min="0" placeholder="lb" value="${row.w}" ${rowAttrs(j, "w")} />
      <input type="number" inputmode="numeric" min="0" placeholder="${tgt.aim?.[j] ?? `${ex.lo}-${ex.hi}`}" value="${row.r}" ${rowAttrs(j, "r")} />
    `)
    .join("");
  return `
    ${ex.image ? `<img src="${ex.image}" alt="${ex.name} form example" loading="lazy" />` : ""}
    <p class="gym-cue">${ex.cue}</p>
    <div class="target-line ${tgt.status}">${tgt.note}</div>
    <div class="sets-grid">
      <span class="hd">Set</span><span class="hd">Weight (lb)</span><span class="hd">Reps</span>
      ${rows}
    </div>`;
}

function renderGymSplitSummary() {
  const el = document.getElementById("gym-split-summary");
  if (!split) {
    el.innerHTML = `<p class="subtle">Finish onboarding (or set your availability in Goals) to get a split.</p>`;
    return;
  }
  el.innerHTML = `<h2>${split.name}</h2><p class="subtle small">${split.daysPerWeek} day${split.daysPerWeek === 1 ? "" : "s"}/week. Change this anytime in Goals.</p>`;
}

function renderGymCalendar() {
  const weekdaysEl = document.getElementById("cal-weekdays");
  const daysEl = document.getElementById("cal-days");
  const label = document.getElementById("cal-month-label");

  weekdaysEl.innerHTML = WEEKDAY_LABELS.map((l) => `<div class="cal-weekday">${l}</div>`).join("");
  label.textContent = calViewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  let html = "";
  for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const scheduled = scheduledDayTypeFor(dateKey);
    const logged = !!logForDate(dateKey);
    const classes = ["cal-day"];
    if (scheduled) classes.push("scheduled");
    if (logged) classes.push("logged");
    if (dateKey === today) classes.push("today");
    if (dateKey === selectedDateKey) classes.push("selected");
    html += `<button type="button" class="${classes.join(" ")}" data-date="${dateKey}">${day}${scheduled || logged ? '<span class="cal-dot"></span>' : ""}</button>`;
  }
  daysEl.innerHTML = html;

  daysEl.querySelectorAll("[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDateKey = btn.dataset.date;
      renderGym();
    });
  });
}

function renderGymDayPanel() {
  const el = document.getElementById("gym-day-panel");
  if (catalogError) {
    el.innerHTML = `<p class="error">Couldn't load the exercise catalog. <button type="button" class="link-btn" id="retry-catalog">Retry</button></p>`;
    document.getElementById("retry-catalog").addEventListener("click", () => location.reload());
    return;
  }
  if (!exerciseCatalog.length) {
    el.innerHTML = `<p class="subtle">Loading exercise catalog...</p>`;
    return;
  }
  if (!split) {
    el.innerHTML = "";
    return;
  }
  if (!selectedDateKey) selectedDateKey = todayKey();

  const scheduled = scheduledDayTypeFor(selectedDateKey);
  const existing = logForDate(selectedDateKey);
  const dayType = existing?.dayType || scheduled?.dayType || distinctDayTypes()[0];

  if (!gymDraft || gymDraft.dateKey !== selectedDateKey || gymDraft.dayType !== dayType) {
    gymDraft = buildGymDraft(selectedDateKey, dayType);
  }

  const dateLabel = dateFromKey(selectedDateKey).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const typeOptions = distinctDayTypes().map((t) => `<option value="${t}" ${t === dayType ? "selected" : ""}>${t}</option>`).join("");

  const slots = slotsForDayType(dayType);
  const slotsHtml = slots
    .map((slot, i) => {
      const exId = gymDraft.picks[i];
      const ex = exerciseById.get(exId);
      if (!ex) return "";
      const tgt = targetFor(historyForExercise(exId, selectedDateKey), ex);
      const options = slot.options
        .map((id) => `<option value="${id}" ${id === exId ? "selected" : ""}>${exerciseById.get(id)?.name || id}</option>`)
        .join("");
      const rows = gymDraft.sets[i]
        .map((row, j) => `
          <span class="n">${j + 1}</span>
          <input type="number" inputmode="decimal" step="any" min="0" placeholder="lb" value="${row.w}" data-slot="${i}" data-set="${j}" data-field="w" />
          <input type="number" inputmode="numeric" min="0" placeholder="${tgt.aim?.[j] ?? `${ex.lo}-${ex.hi}`}" value="${row.r}" data-slot="${i}" data-set="${j}" data-field="r" />
        `)
        .join("");

      const muscleLabel = slot.muscleLabel || MUSCLE_LABEL_BY_SLOT[slot.label] || "";
      return `
        <div class="gym-slot">
          <div class="gym-slot-head">
            <div>
              <strong>${muscleLabel || slot.label}</strong>
              ${muscleLabel ? `<span class="subtle small" style="display:block;">${slot.label}</span>` : ""}
            </div>
            <span class="subtle small">${ex.sets} x ${ex.lo}-${ex.hi}</span>
          </div>
          <select data-slot-select="${i}">${options}</select>
          ${ex.image ? `<img src="${ex.image}" alt="${ex.name} form example" loading="lazy" />` : ""}
          <p class="gym-cue">${ex.cue}</p>
          <div class="target-line ${tgt.status}">${tgt.note}</div>
          <div class="sets-grid">
            <span class="hd">Set</span><span class="hd">Weight (lb)</span><span class="hd">Reps</span>
            ${rows}
          </div>
          <button type="button" class="btn ghost small" data-add-set="${i}">+ set</button>
        </div>`;
    })
    .join("");

  const extraHtml = gymDraft.extra
    .map((item, i) => {
      const ex = exerciseById.get(item.exerciseId);
      if (!ex) return "";
      const tgt = targetFor(historyForExercise(item.exerciseId, selectedDateKey), ex);
      return `
        <div class="gym-slot">
          <div class="gym-slot-head">
            <strong>${ex.name}</strong>
            <button type="button" class="remove-btn" data-remove-extra="${i}" title="Remove">&times;</button>
          </div>
          ${exerciseSlotCardHtml(ex, tgt, item.sets, (j, field) => `data-extra="${i}" data-set="${j}" data-field="${field}"`)}
          <button type="button" class="btn ghost small" data-add-extra-set="${i}">+ set</button>
        </div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h2 style="margin:0;">${dateLabel}</h2>
      <select id="gym-daytype-select">${typeOptions}</select>
    </div>
    ${slotsHtml}

    <div class="panel" style="padding:0;background:transparent;border:none;margin:0;">
      <h3>Add any other exercise</h3>
      <p class="subtle small">Not limited to today's suggestions — search the full catalog (${exerciseCatalog.length} exercises) and log anything.</p>
      <input type="text" id="gym-exercise-search" placeholder="Search exercises (e.g. lat pulldown, hip thrust)..." autocomplete="off" />
      <div id="gym-exercise-search-results"></div>
    </div>
    ${extraHtml}

    <button type="button" class="btn primary" id="gym-save-day">Save day</button>
    <p id="gym-saved" class="subtle small" hidden>Saved.</p>
  `;

  document.getElementById("gym-daytype-select").addEventListener("change", (e) => {
    gymDraft = buildGymDraft(selectedDateKey, e.target.value);
    renderGymDayPanel();
  });

  el.querySelectorAll("[data-slot-select]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const i = Number(e.target.dataset.slotSelect);
      gymDraft.picks[i] = Number(e.target.value);
      const ex = exerciseById.get(gymDraft.picks[i]);
      const tgt = targetFor(historyForExercise(gymDraft.picks[i], selectedDateKey), ex);
      gymDraft.sets[i] = Array.from({ length: ex.sets }, () => ({ w: tgt.weight != null ? String(tgt.weight) : "", r: "" }));
      renderGymDayPanel();
    });
  });

  el.querySelectorAll("[data-add-set]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.addSet);
      gymDraft.sets[i].push({ w: "", r: "" });
      renderGymDayPanel();
    });
  });

  el.querySelectorAll("[data-slot][data-set][data-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { slot: i, set: j, field } = e.target.dataset;
      gymDraft.sets[i][j][field] = e.target.value;
    });
  });

  // Extra (free-form) exercises: search the full catalog and log anything,
  // not just today's suggested slots.
  const searchInput = document.getElementById("gym-exercise-search");
  const searchResultsEl = document.getElementById("gym-exercise-search-results");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) { searchResultsEl.innerHTML = ""; return; }
    const matches = exerciseCatalog.filter((ex) => ex.name.toLowerCase().includes(q)).slice(0, 8);
    searchResultsEl.innerHTML = matches.length
      ? `<ul class="entry-list">${matches.map((ex) => `<li class="entry-row"><span>${ex.name} <span class="subtle small">(${ex.category})</span></span><button type="button" class="btn small" data-add-exercise="${ex.id}">Add</button></li>`).join("")}</ul>`
      : `<p class="subtle small">No matches.</p>`;

    searchResultsEl.querySelectorAll("[data-add-exercise]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const exId = Number(btn.dataset.addExercise);
        const ex = exerciseById.get(exId);
        const tgt = targetFor(historyForExercise(exId, selectedDateKey), ex);
        gymDraft.extra.push({
          exerciseId: exId,
          sets: Array.from({ length: ex.sets }, () => ({ w: tgt.weight != null ? String(tgt.weight) : "", r: "" }))
        });
        searchInput.value = "";
        renderGymDayPanel();
      });
    });
  });

  el.querySelectorAll("[data-remove-extra]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gymDraft.extra.splice(Number(btn.dataset.removeExtra), 1);
      renderGymDayPanel();
    });
  });

  el.querySelectorAll("[data-add-extra-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.addExtraSet);
      gymDraft.extra[i].sets.push({ w: "", r: "" });
      renderGymDayPanel();
    });
  });

  el.querySelectorAll("[data-extra][data-set][data-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { extra: i, set: j, field } = e.target.dataset;
      gymDraft.extra[i].sets[j][field] = e.target.value;
    });
  });

  document.getElementById("gym-save-day").addEventListener("click", saveGymDay);
}

async function saveGymDay() {
  if (!currentUid || !gymDraft) return;
  const slots = slotsForDayType(gymDraft.dayType);
  const slotEntries = slots
    .map((slot, i) => {
      const exId = gymDraft.picks[i];
      const ex = exerciseById.get(exId);
      const sets = gymDraft.sets[i]
        .map((s) => ({ w: Number(s.w) || 0, r: Number(s.r) || 0 }))
        .filter((s) => s.r > 0);
      return sets.length ? { slotLabel: slot.label, exerciseId: exId, exerciseName: ex?.name || "", sets } : null;
    })
    .filter(Boolean);

  const extraEntries = gymDraft.extra
    .map((item) => {
      const ex = exerciseById.get(item.exerciseId);
      const sets = item.sets
        .map((s) => ({ w: Number(s.w) || 0, r: Number(s.r) || 0 }))
        .filter((s) => s.r > 0);
      return sets.length ? { extra: true, exerciseId: item.exerciseId, exerciseName: ex?.name || "", sets } : null;
    })
    .filter(Boolean);

  const entries = [...slotEntries, ...extraEntries];

  if (!entries.length) {
    alert("Log at least one set before saving.");
    return;
  }

  await setDoc(doc(db, "users", currentUid, "workoutLogs", gymDraft.dateKey), {
    dateKey: gymDraft.dateKey,
    dayType: gymDraft.dayType,
    entries,
    updatedAt: Timestamp.now()
  });

  const saved = document.getElementById("gym-saved");
  if (saved) {
    saved.hidden = false;
    setTimeout(() => (saved.hidden = true), 2000);
  }
}

document.getElementById("cal-prev").addEventListener("click", () => {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
  renderGymCalendar();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
  renderGymCalendar();
});

function renderGym() {
  if (!document.getElementById("view-gym")) return;
  renderGymSplitSummary();
  renderGymCalendar();
  renderGymDayPanel();
}

// ---------------------------------------------------------------------
// Coach view
// ---------------------------------------------------------------------
function coachNoteHtml(note) {
  const range = note.weekStart && note.weekEnd ? `${note.weekStart} – ${note.weekEnd}` : "";
  const list = (items) => (items && items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");
  const change = note.calorieGoalChange;
  return `
    <div class="coach-note-meta">${range}</div>
    <p>${note.summary || ""}</p>
    ${note.wins?.length ? `<h4>Wins</h4>${list(note.wins)}` : ""}
    ${note.concerns?.length ? `<h4>Worth watching</h4>${list(note.concerns)}` : ""}
    ${note.flags?.length ? `<h4>Flagged</h4>${list(note.flags)}` : ""}
    ${note.suggestions?.length ? `<h4>Try this week</h4>${list(note.suggestions)}` : ""}
    ${change ? `
      <p class="subtle small">Suggests ${change > 0 ? "adding" : "cutting"} ${Math.abs(change)} kcal/day.
        <button class="link-btn" data-apply-calorie="${change}">Apply</button>
      </p>` : ""}
    <p class="subtle small" style="margin-top:10px;">Not medical or nutrition advice — a rule-of-thumb estimate from your own logged data. Check with a doctor or dietitian for anything health-related.</p>
  `;
}

function renderCoachNotes() {
  const el = document.getElementById("coach-notes-list");
  if (!coachNotes.length) {
    el.innerHTML = `<p class="subtle">No notes yet.</p>`;
    return;
  }
  el.innerHTML = coachNotes
    .map((n) => `<div class="coach-note" style="margin-bottom:20px;border-top:1px solid var(--panel-border);padding-top:12px;">${coachNoteHtml(n)}</div>`)
    .join("");
  wireApplyButtons(el);
  renderCoachPreview();
}
