const STORAGE_KEY = "gym-progress-v3-data";
const THEME_KEY = "gym-progress-v2-theme";

const SCHEDA_IDS = ["scheda-1", "scheda-2", "scheda-3", "scheda-4"];
const DEFAULT_LABELS = {
  "scheda-1": "Scheda 1",
  "scheda-2": "Scheda 2",
  "scheda-3": "Scheda 3",
  "scheda-4": "Scheda 4"
};

const MUSCLE_GROUPS = [
  "Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti", "Avambracci",
  "Addominali", "Quadricipiti", "Femorali", "Glutei", "Polpacci", "Cardio/Altro"
];

let state = loadState();
let currentDayId = null;
let editingExerciseId = null;

const $ = id => document.getElementById(id);

const homeView = $("homeView");
const dayView = $("dayView");
const groupsView = $("groupsView");
const dayGrid = $("dayGrid");
const exerciseList = $("exerciseList");
const emptyState = $("emptyState");
const exerciseModal = $("exerciseModal");
const settingsModal = $("settingsModal");
const exerciseForm = $("exerciseForm");
const toast = $("toast");

populateGroupSelect();
applyTheme();
renderHome();

$("themeToggle").addEventListener("click", toggleTheme);
$("openSettingsBtn").addEventListener("click", () => openSettings(false));
$("dayMenuBtn").addEventListener("click", () => openSettings(true));
$("backBtn").addEventListener("click", showHome);
$("addExerciseBtn").addEventListener("click", () => openExerciseModal());
$("saveSessionBtn").addEventListener("click", saveSession);
$("renameSchedaBtn").addEventListener("click", renameCurrentScheda);
$("groupsBtn").addEventListener("click", openGroups);
$("groupsBackBtn").addEventListener("click", showHome);

exerciseForm.addEventListener("submit", saveExercise);

document.addEventListener("click", event => {
  const dayButton = event.target.closest("[data-day-id]");
  const toggleButton = event.target.closest("[data-toggle-id]");
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (dayButton) openDay(dayButton.dataset.dayId);
  if (toggleButton) toggleExercise(toggleButton.dataset.toggleId);
  if (editButton) openExerciseModal(editButton.dataset.editId);
  if (deleteButton) deleteExercise(deleteButton.dataset.deleteId);

  if (event.target.closest("[data-close-exercise]")) closeExerciseModal();
  if (event.target.closest("[data-close-settings]")) closeSettings();
});

$("resetCurrentDayBtn").addEventListener("click", resetCurrentDay);
$("resetAllBtn").addEventListener("click", resetAll);

function populateGroupSelect() {
  const select = $("exerciseGroup");
  select.innerHTML = MUSCLE_GROUPS.map(group => `<option value="${group}">${group}</option>`).join("");
}

function defaultState() {
  return {
    schede: Object.fromEntries(
      SCHEDA_IDS.map(id => [id, { label: DEFAULT_LABELS[id], exercises: [], sessions: [] }])
    )
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.schede) {
      SCHEDA_IDS.forEach(id => {
        if (!parsed.schede[id]) {
          parsed.schede[id] = { label: DEFAULT_LABELS[id], exercises: [], sessions: [] };
        }
      });
      return parsed;
    }
  } catch (error) {
    console.warn(error);
  }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isCompletedThisWeek(sessions) {
  if (!sessions?.length) return false;
  const weekStart = getWeekStart();
  return sessions.some(session => new Date(session.date) >= weekStart);
}

function lastSessionDate(sessions) {
  if (!sessions?.length) return null;
  return sessions[0].date;
}

