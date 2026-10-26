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
import { assignSplit, targetFor, MUSCLE_LABEL_BY_SLOT, SPLIT_ALGO_VERSION, EQUIPMENT_OPTIONS, searchExercises } from "./gym.js";
import { computeDailyGoals, GOAL_LABELS } from "./nutrition.js";
import { parseICS, normalizeFeedUrl, occursOnDate, isEventExpired, generateRecurrenceDates, DEFAULT_EVENT_COLOR, DEFAULT_FEED_COLOR, GYM_EVENT_COLOR } from "./calendar.js";
import { USDA_API_KEY } from "./usda-config.js";
import { WARMUPS_BY_DAYTYPE, COOLDOWNS_BY_DAYTYPE, CARDIO_WARMUP, CARDIO_COOLDOWN } from "./warmups.js";
import { COACH_AVATARS, pixelAvatarSvg, coachAvatarById } from "./coach-avatars.js";
import { icon, progressRingSvg, mountainIllustrationSvg } from "./icons.js";

// Fills every static [data-icon] placeholder (sidebar nav, settings rows,
// panel headers, etc.) with its SVG — run once at startup for markup
// that's already in index.html. Dynamically-rendered HTML (meals, habits,
// coach notes, ...) calls icon() directly in its own template string
// instead of relying on this pass.
function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, { size: Number(el.dataset.iconSize) || 20 });
  });
}
applyIcons();
document.getElementById("sidebar-illustration")?.insertAdjacentHTML("beforeend", mountainIllustrationSvg(140, 56));

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
let unsubCalEvents = null;
let unsubCalFeeds = null;
let unsubCategories = null;

let entries = [];      // last 200 log entries (food/water/weight/activity/vitamin), newest first
let goals = {};        // daily goals + vitamin list + goal type + availability
let coachNotes = [];   // generated weekly notes, newest first
let profile = null;    // bio: age/sex/height/starting weight — null until onboarding finishes
let split = null;      // the assigned workout split (gym.assignSplit output)
let workoutLogs = [];  // one doc per logged gym day, newest first
let calendarEvents = []; // everything-calendar events, manual + imported-from-feed
let calendarFeeds = [];  // imported calendar subscriptions (label, url, color)

// All targetFor() calls route through this so "smallest weight jump
// available" (Goals) is applied consistently everywhere a progression
// target is computed, not just in one place.
function targetForUser(history, exerciseMeta) {
  return targetFor(history, exerciseMeta, goals.minIncrementLb || 0);
}
let workoutLogsReady = false; // has the live workoutLogs subscription delivered its first real snapshot yet

let exerciseCatalog = [];
let exerciseById = new Map();
let foodCatalog = [];
let foodById = new Map();
let dietPicks = {}; // { breakfast: id, lunch: id, dinner: id, snack1: id, snack2: id } — per-device, not synced

// One shared calendar/selected-date pair for both the Dashboard's
// everything-calendar and the Gym tab's day panel — the Gym tab no longer
// has its own calendar grid, it just follows whatever day is selected here.
let calViewDate = new Date();   // month currently shown on the Dashboard
let selectedDateKey = null;     // date both the Dashboard and Gym day panels show
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

// Food/Log/Cardio entries are logged against whatever date is currently
// selected (shared with the Dashboard/Gym calendar — see selectedDateKey),
// not always literally today, so you can back-log a day you forgot. The
// Dashboard's own stat tiles stay on todaysEntries() above — those always
// mean "today," regardless of what date you're backdating elsewhere.
function entriesForSelectedDate() {
  const key = selectedDateKey || todayKey();
  return entries.filter((e) => e.dateKey === key);
}

function selectedDateLabel() {
  const key = selectedDateKey || todayKey();
  return key === todayKey() ? "Today" : dateFromKey(key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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

// Weight is intentionally "sticky" (it shows your last recorded weight
// indefinitely, not reset to empty every day like calories/water/steps —
// nobody weighs in daily). Without a date label that reads as a bug
// ("it's stuck on 157"), so the Dashboard shows when it was actually logged.
function latestWeightDateKey() {
  const weightEntries = entries.filter((e) => e.type === "weight");
  return weightEntries.length ? weightEntries[0].dateKey : null;
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
document.getElementById("signout-btn-mobile")?.addEventListener("click", () => signOut(auth));

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

// Equipment multi-select, same toggle-chip pattern as the weekday picker.
function renderEquipmentChips(container, selectedEquipment, onToggle) {
  container.innerHTML = EQUIPMENT_OPTIONS
    .map((eq) => `<button type="button" class="chip-btn ${selectedEquipment.includes(eq) ? "taken" : ""}" data-eq="${eq}">${eq}</button>`)
    .join("");
  container.querySelectorAll("[data-eq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const eq = btn.dataset.eq;
      const next = selectedEquipment.includes(eq) ? selectedEquipment.filter((e) => e !== eq) : [...selectedEquipment, eq];
      onToggle(next);
    });
  });
}

// Maps each scheduled weekday (goals.preferredDays, in split-day order) to
// its own equipment list — equipmentByDay[weekday] if that day's been
// customized, else the global default — so assignSplit can suggest
// differently per day (home dumbbells Monday, full gym Wednesday, etc).
function equipmentForScheduledDays(preferredDays, defaultEquipment, equipmentByDay) {
  return preferredDays.map((weekday) => equipmentByDay?.[weekday] || defaultEquipment);
}

async function rebuildSplit(daysPerWeek, equipmentList) {
  if (!currentUid) return;
  await catalogReady;
  if (!exerciseCatalog.length) {
    alert("Couldn't load the exercise catalog, so your split wasn't rebuilt. Reload the page and try again.");
    return;
  }
  const newSplit = assignSplit(daysPerWeek, exerciseCatalog, equipmentList);
  await setDoc(doc(db, "users", currentUid, "split", "current"), newSplit);
  return newSplit;
}

// A split built under an older slot-assignment algorithm (e.g. before a bug
// fix to which exercises get suggested) otherwise never refreshes until the
// user happens to change availability or equipment — silently rebuild it
// instead, same daysPerWeek/equipment, no AI call, logged history untouched.
// Called from both the split and goals listeners (whichever's snapshot
// arrives last has both pieces of data loaded) so the rebuild uses real
// equipment prefs instead of running once, before goals has loaded, with no
// restriction.
let staleSplitRebuildInFlight = false;
function maybeRebuildStaleSplit() {
  if (!split || split.algoVersion === SPLIT_ALGO_VERSION || staleSplitRebuildInFlight) return;
  staleSplitRebuildInFlight = true;
  const perDay = equipmentForScheduledDays(goals.preferredDays || [], goals.equipment, goals.equipmentByDay);
  rebuildSplit(split.daysPerWeek, perDay).finally(() => {
    staleSplitRebuildInFlight = false;
  });
}

// ---------------------------------------------------------------------
// Coach avatars — shared between onboarding, Settings, and the small badge
// shown next to coach notes. Picking one is cosmetic only (see
// coach-avatars.js); it never changes what the coach says.
// ---------------------------------------------------------------------
function renderAvatarPicker(container, selectedId, onPick) {
  if (!container) return;
  container.innerHTML = COACH_AVATARS.map((a) => `
    <button type="button" class="avatar-option${a.id === selectedId ? " selected" : ""}" data-avatar-id="${a.id}" title="${a.tagline}" aria-pressed="${a.id === selectedId}">
      <span class="avatar-thumb">${pixelAvatarSvg(a.grid, a.palette, 64)}</span>
      <span class="avatar-name">${a.name}</span>
    </button>
  `).join("");
  container.querySelectorAll("[data-avatar-id]").forEach((btn) => {
    btn.addEventListener("click", () => onPick(btn.dataset.avatarId));
  });
}

function renderCoachAvatarBadges() {
  const avatar = coachAvatarById(goals.coachAvatar);
  const svg = pixelAvatarSvg(avatar.grid, avatar.palette, 28);
  const dashBadge = document.getElementById("dashboard-coach-avatar");
  const coachBadge = document.getElementById("coach-view-avatar");
  const sidebarAvatar = document.getElementById("sidebar-avatar");
  if (dashBadge) dashBadge.innerHTML = svg;
  if (coachBadge) coachBadge.innerHTML = svg;
  if (sidebarAvatar) sidebarAvatar.innerHTML = pixelAvatarSvg(avatar.grid, avatar.palette, 56);
}

let onboardingCoachAvatar = "sage";
const onboardingAvatarPickerEl = document.getElementById("onboarding-avatar-picker");
function drawOnboardingAvatarPicker() {
  renderAvatarPicker(onboardingAvatarPickerEl, onboardingCoachAvatar, (id) => {
    onboardingCoachAvatar = id;
    drawOnboardingAvatarPicker();
  });
}
drawOnboardingAvatarPicker();

