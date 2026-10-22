import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, deleteDoc,
  query, orderBy, limit, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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

let entries = [];      // last 200 log entries, newest first
let goals = {};        // daily goals + vitamin list
let coachNotes = [];    // generated weekly notes, newest first

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
    document.getElementById("app").hidden = false;
    subscribeAll(user.uid);
  } else {
    currentUid = null;
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("app").hidden = true;
    teardownSubscriptions();
  }
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
  });
}

function teardownSubscriptions() {
  if (unsubEntries) unsubEntries();
  if (unsubGoals) unsubGoals();
  if (unsubCoach) unsubCoach();
  entries = [];
  goals = {};
  coachNotes = [];
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

  const weightEntries = entries.filter((e) => e.type === "weight");
  const latestWeight = weightEntries.length ? weightEntries[0].lb : null;

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
  if (!coachNotes.length) return;
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
  const today = todaysEntries();
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

function describeEntry(e) {
  switch (e.type) {
    case "food": return `🍽 ${e.name} — ${e.calories || 0} kcal${e.protein ? `, ${e.protein}g protein` : ""}`;
    case "workout": return `🏋 ${e.name}${e.sets ? ` — ${e.sets}x${e.reps || "?"}` : ""}${e.weight ? ` @ ${e.weight}lb` : ""}`;
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
const goalsForm = document.getElementById("goals-form");

function fillGoalsForm() {
  goalsForm.calorieGoal.value = goals.calorieGoal ?? "";
  goalsForm.proteinGoal.value = goals.proteinGoal ?? "";
  goalsForm.waterGoal.value = goals.waterGoal ?? "";
  goalsForm.stepsGoal.value = goals.stepsGoal ?? "";
  goalsForm.weightGoal.value = goals.weightGoal ?? "";
  goalsForm.vitaminsList.value = (goals.vitaminsList || []).join(", ");
}

goalsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const data = new FormData(goalsForm);
  const vitaminsList = (data.get("vitaminsList") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await setDoc(doc(db, "users", currentUid, "meta", "goals"), {
    calorieGoal: Number(data.get("calorieGoal")) || null,
    proteinGoal: Number(data.get("proteinGoal")) || null,
    waterGoal: Number(data.get("waterGoal")) || null,
    stepsGoal: Number(data.get("stepsGoal")) || null,
    weightGoal: Number(data.get("weightGoal")) || null,
    vitaminsList
  }, { merge: true });

  const saved = document.getElementById("goals-saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 2000);
});

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