function renderHome() {
  dayGrid.innerHTML = "";

  SCHEDA_IDS.forEach((id, index) => {
    const data = state.schede[id];
    const exerciseCount = data.exercises.length;
    const completed = isCompletedThisWeek(data.sessions);
    const lastDate = lastSessionDate(data.sessions);

    const button = document.createElement("button");
    button.className = `day-card ${completed ? "completed" : ""}`;
    button.dataset.dayId = id;
    button.innerHTML = `
      <div class="day-card-top">
        <span class="day-index">${completed ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <span class="day-status">${completed ? "Svolta questa settimana" : `${exerciseCount} esercizi`}</span>
      </div>
      <h2>${escapeHtml(data.label)}</h2>
      <p>${lastDate ? `Ultima: ${formatDate(lastDate)}` : (exerciseCount ? "Apri la scheda e aggiorna gli esercizi" : "Crea la tua scheda")}</p>
    `;
    dayGrid.appendChild(button);
  });

  const completedSchede = SCHEDA_IDS.filter(id => isCompletedThisWeek(state.schede[id].sessions)).length;
  $("weekProgress").textContent = `${completedSchede}/4 completate`;
  $("totalExercises").textContent = SCHEDA_IDS.reduce((sum, id) => sum + state.schede[id].exercises.length, 0);
  $("totalSessions").textContent = SCHEDA_IDS.reduce((sum, id) => sum + state.schede[id].sessions.length, 0);
  $("totalGroups").textContent = countActiveGroups();
  if (typeof updateDietEntryCard === "function") updateDietEntryCard();
}

function countActiveGroups() {
  const groups = new Set();
  SCHEDA_IDS.forEach(id => {
    state.schede[id].exercises.forEach(ex => groups.add(ex.muscleGroup));
  });
  return groups.size;
}