const settingsAvatarPickerEl = document.getElementById("settings-avatar-picker");
function drawSettingsAvatarPicker() {
  renderAvatarPicker(settingsAvatarPickerEl, goals.coachAvatar || "sage", async (id) => {
    if (!currentUid) return;
    await setDoc(doc(db, "users", currentUid, "meta", "goals"), { coachAvatar: id }, { merge: true });
  });
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
    coachAvatar: onboardingCoachAvatar,
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
    renderGymCardioEntries();
  });

  const goalsRef = doc(db, "users", uid, "meta", "goals");
  unsubGoals = onSnapshot(goalsRef, (snap) => {
    goals = snap.exists() ? snap.data() : {};
    fillGoalsForm();
    renderDashboard();
    renderVitaminChips();
    maybeRebuildStaleSplit();
    drawSettingsAvatarPicker();
    renderCoachAvatarBadges();
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
    renderDashCalendar(); // the dashboard calendar overlays scheduled gym days too
    maybeRebuildStaleSplit();
    renderWorkoutPlanPanel();
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
    renderDashCalendar();
    renderDashDayPanel();
    renderWorkoutPlanPanel();
  });

  const eventsQuery = query(collection(db, "users", uid, "calendarEvents"), orderBy("dateKey", "desc"), limit(500));
  unsubCalEvents = onSnapshot(eventsQuery, (snap) => {
    calendarEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderDashCalendar();
    renderDashDayPanel();
    renderGymCardioEntries();
  });

  const feedsQuery = query(collection(db, "users", uid, "calendarFeeds"), orderBy("createdAt", "asc"));
  unsubCalFeeds = onSnapshot(feedsQuery, (snap) => {
    calendarFeeds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCalendarFeeds();
  });

  const categoriesRef = doc(db, "users", uid, "meta", "categories");
  unsubCategories = onSnapshot(categoriesRef, (snap) => {
    customCategories = snap.exists() ? snap.data() : {};
  });
}

function teardownSubscriptions() {
  if (unsubEntries) unsubEntries();
  if (unsubGoals) unsubGoals();
  if (unsubCoach) unsubCoach();
  if (unsubProfile) unsubProfile();
  if (unsubSplit) unsubSplit();
  if (unsubWorkouts) unsubWorkouts();
  if (unsubCalEvents) unsubCalEvents();
  if (unsubCalFeeds) unsubCalFeeds();
  if (unsubCategories) unsubCategories();
  entries = [];
  goals = {};
  coachNotes = [];
  profile = null;
  split = null;
  workoutLogs = [];
  workoutLogsReady = false;
  gymDraft = null;
  calendarEvents = [];
  calendarFeeds = [];
  customCategories = {};

  // Reset UI left over from a previous account in this same browser tab
  // (shared devices, multiple people signing in/out) so nothing stale
  // lingers for the next person who signs in.
  showingOnboardingReview = false;
  document.getElementById("onboarding-form").hidden = false;
  document.getElementById("onboarding-review").hidden = true;
  onboardingCoachAvatar = "sage";
  drawOnboardingAvatarPicker();
  drawSettingsAvatarPicker();
  renderCoachAvatarBadges();
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
  renderDashCalendar();
  renderCalendarFeeds();
  syncLogDatePickers();
}

async function addEntry(type, fields, dateKeyOverride) {
  if (!currentUid) return;
  await addDoc(collection(db, "users", currentUid, "entries"), {
    type,
    ...fields,
    dateKey: dateKeyOverride || selectedDateKey || todayKey(),
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
// Nav items exist twice (desktop sidebar + mobile bottom nav/more sheet),
// both tagged with the same data-view — switching one keeps both in sync.
document.querySelectorAll(".tab[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.querySelectorAll(".more-sheet-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
    closeMoreSheet();
  });
});

document.querySelectorAll("[data-switch-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.switchView));
});

function switchView(view) {
  document.querySelectorAll(".tab[data-view]").forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
}
switchView("dashboard"); // sets aria-current for the view that's already active in the static HTML

const moreSheet = document.getElementById("more-sheet");
const bottomMoreBtn = document.getElementById("bottom-more-btn");
function openMoreSheet() {
  if (!moreSheet) return;
  moreSheet.hidden = false;
  bottomMoreBtn?.setAttribute("aria-expanded", "true");
  moreSheet.querySelector(".more-sheet-item")?.focus();
}
function closeMoreSheet() {
  if (!moreSheet || moreSheet.hidden) return;
  moreSheet.hidden = true;
  bottomMoreBtn?.setAttribute("aria-expanded", "false");
  bottomMoreBtn?.focus();
}
bottomMoreBtn?.addEventListener("click", openMoreSheet);
document.getElementById("more-sheet-close")?.addEventListener("click", closeMoreSheet);
moreSheet?.addEventListener("click", (e) => {
  if (e.target === moreSheet) closeMoreSheet();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && moreSheet && !moreSheet.hidden) closeMoreSheet();
});

// Theme toggle — mirrors the flash-prevention script in index.html's <head>.
// Lives as an "Appearance" row inside Settings (matching the mockup's
// settings-page list), not a standalone sidebar icon.
function currentTheme() {
  const saved = localStorage.getItem("upkeep-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("upkeep-theme", theme);
  } catch (e) {}
  const subtitle = document.getElementById("theme-toggle-subtitle");
  const iconEl = document.getElementById("theme-toggle-icon");
  if (subtitle) subtitle.textContent = theme === "dark" ? "Dark mode" : "Light mode";
  if (iconEl) iconEl.innerHTML = icon(theme === "dark" ? "moon" : "sun", { size: 18 });
}
function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}
document.getElementById("theme-toggle-btn")?.addEventListener("click", toggleTheme);
setTheme(currentTheme()); // sync the Settings row's label/icon with whatever the head script already applied
document.querySelectorAll("[data-settings-subview]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.settingsSubview;
    document.querySelectorAll("[data-settings-subview]").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".settings-subview").forEach((v) => {
      v.classList.toggle("active", v.id === `settings-subview-${target}`);
      v.hidden = v.id !== `settings-subview-${target}`;
    });
  });
});

// Food/Log's "Logging for" date pickers — a shared selectedDateKey (also
// used by the Dashboard/Gym calendar), so picking a past date here and
// logging something actually backdates it, instead of every entry always
// landing on today. Changing either picker, or the Dashboard calendar, or
// the Gym tab's stepper, moves all of them together.
function syncLogDatePickers() {
  const key = selectedDateKey || todayKey();
  const foodInput = document.getElementById("food-log-date");
  const logInput = document.getElementById("log-log-date");
  if (foodInput) foodInput.value = key;
  if (logInput) logInput.value = key;
}

function setSelectedDate(dateKey) {
  selectedDateKey = dateKey;
  syncLogDatePickers();
  renderDashCalendar();
  renderDashDayPanel();
  renderGym();
  renderTodayEntries();
  renderFoodEntries();
  renderDietSuggestions();
}

document.getElementById("food-log-date")?.addEventListener("change", (e) => setSelectedDate(e.target.value));
document.getElementById("food-log-date-today")?.addEventListener("click", () => setSelectedDate(todayKey()));
document.getElementById("log-log-date")?.addEventListener("change", (e) => setSelectedDate(e.target.value));
document.getElementById("log-log-date-today")?.addEventListener("click", () => setSelectedDate(todayKey()));

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderDashboardHeader() {
  const greetingText = document.getElementById("dash-greeting-text");
  const greetingIcon = document.getElementById("dash-greeting-icon");
  const dateText = document.getElementById("dash-date-text");
  const hour = new Date().getHours();
  if (greetingText) greetingText.textContent = timeOfDayGreeting();
  if (greetingIcon) greetingIcon.innerHTML = icon(hour >= 6 && hour < 19 ? "sun" : "moon", { size: 22 });
  if (dateText) dateText.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function renderDashboard() {
  renderDashboardHeader();

  const today = todaysEntries();
  const calories = sumByType(today, "food", "calories");
  const protein = sumByType(today, "food", "protein");
  const water = sumByType(today, "water", "ml");
  const steps = sumByType(today, "activity", "steps");
  const burned = sumByType(today, "activity", "caloriesBurned") + sumByType(today, "cardio", "caloriesBurned");
  const latestWeight = latestWeightLb();

  const stats = [
    { label: "Calories", iconName: "flame", value: calories, goal: goals.calorieGoal, unit: "" },
    { label: "Protein", iconName: "bicep", value: protein, goal: goals.proteinGoal, unit: "g" },
    { label: "Water", iconName: "droplet", value: water, goal: goals.waterGoal, unit: "ml" },
    { label: "Steps", iconName: "footprints", value: steps, goal: goals.stepsGoal, unit: "" }
  ];

  const container = document.getElementById("dashboard-stats");
  container.innerHTML = stats
    .map((s) => {
      const hasGoal = !!s.goal;
      const pct = hasGoal ? barWidth(s.value, s.goal) : 0;
      const over = hasGoal && s.value > s.goal;
      return `
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-card-icon">${icon(s.iconName, { size: 18 })}</span>
            ${hasGoal ? progressRingSvg(pct, { size: 44, stroke: 4 }) : ""}
          </div>
          <div class="stat-card-label">${s.label}</div>
          <div class="stat-card-value">${s.value}${s.unit}${hasGoal ? `<span class="stat-goal"> / ${s.goal}${s.unit}</span>` : ""}</div>
          ${hasGoal ? `<div class="bar-track"><div class="bar-fill ${over ? "over" : ""}" style="width:${pct}%"></div></div>` : ""}
        </div>`;
    })
    .join("");

  const weightLine = document.getElementById("dashboard-weight-line");
  if (weightLine) {
    weightLine.innerHTML = `${burned} kcal burned today${latestWeight !== null ? ` &middot; last weight ${latestWeight} lb (${dateFromKey(latestWeightDateKey()).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${latestWeightDateKey() === todayKey() ? ", today" : ""})` : ""}`;
  }

  renderCoachPreview();
  renderWeeklyActivityChart();
  renderDailyHabits();
  renderMealsList();
  renderWorkoutPlanPanel();
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
    el.innerHTML = `<p class="subtle">No coach note yet — your first one shows up here once your coach has reviewed a week of activity.</p>`;
    return;
  }
  el.innerHTML = coachNoteHtml(coachNotes[0]);
  wireApplyButtons(el);
}

function renderWorkoutPlanPanel() {
  const el = document.getElementById("dashboard-workout-plan");
  if (!el) return;
  const scheduled = scheduledDayTypeFor(todayKey());
  const loggedToday = workoutLogs.some((w) => w.dateKey === todayKey());
  const subtitle = !scheduled
    ? "Rest day"
    : `${scheduled.dayType}${loggedToday ? " · Logged" : ""}`;
  el.innerHTML = `
    <span class="workout-plan-icon">${icon("dumbbell", { size: 18 })}</span>
    <span class="workout-plan-text">
      <span class="panel-title">Workout plan</span>
      <span class="subtle small">${subtitle}</span>
    </span>
    <span class="tab-icon">${icon("chevron-right", { size: 18 })}</span>
  `;
}

// Folds water/steps/supplements into the single "Daily habits" checklist the
// mockup shows — the underlying data (entries + goals.vitaminsList) and the
// toggling itself still live on the Log tab; this is a read-only summary.
function renderDailyHabits() {
  const el = document.getElementById("dashboard-habits");
  if (!el) return;
  const today = todaysEntries();
  const water = sumByType(today, "water", "ml");
  const steps = sumByType(today, "activity", "steps");
  const vitaminsList = goals.vitaminsList || [];
  const vitaminsTaken = today.filter((e) => e.type === "vitamin").length;

  const rows = [
    {
      iconName: "droplet",
      label: "Water",
      detail: `${(water / 1000).toFixed(1)} / ${goals.waterGoal ? (goals.waterGoal / 1000).toFixed(1) : "—"} L`,
      met: !!goals.waterGoal && water >= goals.waterGoal
    },
    {
      iconName: "pill",
      label: "Supplements",
      detail: vitaminsList.length ? `${vitaminsTaken} / ${vitaminsList.length}` : "none set up",
      met: vitaminsList.length > 0 && vitaminsTaken >= vitaminsList.length
    },
    {
      iconName: "footprints",
      label: "Steps",
      detail: `${steps.toLocaleString()} / ${goals.stepsGoal ? goals.stepsGoal.toLocaleString() : "—"}`,
      met: !!goals.stepsGoal && steps >= goals.stepsGoal
    }
  ];

  el.innerHTML = rows
    .map(
      (r) => `
      <button type="button" class="habit-row${r.met ? " met" : ""}" data-switch-view="log">
        <span class="habit-row-icon">${icon(r.iconName, { size: 16 })}</span>
        <span class="habit-row-text">${r.label}<span class="subtle">${r.detail}</span></span>
        <span class="habit-row-check">${icon("check-circle", { size: 18 })}</span>
      </button>`
    )
    .join("");
}

function renderMealsList() {
  const el = document.getElementById("dashboard-meals");
  if (!el) return;
  const meals = todaysEntries().filter((e) => e.type === "food");
  if (!meals.length) {
    el.innerHTML = `<p class="subtle small">Nothing logged yet today.</p>`;
    return;
  }
  el.innerHTML = meals
    .map(
      (m) => `
      <button type="button" class="meal-item" data-switch-view="food">
        <span class="meal-icon">${icon("utensils", { size: 16 })}</span>
        <span class="meal-text">${m.name}<span class="subtle">${m.calories || 0} cal &middot; ${m.protein || 0}g protein</span></span>
        <span class="tab-icon">${icon("chevron-right", { size: 16 })}</span>
      </button>`
    )
    .join("");
}

// ---------------------------------------------------------------------
// "This week" chart (Dashboard) — calories logged per day for the last 7
// days against the daily calorie goal. Plain inline SVG, no chart library
// (deliberately deferred adding one — see PROJECT_STATE.md): one bar per
// day is all this needs, and a hand-built bar chart keeps the "no build
// step" constraint intact. Single series, so no legend — the goal dashed
// line and the panel title carry what each mark means.
// ---------------------------------------------------------------------
function last7DateKeys() {
  const t = new Date();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    out.push(todayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i)));
  }
  return out;
}

function weeklyCaloriesChartSvg(dateKeys, valuesByKey, goal) {
  const width = 700;
  const height = 200;
  const chartTop = 14;
  const chartBottom = 150;
  const chartHeight = chartBottom - chartTop;
  const barWidth = 56;
  const gap = (width - barWidth * dateKeys.length) / (dateKeys.length + 1);

  const values = dateKeys.map((k) => valuesByKey[k] || 0);
  const max = Math.max(goal || 0, ...values, 1) * 1.15;
  const todayK = todayKey();

  const bars = dateKeys
    .map((key, i) => {
      const value = values[i];
      const x = gap + i * (barWidth + gap);
      const barHeight = (value / max) * chartHeight;
      const y = chartBottom - barHeight;
      const isToday = key === todayK;
      const over = !!goal && value > goal;
      const color = over ? "var(--danger)" : "var(--accent)";
      const dayLabel = WEEKDAY_LABELS[weekdayOf(key)];
      const valueLabel = isToday && value > 0
        ? `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="var(--text)">${value}</text>`
        : "";
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, value > 0 ? 2 : 0)}" rx="4" fill="${color}">
            <title>${dateFromKey(key).toLocaleDateString(undefined, { weekday: "long" })}: ${value} kcal${over ? " (over goal)" : ""}</title>
          </rect>
          ${valueLabel}
          <text x="${x + barWidth / 2}" y="172" text-anchor="middle" font-size="12" fill="${isToday ? "var(--text)" : "var(--subtle)"}" font-weight="${isToday ? "700" : "400"}">${dayLabel}</text>
        </g>`;
    })
    .join("");

  const goalLine = goal
    ? `<line x1="0" y1="${chartBottom - (goal / max) * chartHeight}" x2="${width}" y2="${chartBottom - (goal / max) * chartHeight}" stroke="var(--subtle)" stroke-width="1.5" stroke-dasharray="5 4"/>`
    : "";

  const summary = dateKeys.map((k, i) => `${WEEKDAY_LABELS[weekdayOf(k)]} ${values[i]}`).join(", ");
  const ariaLabel = `Calories per day, this week: ${summary}.${goal ? ` Goal ${goal} kcal per day.` : ""}`;

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}" style="width:100%; height:auto; display:block;">
    <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="var(--panel-border)" stroke-width="1"/>
    ${goalLine}
    ${bars}
  </svg>`;
}

function renderWeeklyActivityChart() {
  const el = document.getElementById("dashboard-activity-chart");
  if (!el) return;
  const dateKeys = last7DateKeys();
  const valuesByKey = {};
  for (const key of dateKeys) {
    valuesByKey[key] = sumByType(entries.filter((e) => e.dateKey === key), "food", "calories");
  }
  el.innerHTML = weeklyCaloriesChartSvg(dateKeys, valuesByKey, goals.calorieGoal);
}