function openDay(dayId) {
  currentDayId = dayId;
  homeView.classList.remove("active");
  groupsView.classList.remove("active");
  if (typeof dietView !== "undefined") dietView.classList.remove("active");
  dayView.classList.add("active");
  $("currentDayTitle").textContent = currentDay().label;
  $("currentDayDate").textContent = "Scheda";
  renderDay();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openGroups() {
  homeView.classList.remove("active");
  dayView.classList.remove("active");
  if (typeof dietView !== "undefined") dietView.classList.remove("active");
  groupsView.classList.add("active");
  renderGroups();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderGroups() {
  const counts = Object.fromEntries(MUSCLE_GROUPS.map(group => [group, 0]));
  SCHEDA_IDS.forEach(id => {
    state.schede[id].exercises.forEach(ex => {
      if (counts[ex.muscleGroup] !== undefined) counts[ex.muscleGroup] += 1;
    });
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(entry => entry[1]));

  $("groupsList").innerHTML = entries.map(([group, count]) => `
    <div class="group-row">
      <span class="group-label">${escapeHtml(group)}</span>
      <div class="group-bar-track">
        <div class="group-bar-fill" style="width:${(count / max) * 100}%"></div>
      </div>
      <span class="group-count">${String(count).padStart(2, "0")}</span>
    </div>
  `).join("");
}

function showHome() {
  currentDayId = null;
  dayView.classList.remove("active");
  groupsView.classList.remove("active");
  if (typeof dietView !== "undefined") dietView.classList.remove("active");
  homeView.classList.add("active");
  renderHome();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function currentDay() {
  return state.schede[currentDayId];
}

function renameCurrentScheda() {
  if (!currentDayId) return;
  const current = currentDay();
  const input = prompt("Nome della scheda", current.label);
  if (input === null) return;
  const trimmed = input.trim();
  if (!trimmed) return;

  current.label = trimmed.slice(0, 40);
  saveState();
  $("currentDayTitle").textContent = current.label;
  showToast("Scheda rinominata");
}

function renderDay() {
  const day = currentDay();
  exerciseList.innerHTML = "";

  day.exercises.forEach(exercise => {
    const card = document.createElement("article");
    card.className = `exercise-card ${exercise.completed ? "done" : ""}`;

    card.innerHTML = `
      <div class="exercise-top">
        <div class="exercise-title">
          <button class="complete-toggle" data-toggle-id="${exercise.id}">✓</button>
          <div>
            <div class="exercise-name">${escapeHtml(exercise.name)}</div>
            <div class="exercise-meta">
              ${exercise.sets} serie · ${escapeHtml(exercise.reps)} rip.
            </div>
          </div>
        </div>
        <span class="group-badge">${escapeHtml(exercise.muscleGroup)}</span>
      </div>

      ${exercise.notes ? `<div class="exercise-notes">${escapeHtml(exercise.notes)}</div>` : ""}

      <div class="exercise-actions">
        <button class="action-button primary" data-edit-id="${exercise.id}">Modifica</button>
        <button class="action-button danger" data-delete-id="${exercise.id}">Elimina</button>
      </div>
    `;

    exerciseList.appendChild(card);
  });

  const total = day.exercises.length;
  const completed = day.exercises.filter(ex => ex.completed).length;
  const totalSets = day.exercises.reduce((sum, ex) => sum + Number(ex.sets), 0);

  $("completedCount").textContent = `${completed}/${total}`;
  $("dayVolume").textContent = String(totalSets);
  emptyState.classList.toggle("hidden", total > 0);

  const allDone = total > 0 && completed === total;
  $("completionBanner").classList.toggle("hidden", !allDone);
}

function openExerciseModal(exerciseId = null) {
  editingExerciseId = exerciseId;
  const exercise = exerciseId
    ? currentDay().exercises.find(item => item.id === exerciseId)
    : null;

  $("exerciseModalEyebrow").textContent = exercise ? "Modifica esercizio" : "Nuovo esercizio";
  $("exerciseModalTitle").textContent = exercise ? exercise.name : "Aggiungi esercizio";
  $("exerciseName").value = exercise?.name ?? "";
  $("exerciseGroup").value = exercise?.muscleGroup ?? MUSCLE_GROUPS[0];
  $("exerciseSets").value = exercise?.sets ?? 1;
  $("exerciseReps").value = exercise?.reps ?? "";
  $("exerciseNotes").value = exercise?.notes ?? "";

  exerciseModal.classList.remove("hidden");
  setTimeout(() => $("exerciseName").focus(), 80);
}

function closeExerciseModal() {
  editingExerciseId = null;
  exerciseModal.classList.add("hidden");
  exerciseForm.reset();
}

function saveExercise(event) {
  event.preventDefault();

  const name = $("exerciseName").value.trim();
  const muscleGroup = $("exerciseGroup").value;
  const sets = Number($("exerciseSets").value);
  const reps = $("exerciseReps").value.trim();
  const notes = $("exerciseNotes").value.trim();

  if (!name || !reps || sets < 1) return;

  const day = currentDay();

  if (editingExerciseId) {
    const exercise = day.exercises.find(item => item.id === editingExerciseId);
    Object.assign(exercise, { name, muscleGroup, sets, reps, notes });
    showToast("Esercizio aggiornato");
  } else {
    day.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      muscleGroup,
      sets,
      reps,
      notes,
      completed: false
    });
    showToast("Esercizio aggiunto");
  }

  saveState();
  closeExerciseModal();
  renderDay();
}

function toggleExercise(id) {
  const exercise = currentDay().exercises.find(item => item.id === id);
  if (!exercise) return;
  exercise.completed = !exercise.completed;
  saveState();
  renderDay();
}

function deleteExercise(id) {
  const exercise = currentDay().exercises.find(item => item.id === id);
  if (!exercise) return;

  if (!confirm(`Vuoi eliminare “${exercise.name}”?`)) return;

  currentDay().exercises = currentDay().exercises.filter(item => item.id !== id);
  saveState();
  renderDay();
  showToast("Esercizio eliminato");
}

function saveSession() {
  const day = currentDay();
  if (!day.exercises.length) {
    showToast("Aggiungi almeno un esercizio");
    return;
  }

  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: new Date().toISOString(),
    exercises: day.exercises.map(ex => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: ex.sets,
      reps: ex.reps,
      notes: ex.notes
    }))
  };

  day.sessions.unshift(session);
  day.sessions = day.sessions.slice(0, 50);
  day.exercises.forEach(ex => ex.completed = false);

  saveState();
  renderDay();
  showToast("Allenamento salvato");
}

function openSettings(fromDay) {
  $("resetCurrentDayBtn").style.display = fromDay ? "block" : "none";
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

function resetCurrentDay() {
  if (!currentDayId) return;
  const label = currentDay().label;
  if (!confirm(`Vuoi cancellare tutta la ${label}?`)) return;

  state.schede[currentDayId] = { label, exercises: [], sessions: [] };
  saveState();
  closeSettings();
  renderDay();
  showToast("Scheda cancellata");
}

function resetAll() {
  if (!confirm("Vuoi cancellare tutte le schede e gli esercizi?")) return;

  state = defaultState();
  saveState();
  closeSettings();

  if (currentDayId) renderDay();
  else renderHome();

  showToast("App completamente azzerata");
}

function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark-mode", dark);
  $("themeToggle").textContent = dark ? "☀️" : "🌙";
}

function toggleTheme() {
  const dark = document.body.classList.toggle("dark-mode");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  $("themeToggle").textContent = dark ? "☀️" : "🌙";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1900);
}

if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=21").catch(console.warn);
  });
}