// ---------------------------------------------------------------------
// Everything calendar (Dashboard) — manual events the user adds directly,
// plus events pulled in from imported iCal/webcal feeds (Google/Outlook/
// Apple all export one from their sharing settings). The gym tab keeps its
// own calendar for logging sets (unchanged); this one additionally overlays
// scheduled/logged gym days as a read-only entry so it's the one place to
// see everything going on, per Adrian's ask.
//
// No backend: an imported feed is fetched through a public CORS relay
// (api.allorigins.win) since calendar providers don't set CORS headers for
// arbitrary browser fetches — this is a real third-party dependency (could
// go down or rate-limit) and the feed URL is sent to it on every sync, not
// just to Firestore. One-way (reads events in, never writes back to the
// source calendar). RRULE (recurring events) isn't expanded — a recurring
// event shows only its first occurrence, flagged "(recurring)" in the UI
// rather than silently wrong. See calendar.js for the actual parsing.
// ---------------------------------------------------------------------
// Free public CORS relays are individually flaky (seen both real outages
// and relays that return a non-2xx status code while still delivering a
// perfectly good body) — tried in order, first one whose response actually
// looks like an ICS file wins, rather than trusting any single relay or its
// HTTP status code alone. corsfix.com confirmed working (tested live against
// a real Canvas feed) and listed first; the rest are fallbacks in case it's
// ever down or rate-limited (60 req/10min on its free tier) — note it wants
// the target URL appended raw, not percent-encoded, unlike the others.
const CORS_RELAYS = [
  (url) => `https://proxy.corsfix.com/?${url}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://cors.eu.org/${url}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchViaCorsRelay(url) {
  const errors = [];
  for (const buildRelayUrl of CORS_RELAYS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(buildRelayUrl(url), { signal: controller.signal });
      const text = await res.text();
      if (text.includes("BEGIN:VCALENDAR")) return text;
      errors.push(`relay returned no calendar data (HTTP ${res.status})`);
    } catch (err) {
      errors.push(String(err.message || err));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`all calendar relays failed — ${errors.join("; ")}`);
}

function gymEventForDate(dateKey) {
  const existing = logForDate(dateKey);
  const scheduled = scheduledDayTypeFor(dateKey);
  const dayType = existing?.dayType || scheduled?.dayType;
  if (!dayType) return null;
  return {
    id: `gym-${dateKey}`,
    title: `Gym: ${dayType}`,
    color: GYM_EVENT_COLOR,
    allDay: true,
    dateKey,
    endDateKey: dateKey,
    gym: true,
    logged: !!existing
  };
}

function manualEventsForDate(dateKey) {
  return calendarEvents.filter((e) => occursOnDate(e, dateKey));
}

function allEventsForDate(dateKey) {
  const gymEvent = gymEventForDate(dateKey);
  const manual = manualEventsForDate(dateKey)
    .slice()
    .sort((a, b) => (a.allDay === b.allDay ? (a.startTime || "").localeCompare(b.startTime || "") : a.allDay ? -1 : 1));
  return gymEvent ? [gymEvent, ...manual] : manual;
}

function renderDashCalendar() {
  const weekdaysEl = document.getElementById("ecal-weekdays");
  const daysEl = document.getElementById("ecal-days");
  const label = document.getElementById("ecal-month-label");
  if (!weekdaysEl) return;

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
    const dayEvents = allEventsForDate(dateKey);
    const classes = ["cal-day"];
    if (dateKey < today) classes.push("past");
    if (dateKey === today) classes.push("today");
    if (dateKey === selectedDateKey) classes.push("selected");
    const dots = [...new Set(dayEvents.map((e) => e.color || DEFAULT_EVENT_COLOR))]
      .slice(0, 4)
      .map((c) => `<span class="cal-dot" style="background:${c}"></span>`)
      .join("");
    html += `<button type="button" class="${classes.join(" ")}" data-date="${dateKey}">${day}<span class="cal-dots">${dots}</span></button>`;
  }
  daysEl.innerHTML = html;

  daysEl.querySelectorAll("[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => setSelectedDate(btn.dataset.date));
  });
}

// A category tags what an event *is*, not just how it looks. "Cardio" is
// the one that currently does something beyond labeling — it surfaces an
// upcoming-cardio reminder in the Gym tab (see upcomingCardioEvents), so
// adding a run to the calendar makes the rest of the app aware of it.
// Every built-in category already has a sensible color, so picking one sets
// the event's color automatically — the manual color picker only shows up
// for "Other," where there's no sensible default to assume.
const DEFAULT_CATEGORY_COLORS = {
  General: DEFAULT_EVENT_COLOR,
  Workout: "#4f8ef7",
  Cardio: "#00b8a9",
  Appointment: "#f2994a",
  Work: "#8d6e63",
  Holiday: "#e0a030",
  Birthday: "#ff5c9e"
};
const EVENT_CATEGORIES = [...Object.keys(DEFAULT_CATEGORY_COLORS), "Other"];
const ADD_CATEGORY_VALUE = "__add_new__";

// User-defined categories beyond the built-in list, each with its own
// color chosen once at creation time (not re-picked per event, same as the
// built-ins) — users/{uid}/meta/categories, {"Name": "#hex", ...}.
let customCategories = {};

function categoryColor(category) {
  return DEFAULT_CATEGORY_COLORS[category] || customCategories[category] || DEFAULT_EVENT_COLOR;
}

function eventFormHtml(prefix, ev = {}) {
  const dateKey = ev.dateKey || selectedDateKey || todayKey();
  return `
    <form class="log-form" id="${prefix}-form" data-id="${ev.id || ""}">
      <input type="text" name="title" placeholder="Event title" value="${ev.title ? ev.title.replace(/"/g, "&quot;") : ""}" required />
      <div class="row">
        <label class="small grow">Starts
          <input type="date" name="dateKey" value="${dateKey}" required />
        </label>
        <label class="small grow">Ends
          <input type="date" name="endDateKey" value="${ev.endDateKey || dateKey}" required />
        </label>
      </div>
      <label class="small"><input type="checkbox" name="allDay" ${ev.allDay !== false && !ev.startTime ? "checked" : ""} /> All day</label>
      <div class="row" data-time-row ${ev.allDay !== false && !ev.startTime ? "hidden" : ""}>
        <label class="small grow">Start time
          <input type="time" name="startTime" value="${ev.startTime || ""}" />
        </label>
        <label class="small grow">End time
          <input type="time" name="endTime" value="${ev.endTime || ""}" />
        </label>
      </div>
      <div class="row">
        <label class="small grow">Category
          <select name="category">
            ${EVENT_CATEGORIES.filter((c) => c !== "Other")
              .map((c) => `<option value="${c}" ${ev.category === c ? "selected" : ""}>${c}</option>`)
              .join("")}
            ${Object.keys(customCategories)
              .map((c) => `<option value="${c}" ${ev.category === c ? "selected" : ""}>${c}</option>`)
              .join("")}
            <option value="Other" ${ev.category === "Other" ? "selected" : ""}>Other</option>
            <option value="${ADD_CATEGORY_VALUE}">+ Add new category…</option>
          </select>
        </label>
        <label class="small" data-event-color-row ${(ev.category || "General") !== "Other" ? "hidden" : ""}>Color
          <input type="color" name="color" value="${ev.color || categoryColor(ev.category) || DEFAULT_EVENT_COLOR}" />
        </label>
      </div>
      <div class="row" data-new-category-row hidden>
        <input type="text" data-new-category-name placeholder="New category name" class="grow" />
        <input type="color" data-new-category-color value="${DEFAULT_EVENT_COLOR}" />
        <button type="button" class="btn ghost small" data-save-category>Save category</button>
      </div>
      <input type="text" name="notes" placeholder="Notes (optional)" value="${ev.notes ? ev.notes.replace(/"/g, "&quot;") : ""}" />
      ${ev.category === "Cardio" || !ev.id ? `<p class="subtle small">Tagging this "Cardio" makes it show up as an upcoming reminder in the Gym tab.</p>` : ""}
      ${ev.id ? "" : `
        <label class="small">Repeats
          <select name="repeat">
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekday">Every weekday (Mon–Fri)</option>
            <option value="weekend">Every weekend (Sat–Sun)</option>
            <option value="weekly">Weekly, same day</option>
            <option value="monthly">Monthly, same date</option>
            <option value="yearly">Yearly, same date (birthdays, holidays)</option>
          </select>
        </label>
        <label class="small" data-repeat-until-row hidden>
          <input type="checkbox" name="repeatForever" /> Repeat forever (no end date)
        </label>
        <label class="small" data-repeat-until-date-row hidden>Repeat until
          <input type="date" name="repeatUntil" />
        </label>`}
      <div class="row">
        <button type="submit" class="btn primary small">${ev.id ? "Save" : "Add event"}</button>
        ${ev.id ? `<button type="button" class="btn ghost small" data-cancel-edit>Cancel</button>` : ""}
      </div>
    </form>`;
}

function wireEventForm(prefix, container) {
  const form = container.querySelector(`#${prefix}-form`);
  if (!form) return;
  form.querySelector('[name="allDay"]').addEventListener("change", (e) => {
    form.querySelector("[data-time-row]").hidden = e.target.checked;
  });
  const cancelBtn = form.querySelector("[data-cancel-edit]");
  if (cancelBtn) cancelBtn.addEventListener("click", () => { editingEventId = null; renderDashDayPanel(); });

  const repeatSelect = form.querySelector('[name="repeat"]');
  if (repeatSelect) {
    const foreverRow = form.querySelector("[data-repeat-until-row]");
    const untilDateRow = form.querySelector("[data-repeat-until-date-row]");
    repeatSelect.addEventListener("change", (e) => {
      const repeating = e.target.value !== "none";
      foreverRow.hidden = !repeating;
      untilDateRow.hidden = !repeating || form.repeatForever.checked;
      if (repeating && !form.repeatUntil.value) {
        // Default "until" to 3 months out so a weekly work shift doesn't
        // need the end date typed by hand every time.
        const start = new Date(form.dateKey.value);
        form.repeatUntil.value = todayKey(new Date(start.getFullYear(), start.getMonth() + 3, start.getDate()));
      }
    });
    form.repeatForever.addEventListener("change", (e) => {
      untilDateRow.hidden = e.target.checked;
    });
  }

  const categorySelect = form.querySelector('[name="category"]');
  const colorRow = form.querySelector("[data-event-color-row]");
  const newCategoryRow = form.querySelector("[data-new-category-row]");
  categorySelect.addEventListener("change", (e) => {
    if (e.target.value === ADD_CATEGORY_VALUE) {
      newCategoryRow.hidden = false;
      colorRow.hidden = true;
      return;
    }
    newCategoryRow.hidden = true;
    const isOther = e.target.value === "Other";
    colorRow.hidden = !isOther;
    if (!isOther) form.color.value = categoryColor(e.target.value);
  });
  newCategoryRow.querySelector("[data-save-category]").addEventListener("click", async () => {
    if (!currentUid) return;
    const name = newCategoryRow.querySelector("[data-new-category-name]").value.trim();
    const color = newCategoryRow.querySelector("[data-new-category-color]").value;
    if (!name) return;
    await setDoc(doc(db, "users", currentUid, "meta", "categories"), { [name]: color }, { merge: true });
    customCategories[name] = color;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    categorySelect.insertBefore(opt, categorySelect.querySelector(`option[value="Other"]`));
    categorySelect.value = name;
    newCategoryRow.hidden = true;
    colorRow.hidden = true;
    form.color.value = color;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUid) return;
    const data = new FormData(form);
    const allDay = data.get("allDay") === "on";
    const startKey = data.get("dateKey");
    const endKey = data.get("endDateKey") < startKey ? startKey : data.get("endDateKey");
    const fields = {
      title: data.get("title").trim(),
      allDay,
      startTime: allDay ? null : (data.get("startTime") || null),
      endTime: allDay ? null : (data.get("endTime") || null),
      color: data.get("color") || DEFAULT_EVENT_COLOR,
      category: data.get("category") || "General",
      notes: data.get("notes")?.trim() || null
    };
    const id = form.dataset.id;
    if (id) {
      // Edits to a feed-imported event stick — the next sync won't clobber
      // a manual correction (see syncFeed's userEdited check below).
      await setDoc(doc(db, "users", currentUid, "calendarEvents", id), {
        ...fields, dateKey: startKey, endDateKey: endKey, userEdited: true
      }, { merge: true });
    } else {
      const repeat = data.get("repeat") || "none";
      const spanDays = Math.round((dateFromKey(endKey) - dateFromKey(startKey)) / 86400000);
      // "Forever" isn't literal — nothing is — it's capped at 10 years out,
      // same safety net as generateRecurrenceDates' own 366-occurrence cap
      // (which also still applies: a "forever" daily event still stops at
      // 366 days, not 10 years of daily docs).
      const untilKey = data.get("repeatForever") === "on"
        ? todayKey(new Date(dateFromKey(startKey).getFullYear() + 10, dateFromKey(startKey).getMonth(), dateFromKey(startKey).getDate()))
        : (data.get("repeatUntil") || startKey);
      const occurrenceStarts = repeat === "none"
        ? [startKey]
        : generateRecurrenceDates(startKey, repeat, untilKey);
      const recurrenceGroupId = repeat !== "none" && occurrenceStarts.length > 1 ? `rec-${Date.now()}` : null;
      const batch = writeBatch(db);
      for (const occStart of occurrenceStarts) {
        const occEnd = todayKey(new Date(dateFromKey(occStart).getTime() + spanDays * 86400000));
        batch.set(doc(collection(db, "users", currentUid, "calendarEvents")), {
          ...fields, dateKey: occStart, endDateKey: occEnd, source: "manual", createdAt: Timestamp.now(),
          ...(recurrenceGroupId ? { recurrenceGroupId } : {})
        });
      }
      await batch.commit();
    }
    editingEventId = null;
    renderDashDayPanel();
    renderDashCalendar();
  });
}

let editingEventId = null;

// A small "mini-link" (native <details>, no extra JS state needed) that
// expands the day panel's gym entry into the exercises actually logged —
// so you can see what you did right from the calendar, without switching
// to the Gym tab.
function gymLogDetailsHtml(dateKey) {
  const log = logForDate(dateKey);
  if (!log) return "";
  const rows = (log.entries || [])
    .map((e) => {
      const name = e.exerciseName || exerciseById.get(e.exerciseId)?.name || "Exercise";
      const setsLabel = (e.sets || []).map((s) => `${s.w || 0}x${s.r || 0}`).join(", ") || "no sets logged";
      return `<li>${name} — ${setsLabel}</li>`;
    })
    .join("");
  return `<details><summary class="link-btn" style="display:inline;">View details</summary><ul class="subtle small">${rows}</ul>${log.notes ? `<p class="subtle small">Notes: ${log.notes}</p>` : ""}</details>`;
}

function renderDashDayPanel() {
  const el = document.getElementById("ecal-day-panel");
  if (!el) return;
  if (!selectedDateKey) selectedDateKey = todayKey();
  const dateKey = selectedDateKey;
  const dateLabel = dateFromKey(dateKey).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const now = new Date();
  const events = allEventsForDate(dateKey);

  const editing = events.find((e) => e.id === editingEventId && !e.gym);

  const listHtml = events.length
    ? `<ul class="entry-list">${events.map((e) => {
        const expired = !e.gym && isEventExpired(e, now);
        const timeLabel = e.allDay ? "All day" : [e.startTime, e.endTime].filter(Boolean).join(" – ") || "";
        return `
          <li class="entry-row ${expired ? "expired" : ""}">
            <span>
              <span class="cal-dot" style="background:${e.color || DEFAULT_EVENT_COLOR}"></span>
              <strong>${e.title}</strong>
              ${e.recurring ? `<span class="subtle small">(recurring)</span>` : ""}
              ${timeLabel ? `<span class="subtle small"> — ${timeLabel}</span>` : ""}
              ${e.notes ? `<br/><span class="subtle small">${e.notes}</span>` : ""}
              ${e.gym
                ? e.logged
                  ? `<br/>${gymLogDetailsHtml(dateKey)}`
                  : `<br/><span class="subtle small">Scheduled — go log it in the Gym tab.</span>`
                : ""}
            </span>
            ${e.gym ? "" : `
              <span class="row" style="gap:6px;">
                <button type="button" class="btn ghost small" data-edit-event="${e.id}">Edit</button>
                <button type="button" class="btn ghost small" data-delete-event="${e.id}">Delete</button>
              </span>`}
          </li>`;
      }).join("")}</ul>`
    : `<p class="subtle small">Nothing on this day.</p>`;

  el.innerHTML = `
    <h2>${dateLabel}</h2>
    ${listHtml}
    ${editing ? eventFormHtml("ecal-event", editing) : eventFormHtml("ecal-event")}
  `;

  wireEventForm("ecal-event", el);

  el.querySelectorAll("[data-edit-event]").forEach((btn) => {
    btn.addEventListener("click", () => { editingEventId = btn.dataset.editEvent; renderDashDayPanel(); });
  });
  el.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUid) return;
      await deleteDoc(doc(db, "users", currentUid, "calendarEvents", btn.dataset.deleteEvent));
      if (editingEventId === btn.dataset.deleteEvent) editingEventId = null;
    });
  });
}

document.getElementById("ecal-toggle-feeds-btn")?.addEventListener("click", () => {
  const panel = document.getElementById("ecal-feeds-panel");
  panel.hidden = !panel.hidden;
});

document.getElementById("ecal-prev")?.addEventListener("click", () => {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
  renderDashCalendar();
});
document.getElementById("ecal-next")?.addEventListener("click", () => {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
  renderDashCalendar();
});

// Re-render once a minute so "expired" status (timed events crossing their
// end time) updates live without needing a reload.
setInterval(() => { renderDashCalendar(); renderDashDayPanel(); }, 60000);

// ---------------------------------------------------------------------
// Imported calendar feeds
// ---------------------------------------------------------------------
function renderCalendarFeeds() {
  const el = document.getElementById("ecal-feeds-list");
  if (!el) return;
  el.innerHTML = calendarFeeds.length
    ? calendarFeeds.map((f) => {
        const status = f.lastSyncError
          ? `<span class="error small">Sync failed: ${f.lastSyncError}</span>`
          : f.lastSyncedAt
            ? `<span class="subtle small">Last synced ${f.lastSyncedAt.toDate().toLocaleString()}</span>`
            : `<span class="subtle small">Never synced</span>`;
        return `
          <li class="entry-row">
            <span>
              <span class="cal-dot" style="background:${f.color || DEFAULT_FEED_COLOR}"></span>
              <strong>${f.label}</strong><br/>${status}
            </span>
            <span class="row" style="gap:6px;">
              <button type="button" class="btn ghost small" data-sync-feed="${f.id}">Sync</button>
              <button type="button" class="btn ghost small" data-remove-feed="${f.id}">Remove</button>
            </span>
          </li>`;
      }).join("")
    : `<p class="subtle small">No calendars imported yet.</p>`;

  el.querySelectorAll("[data-sync-feed]").forEach((btn) => {
    btn.addEventListener("click", () => syncFeed(btn.dataset.syncFeed));
  });
  el.querySelectorAll("[data-remove-feed]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUid) return;
      const feedId = btn.dataset.removeFeed;
      const batch = writeBatch(db);
      calendarEvents.filter((e) => e.feedId === feedId).forEach((e) => batch.delete(doc(db, "users", currentUid, "calendarEvents", e.id)));
      batch.delete(doc(db, "users", currentUid, "calendarFeeds", feedId));
      await batch.commit();
    });
  });
}

document.getElementById("ecal-feed-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const data = new FormData(e.target);
  const newFeed = {
    label: data.get("label").trim(),
    url: normalizeFeedUrl(data.get("url")),
    color: data.get("color") || DEFAULT_FEED_COLOR,
    createdAt: Timestamp.now(),
    lastSyncedAt: null,
    lastSyncError: null
  };
  const docRef = await addDoc(collection(db, "users", currentUid, "calendarFeeds"), newFeed);
  e.target.reset();
  // Sync immediately using what we just wrote, rather than looking it up in
  // calendarFeeds — the live listener that populates that array hasn't
  // necessarily delivered this new doc yet (confirmed by testing: the
  // lookup silently missed and no sync ever ran).
  syncFeed(docRef.id, newFeed);
});

async function syncFeed(feedId, feedOverride) {
  if (!currentUid) return;
  const feed = feedOverride || calendarFeeds.find((f) => f.id === feedId);
  if (!feed) return;
  const feedRef = doc(db, "users", currentUid, "calendarFeeds", feedId);
  try {
    const text = await fetchViaCorsRelay(feed.url);
    const parsed = parseICS(text);

    const existing = calendarEvents.filter((e) => e.feedId === feedId);
    const existingByUid = new Map(existing.map((e) => [e.externalUid, e]));
    const parsedUids = new Set(parsed.map((p) => p.externalUid));

    const batch = writeBatch(db);
    for (const p of parsed) {
      const prior = existingByUid.get(p.externalUid);
      if (prior) {
        // A manual edit after import sticks — don't clobber it on resync.
        if (prior.userEdited) continue;
        batch.set(doc(db, "users", currentUid, "calendarEvents", prior.id), {
          ...p, feedId, source: "feed", color: feed.color
        }, { merge: true });
      } else {
        batch.set(doc(collection(db, "users", currentUid, "calendarEvents")), {
          ...p, feedId, source: "feed", color: feed.color, createdAt: Timestamp.now()
        });
      }
    }
    // Drop events this feed no longer has, unless the user edited them.
    for (const e of existing) {
      if (!parsedUids.has(e.externalUid) && !e.userEdited) {
        batch.delete(doc(db, "users", currentUid, "calendarEvents", e.id));
      }
    }
    batch.set(feedRef, { lastSyncedAt: Timestamp.now(), lastSyncError: null }, { merge: true });
    await batch.commit();
  } catch (err) {
    await setDoc(feedRef, { lastSyncError: String(err.message || err) }, { merge: true });
  }
}

// Public holidays via date.nager.at — free, no key, and (confirmed live)
// sets CORS headers for direct browser fetches, unlike the calendar-feed
// situation, so no relay needed here. Idempotent: externalUid is derived
// from country+date, so re-running for the same country just updates
// existing holiday events instead of duplicating them.
async function syncHolidays(countryCode) {
  const statusEl = document.getElementById("goals-holiday-status");
  if (!currentUid || !countryCode) return;
  statusEl.textContent = "Adding holidays…";
  try {
    const thisYear = new Date().getFullYear();
    const [yearNow, yearNext] = await Promise.all(
      [thisYear, thisYear + 1].map((y) =>
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${countryCode}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      )
    );
    const holidays = [...yearNow, ...yearNext];
    const existing = calendarEvents.filter((e) => e.source === "holiday" && e.holidayCountry === countryCode);
    const existingByUid = new Map(existing.map((e) => [e.externalUid, e]));

    const batch = writeBatch(db);
    for (const h of holidays) {
      const externalUid = `holiday-${countryCode}-${h.date}`;
      const prior = existingByUid.get(externalUid);
      const fields = {
        title: h.localName, dateKey: h.date, endDateKey: h.date, allDay: true,
        startTime: null, endTime: null, color: DEFAULT_CATEGORY_COLORS.Holiday, category: "Holiday",
        source: "holiday", holidayCountry: countryCode, externalUid
      };
      if (prior) {
        if (!prior.userEdited) batch.set(doc(db, "users", currentUid, "calendarEvents", prior.id), fields, { merge: true });
      } else {
        batch.set(doc(collection(db, "users", currentUid, "calendarEvents")), { ...fields, createdAt: Timestamp.now() });
      }
    }
    await batch.commit();
    statusEl.textContent = `Added ${holidays.length} holidays for ${countryCode} (this year and next).`;
  } catch (err) {
    statusEl.textContent = `Couldn't add holidays: ${err.message || err}`;
  }
}

document.getElementById("goals-holiday-sync-btn")?.addEventListener("click", () => {
  syncHolidays(document.getElementById("goals-holiday-country").value);
});

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
  const heading = document.getElementById("today-entries-heading");
  if (heading) heading.textContent = `${selectedDateLabel()}'s entries`;
  const today = entriesForSelectedDate().filter((e) => e.type !== "food");
  if (!today.length) {
    list.innerHTML = `<li class="entry-row subtle">Nothing logged yet${selectedDateKey && selectedDateKey !== todayKey() ? "" : " today"}.</li>`;
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
  const heading = document.getElementById("food-entries-heading");
  if (heading) heading.textContent = `${selectedDateLabel()}'s food`;
  const today = entriesForSelectedDate().filter((e) => e.type === "food");
  if (!today.length) {
    list.innerHTML = `<li class="entry-row subtle">Nothing logged yet${selectedDateKey && selectedDateKey !== todayKey() ? "" : " today"}.</li>`;
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
// Manual food entry's auto-estimate — looks up whatever name you typed
// against the USDA FoodData Central database (free, no key-management
// server needed: it sets CORS headers for direct browser fetches, unlike
// the calendar-feed situation) and pre-fills calories/protein from the
// closest match's per-100g values. Still fully editable — this is a
// convenience estimate, not an exact measurement, since portion size is
// never known from a name alone.
// ---------------------------------------------------------------------
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// People type things like "2 servings of tyson chicken tenders," not just
// a bare food name — strip the leading quantity/filler so the search term
// that actually reaches USDA is just "tyson chicken tenders".
function stripQuantityPrefix(q) {
  return q.replace(/^\s*\d+(\.\d+)?\s*(servings?|cups?|oz|ounces?|grams?|g|lbs?|pounds?|pieces?|slices?|tbsp|tablespoons?|tsp|teaspoons?)?\s*(of\s+)?/i, "").trim() || q;
}

async function searchUsdaFoodsWithDataType(query, dataType) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(query)}&pageSize=6${dataType ? `&dataType=${dataType}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.foods || [])
    .map((f) => {
      const kcal = f.foodNutrients.find((n) => n.nutrientId === 1008)?.value;
      const protein = f.foodNutrients.find((n) => n.nutrientId === 1003)?.value;
      return { description: f.description, kcalPer100g: kcal, proteinPer100g: protein };
    })
    .filter((f) => f.kcalPer100g != null);
}

// Foundation/SR Legacy are generic foods (less noisy, more reliable macros)
// — tried first. A brand name like "Tyson" only exists in Branded data, so
// that's the fallback, not the default (it's noisier: packaging variants,
// odd serving sizes, prepared-meal combos).
async function searchUsdaFoods(rawQuery) {
  const query = stripQuantityPrefix(rawQuery);
  const generic = await searchUsdaFoodsWithDataType(query, "Foundation,SR%20Legacy");
  if (generic.length) return generic;
  return searchUsdaFoodsWithDataType(query, "Branded");
}

const foodNameInput = document.getElementById("food-name-input");
const foodUsdaResultsEl = document.getElementById("food-usda-results");
if (foodNameInput && foodUsdaResultsEl) {
  const runSearch = debounce(async (q) => {
    if (q.trim().length < 3) {
      foodUsdaResultsEl.innerHTML = "";
      return;
    }
    if (USDA_API_KEY === "YOUR_API_KEY_HERE") {
      foodUsdaResultsEl.innerHTML = `<p class="subtle small">Auto-estimate isn't set up yet — add a free USDA API key to <code>usda-config.js</code> (see README) to enable it. You can still type calories/protein yourself.</p>`;
      return;
    }
    let results;
    try {
      results = await searchUsdaFoods(q.trim());
    } catch (err) {
      foodUsdaResultsEl.innerHTML = `<p class="subtle small">Couldn't reach the food database right now — type calories/protein yourself for now.</p>`;
      return;
    }
    if (foodNameInput.value.trim() !== q.trim()) return; // stale response, input moved on
    foodUsdaResultsEl.innerHTML = results.length
      ? `<ul class="entry-list">${results
          .map(
            (r, i) => `
          <li class="entry-row">
            <span>${r.description} <span class="subtle small">(~100g: ${Math.round(r.kcalPer100g)} kcal, ${(r.proteinPer100g ?? 0).toFixed(1)}g protein)</span></span>
            <button type="button" class="btn ghost small" data-pick-usda="${i}">Use this</button>
          </li>`
          )
          .join("")}</ul>`
      : `<p class="subtle small">No match in the food database — type calories/protein yourself.</p>`;
    foodUsdaResultsEl.querySelectorAll("[data-pick-usda]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = results[Number(btn.dataset.pickUsda)];
        const form = document.getElementById("form-food");
        form.calories.value = Math.round(r.kcalPer100g);
        form.protein.value = (r.proteinPer100g ?? 0).toFixed(1);
        document.getElementById("food-estimate-note").hidden = false;
        foodUsdaResultsEl.innerHTML = "";
      });
    });
  }, 450);
  foodNameInput.addEventListener("input", (e) => {
    document.getElementById("food-estimate-note").hidden = true;
    runSearch(e.target.value);
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
    case "cardio": return `🏃 ${e.cardioType || "Cardio"} — ${e.durationMin || 0} min${e.distanceMi ? `, ${e.distanceMi} mi` : ""}${e.caloriesBurned ? `, ${e.caloriesBurned} kcal burned` : ""}`;
    case "vitamin": return `💊 ${e.name}`;
    default: return e.type;
  }
}

function renderVitaminChips() {
  const list = (goals.vitaminsList || []);
  const selectedTaken = entriesForSelectedDate().filter((e) => e.type === "vitamin");
  const logEl = document.getElementById("vitamin-quick-list");
  if (!logEl) return;

  if (!list.length) {
    logEl.innerHTML = `<p class="subtle small">No vitamins set up yet — add some in Settings.</p>`;
    return;
  }

  function chipsHtmlFor(taken) {
    return list
      .map((name) => {
        const takenEntry = taken.find((e) => e.name === name);
        return `<button class="chip-btn ${takenEntry ? "taken" : ""}" data-vitamin="${name}" data-entry-id="${takenEntry ? takenEntry.id : ""}">${takenEntry ? "✓ " : ""}${name}</button>`;
      })
      .join("");
  }

  logEl.innerHTML = chipsHtmlFor(selectedTaken);
  logEl.querySelectorAll("[data-vitamin]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.entryId) await removeEntry(btn.dataset.entryId);
      else await addEntry("vitamin", { name: btn.dataset.vitamin });
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
const goalsEquipmentEl = document.getElementById("goals-equipment");
const goalsEquipmentDaySelect = document.getElementById("goals-equipment-day-select");
const goalsEquipmentResetDayBtn = document.getElementById("goals-equipment-reset-day");
let goalsDays = [1, 3, 5];
let goalsEquipment = EQUIPMENT_OPTIONS.slice();      // the "every day" default
let goalsEquipmentByDay = {};                        // sparse: {"1": [...], ...} — only customized weekdays
let goalsEquipmentEditingDay = "default";            // which one the chip row below currently edits

function drawGoalsDays() {
  renderDayChips(goalsDaysEl, goalsDays, (next) => { goalsDays = next; drawGoalsDays(); });
}

function currentlyEditedEquipmentList() {
  if (goalsEquipmentEditingDay === "default") return goalsEquipment;
  return goalsEquipmentByDay[goalsEquipmentEditingDay] || goalsEquipment.slice();
}

function drawGoalsEquipment() {
  const list = currentlyEditedEquipmentList();
  goalsEquipmentResetDayBtn.hidden = goalsEquipmentEditingDay === "default" || !goalsEquipmentByDay[goalsEquipmentEditingDay];
  renderEquipmentChips(goalsEquipmentEl, list, (next) => {
    if (goalsEquipmentEditingDay === "default") goalsEquipment = next;
    else goalsEquipmentByDay[goalsEquipmentEditingDay] = next;
    drawGoalsEquipment();
  });
}

goalsEquipmentDaySelect.addEventListener("change", (e) => {
  goalsEquipmentEditingDay = e.target.value;
  drawGoalsEquipment();
});
goalsEquipmentResetDayBtn.addEventListener("click", () => {
  delete goalsEquipmentByDay[goalsEquipmentEditingDay];
  drawGoalsEquipment();
});

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

  goalsForm.minIncrementLb.value = goals.minIncrementLb ?? "";
  goalsEquipment = goals.equipment && goals.equipment.length ? goals.equipment : EQUIPMENT_OPTIONS.slice();
  goalsEquipmentByDay = { ...(goals.equipmentByDay || {}) };
  goalsEquipmentEditingDay = "default";
  goalsEquipmentDaySelect.value = "default";
  drawGoalsEquipment();
}

goalsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const data = new FormData(goalsForm);
  const vitaminsList = (data.get("vitaminsList") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Snapshot goalsDays/goalsEquipment now — writing the profile doc below
  // triggers its onSnapshot listener, which calls fillGoalsForm() and would
  // otherwise reset these module-level variables mid-submit (the same race
  // that silently dropped availability changes before — confirmed by
  // testing — would do the same to equipment).
  const selectedDays = goalsDays.slice();
  const selectedEquipment = goalsEquipment.slice();
  const selectedEquipmentByDay = { ...goalsEquipmentByDay };

  const availabilityChanged = selectedDays.length !== (goals.daysPerWeek || 0)
    || JSON.stringify(selectedDays) !== JSON.stringify(goals.preferredDays || []);
  const priorEquipment = goals.equipment && goals.equipment.length ? goals.equipment : EQUIPMENT_OPTIONS;
  const equipmentChanged = JSON.stringify(selectedEquipment.slice().sort())
    !== JSON.stringify(priorEquipment.slice().sort())
    || JSON.stringify(selectedEquipmentByDay) !== JSON.stringify(goals.equipmentByDay || {});
  const minIncrementLb = Number(data.get("minIncrementLb")) || null;
  const minIncrementChanged = minIncrementLb !== (goals.minIncrementLb ?? null);
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
  const settingsChanged = availabilityChanged || goalTypeChanged || bioChanged || activityLevelChanged
    || equipmentChanged || minIncrementChanged;

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
    preferredDays: selectedDays,
    equipment: selectedEquipment,
    equipmentByDay: selectedEquipmentByDay,
    minIncrementLb
  }, { merge: true });

  if ((availabilityChanged || equipmentChanged) && selectedDays.length) {
    await rebuildSplit(selectedDays.length, equipmentForScheduledDays(selectedDays, selectedEquipment, selectedEquipmentByDay));
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
// A date that's neither scheduled nor already logged is a rest day — it
// shouldn't silently show some split day's exercises (it used to fall back
// to distinctDayTypes()[0], which made every "off" day look like it was
// recommending a specific workout). Picking a type from the panel's
// dropdown on a rest day opts into logging one anyway, tracked here so it
// doesn't carry over to the next day you look at.
let restDayOverride = null; // { dateKey, dayType }

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
    const tgt = exMeta ? targetForUser(historyForExercise(exId, dateKey), exMeta) : null;
    const n = exMeta?.sets || 3;
    return Array.from({ length: n }, () => ({ w: tgt?.weight != null ? String(tgt.weight) : "", r: "" }));
  });

  const extra = (existing?.entries || [])
    .filter((e) => e.extra)
    .map((e) => ({
      exerciseId: e.exerciseId,
      sets: (e.sets || []).map((s) => ({ w: String(s.w ?? ""), r: String(s.r ?? "") }))
    }));

  return { dateKey, dayType, picks, sets, extra, notes: existing?.notes || "" };
}

// No licensed exercise-video source in the catalog (wger has stills only) —
// this links out to a YouTube search for the exercise name instead of
// embedding or hosting any video ourselves.
function youtubeSearchLinkHtml(exerciseName) {
  const q = encodeURIComponent(`${exerciseName} exercise form`);
  return `<a class="link-btn" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Watch form video &#8599;</a>`;
}

function warmupCooldownHtml(steps, label) {
  if (!steps || !steps.length) return "";
  return `<details class="panel" style="margin-bottom:10px;">
    <summary class="link-btn" style="display:inline;">${label}</summary>
    <ul class="subtle small">${steps.map((s) => `<li>${s}</li>`).join("")}</ul>
  </details>`;
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
    ${youtubeSearchLinkHtml(ex.name)}
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

function gymJumpToDate(newDateKey) {
  selectedDateKey = newDateKey;
  syncLogDatePickers();
  renderGymDayPanel();
  renderDashCalendar();
  renderDashDayPanel();
  renderTodayEntries();
  renderFoodEntries();
}

function gymJumpDay(delta) {
  const d = dateFromKey(selectedDateKey);
  gymJumpToDate(todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta)));
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
  const override = restDayOverride?.dateKey === selectedDateKey ? restDayOverride.dayType : null;
  const dayType = existing?.dayType || scheduled?.dayType || override;
  const dateLabel = dateFromKey(selectedDateKey).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  if (!dayType) {
    el.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div class="row" style="align-items:center;gap:8px;">
          <button type="button" class="btn small" id="gym-day-prev">&lsaquo;</button>
          <h2 style="margin:0;">${dateLabel}</h2>
          <button type="button" class="btn small" id="gym-day-next">&rsaquo;</button>
        </div>
      </div>
      <p class="subtle small">${selectedDateKey === todayKey() ? "" : `<button type="button" class="link-btn" id="gym-day-today">Jump to today</button> — `}Pick any date on the <button type="button" class="link-btn" data-switch-view="calendar">Calendar</button> to come straight here.</p>
      <div class="panel">
        <p class="subtle">Rest day — nothing scheduled. Want to log a workout anyway?</p>
        <select id="gym-restday-type">
          <option value="" disabled selected>Pick a workout type</option>
          ${distinctDayTypes().map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>`;
    document.getElementById("gym-day-prev").addEventListener("click", () => gymJumpDay(-1));
    document.getElementById("gym-day-next").addEventListener("click", () => gymJumpDay(1));
    document.getElementById("gym-day-today")?.addEventListener("click", () => gymJumpToDate(todayKey()));
    el.querySelector('[data-switch-view="calendar"]')?.addEventListener("click", () => switchView("calendar"));
    document.getElementById("gym-restday-type").addEventListener("change", (e) => {
      restDayOverride = { dateKey: selectedDateKey, dayType: e.target.value };
      renderGymDayPanel();
    });
    return;
  }

  if (!gymDraft || gymDraft.dateKey !== selectedDateKey || gymDraft.dayType !== dayType) {
    gymDraft = buildGymDraft(selectedDateKey, dayType);
  }

  const typeOptions = distinctDayTypes().map((t) => `<option value="${t}" ${t === dayType ? "selected" : ""}>${t}</option>`).join("");

  const slots = slotsForDayType(dayType);
  const slotsHtml = slots
    .map((slot, i) => {
      const exId = gymDraft.picks[i];
      const ex = exerciseById.get(exId);
      if (!ex) return "";
      const tgt = targetForUser(historyForExercise(exId, selectedDateKey), ex);
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
    ${youtubeSearchLinkHtml(ex.name)}
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
      const tgt = targetForUser(historyForExercise(item.exerciseId, selectedDateKey), ex);
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
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div class="row" style="align-items:center;gap:8px;">
        <button type="button" class="btn small" id="gym-day-prev">&lsaquo;</button>
        <h2 style="margin:0;">${dateLabel}</h2>
        <button type="button" class="btn small" id="gym-day-next">&rsaquo;</button>
      </div>
      <select id="gym-daytype-select">${typeOptions}</select>
    </div>
    <p class="subtle small" style="margin-top:0;">${selectedDateKey === todayKey() ? "" : `<button type="button" class="link-btn" id="gym-day-today">Jump to today</button> — `}Pick any date on the <button type="button" class="link-btn" data-switch-view="calendar">Calendar</button> to come straight here.</p>
    ${warmupCooldownHtml(WARMUPS_BY_DAYTYPE[dayType], "Warm-up")}
    ${slotsHtml}
    ${warmupCooldownHtml(COOLDOWNS_BY_DAYTYPE[dayType], "Cool-down")}

    <div class="panel" style="padding:0;background:transparent;border:none;margin:0;">
      <h3>Add any other exercise</h3>
      <p class="subtle small">Not limited to today's suggestions — search the full catalog (${exerciseCatalog.length} exercises) and log anything.</p>
      <input type="text" id="gym-exercise-search" placeholder="Search exercises (e.g. lat pulldown, hip thrust)..." autocomplete="off" />
      <div id="gym-exercise-search-results"></div>
    </div>
    ${extraHtml}

    <label class="small">Notes for today's session (how it felt, anything off — the coach reads these)
      <textarea id="gym-day-notes" rows="2" placeholder="Optional">${gymDraft.notes || ""}</textarea>
    </label>
    <button type="button" class="btn primary" id="gym-save-day">Save day</button>
    <p id="gym-saved" class="subtle small" hidden>Saved.</p>
  `;

  document.getElementById("gym-daytype-select").addEventListener("change", (e) => {
    gymDraft = buildGymDraft(selectedDateKey, e.target.value);
    renderGymDayPanel();
  });

  document.getElementById("gym-day-prev").addEventListener("click", () => gymJumpDay(-1));
  document.getElementById("gym-day-next").addEventListener("click", () => gymJumpDay(1));
  document.getElementById("gym-day-today")?.addEventListener("click", () => gymJumpToDate(todayKey()));
  el.querySelector('[data-switch-view="calendar"]')?.addEventListener("click", () => switchView("calendar"));

  el.querySelectorAll("[data-slot-select]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const i = Number(e.target.dataset.slotSelect);
      gymDraft.picks[i] = Number(e.target.value);
      const ex = exerciseById.get(gymDraft.picks[i]);
      const tgt = targetForUser(historyForExercise(gymDraft.picks[i], selectedDateKey), ex);
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
    const matches = searchExercises(q, exerciseCatalog, 10);
    searchResultsEl.innerHTML = matches.length
      ? `<ul class="entry-list">${matches.map((ex) => `<li class="entry-row"><span>${ex.name} <span class="subtle small">(${ex.category})</span></span><button type="button" class="btn small" data-add-exercise="${ex.id}">Add</button></li>`).join("")}</ul>`
      : `<p class="subtle small">No matches.</p>`;

    searchResultsEl.querySelectorAll("[data-add-exercise]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const exId = Number(btn.dataset.addExercise);
        const ex = exerciseById.get(exId);
        const tgt = targetForUser(historyForExercise(exId, selectedDateKey), ex);
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

  const notes = document.getElementById("gym-day-notes")?.value.trim() || null;

  await setDoc(doc(db, "users", currentUid, "workoutLogs", gymDraft.dateKey), {
    dateKey: gymDraft.dateKey,
    dayType: gymDraft.dayType,
    entries,
    notes,
    updatedAt: Timestamp.now()
  });

  const saved = document.getElementById("gym-saved");
  if (saved) {
    saved.hidden = false;
    setTimeout(() => (saved.hidden = true), 2000);
  }
}

// Tagging a calendar event "Cardio" (see EVENT_CATEGORIES) makes the Gym
// tab aware of it — this is the "add a run to the calendar, see it reflected
// in the Gym tab" sync Adrian asked for.
function upcomingCardioEvents() {
  const today = todayKey();
  const horizon = todayKey(new Date(new Date().getTime() + 7 * 86400000));
  return calendarEvents
    .filter((e) => e.category === "Cardio" && e.dateKey >= today && e.dateKey <= horizon)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function renderGymCardioEntries() {
  const list = document.getElementById("gym-cardio-entries");
  if (!list) return;
  const warmupEl = document.getElementById("gym-cardio-warmup");
  if (warmupEl && !warmupEl.dataset.rendered) {
    warmupEl.innerHTML = warmupCooldownHtml(CARDIO_WARMUP, "Warm-up") + warmupCooldownHtml(CARDIO_COOLDOWN, "Cool-down");
    warmupEl.dataset.rendered = "1";
  }
  const upcomingEl = document.getElementById("gym-cardio-upcoming");
  if (upcomingEl) {
    const upcoming = upcomingCardioEvents();
    upcomingEl.innerHTML = upcoming.length
      ? `<p class="subtle small">Coming up: ${upcoming
          .map((e) => `${e.title} (${e.dateKey === todayKey() ? "today" : dateFromKey(e.dateKey).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })})`)
          .join(", ")}</p>`
      : "";
  }
  const heading = document.getElementById("gym-cardio-heading");
  if (heading) heading.textContent = `${selectedDateLabel()}'s cardio`;
  const today = entriesForSelectedDate().filter((e) => e.type === "cardio");
  if (!today.length) {
    list.innerHTML = `<li class="entry-row subtle">Nothing logged yet${selectedDateKey && selectedDateKey !== todayKey() ? "" : " today"}.</li>`;
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

function renderGym() {
  if (!document.getElementById("view-gym")) return;
  renderGymSplitSummary();
  renderGymCardioEntries();
  renderGymDayPanel();
}

// ---------------------------------------------------------------------
// Coach view
// ---------------------------------------------------------------------
function coachNoteHtml(note, showDelete) {
  const range = note.weekStart && note.weekEnd ? `${note.weekStart} – ${note.weekEnd}` : "";
  const list = (items) => (items && items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");
  const change = note.calorieGoalChange;
  const progressionTableHtml = note.progressionTable?.length
    ? `<h4>Next session targets</h4>
       <table class="progression-table">
         <tr><th>Exercise</th><th>This week</th><th>Next time</th></tr>
         ${note.progressionTable.map((p) => `<tr><td>${p.exercise}</td><td>${p.thisWeek}</td><td>${p.nextTime}</td></tr>`).join("")}
       </table>`
    : "";
  return `
    <div class="coach-note-meta">${range}</div>
    <p>${note.summary || ""}</p>
    ${note.wins?.length ? `<h4>Wins</h4>${list(note.wins)}` : ""}
    ${note.concerns?.length ? `<h4>Worth watching</h4>${list(note.concerns)}` : ""}
    ${note.flags?.length ? `<h4>Flagged</h4>${list(note.flags)}` : ""}
    ${note.suggestions?.length ? `<h4>Try this week</h4>${list(note.suggestions)}` : ""}
    ${progressionTableHtml}
    ${note.exerciseNotes?.length ? `<h4>Exercise notes</h4>${list(note.exerciseNotes)}` : ""}
    ${change ? `
      <p class="subtle small">Suggests ${change > 0 ? "adding" : "cutting"} ${Math.abs(change)} kcal/day.
        <button class="link-btn" data-apply-calorie="${change}">Apply</button>
      </p>` : ""}
    <p class="subtle small" style="margin-top:10px;">Not medical or nutrition advice — a rule-of-thumb estimate from your own logged data. Check with a doctor or dietitian for anything health-related.</p>
    ${showDelete ? `<button type="button" class="link-btn" data-delete-note="${note.id}">Delete this note</button>` : ""}
  `;
}

async function deleteCoachNote(id) {
  if (!currentUid) return;
  await deleteDoc(doc(db, "users", currentUid, "coachNotes", id));
}

function renderCoachNotes() {
  const el = document.getElementById("coach-notes-list");
  if (!coachNotes.length) {
    el.innerHTML = `<p class="subtle">No notes yet — check back after your coach has had a week of activity to look at.</p>`;
    return;
  }
  el.innerHTML = coachNotes
    .map((n) => `<div class="coach-note" style="margin-bottom:20px;border-top:1px solid var(--panel-border);padding-top:12px;">${coachNoteHtml(n, true)}</div>`)
    .join("");
  wireApplyButtons(el);
  el.querySelectorAll("[data-delete-note]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCoachNote(btn.dataset.deleteNote));
  });
  renderCoachPreview();
}
