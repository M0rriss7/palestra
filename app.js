const STORAGE_KEY = "gym-progress-data-v2";
const LEGACY_STORAGE_KEY = "gym-progress-data-v1";
const THEME_KEY = "gym-progress-theme";

let state = loadState();
let editingExerciseId = null;

const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");
const exerciseForm = document.getElementById("exerciseForm");
const exerciseName = document.getElementById("exerciseName");
const exerciseKg = document.getElementById("exerciseKg");
const exerciseReps = document.getElementById("exerciseReps");
const setupList = document.getElementById("setupList");
const workoutList = document.getElementById("workoutList");
const setupEmpty = document.getElementById("setupEmpty");
const workoutEmpty = document.getElementById("workoutEmpty");
const exerciseCount = document.getElementById("exerciseCount");
const editModal = document.getElementById("editModal");
const modalTitle = document.getElementById("modalTitle");
const modalKg = document.getElementById("modalKg");
const modalReps = document.getElementById("modalReps");
const confirmKgBtn = document.getElementById("confirmKgBtn");
const saveWorkoutBtn = document.getElementById("saveWorkoutBtn");
const historyList = document.getElementById("historyList");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");
const toast = document.getElementById("toast");

document.getElementById("workoutDate").textContent = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long"
}).format(new Date());

applySavedTheme();

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.page).classList.add("active");
  });
});

exerciseForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = exerciseName.value.trim();
  const kg = Number(exerciseKg.value);
  const reps = Number(exerciseReps.value);

  if (!name || Number.isNaN(kg) || kg < 0 || Number.isNaN(reps) || reps < 1) return;

  state.exercises.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    kg,
    reps
  });

  saveState();
  exerciseForm.reset();
  exerciseName.focus();
  render();
  showToast("Esercizio aggiunto");
});

document.addEventListener("click", event => {
  const editBtn = event.target.closest("[data-edit-id]");
  const deleteBtn = event.target.closest("[data-delete-id]");
  const closeTarget = event.target.closest("[data-close-modal]");

  if (editBtn) openEditModal(editBtn.dataset.editId);
  if (deleteBtn) deleteExercise(deleteBtn.dataset.deleteId);
  if (closeTarget) closeEditModal();
});

confirmKgBtn.addEventListener("click", () => {
  const kg = Number(modalKg.value);
  const reps = Number(modalReps.value);

  if (
    Number.isNaN(kg) || kg < 0 ||
    Number.isNaN(reps) || reps < 1 ||
    !editingExerciseId
  ) return;

  const exercise = state.exercises.find(item => item.id === editingExerciseId);
  if (!exercise) return;

  exercise.kg = kg;
  exercise.reps = reps;
  saveState();
  closeEditModal();
  render();
  showToast("Esercizio aggiornato");
});

saveWorkoutBtn.addEventListener("click", () => {
  if (state.exercises.length === 0) {
    showToast("Aggiungi almeno un esercizio");
    return;
  }

  state.history.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: new Date().toISOString(),
    exercises: state.exercises.map(item => ({
      name: item.name,
      kg: item.kg,
      reps: item.reps
    }))
  });

  state.history = state.history.slice(0, 20);
  saveState();
  render();
  showToast("Allenamento salvato");
});

resetBtn.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Vuoi cancellare tutti gli esercizi, i pesi, le ripetizioni e lo storico?"
  );
  if (!confirmed) return;

  state = { exercises: [], history: [] };
  saveState();
  render();
  showToast("Scheda azzerata");
});

themeToggle.addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark-mode");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  updateThemeButton(dark);
});

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = saved ? saved === "dark" : prefersDark;

  document.body.classList.toggle("dark-mode", dark);
  updateThemeButton(dark);
}

function updateThemeButton(dark) {
  themeToggle.textContent = dark ? "☀️" : "🌙";
  themeToggle.setAttribute(
    "aria-label",
    dark ? "Attiva modalità chiara" : "Attiva modalità scura"
  );
}

function openEditModal(id) {
  const exercise = state.exercises.find(item => item.id === id);
  if (!exercise) return;

  editingExerciseId = id;
  modalTitle.textContent = exercise.name;
  modalKg.value = exercise.kg;
  modalReps.value = exercise.reps ?? 1;
  editModal.classList.remove("hidden");
  setTimeout(() => modalKg.select(), 50);
}

function closeEditModal() {
  editingExerciseId = null;
  editModal.classList.add("hidden");
}

function deleteExercise(id) {
  const exercise = state.exercises.find(item => item.id === id);
  if (!exercise) return;

  const confirmed = window.confirm(`Vuoi eliminare “${exercise.name}”?`);
  if (!confirmed) return;

  state.exercises = state.exercises.filter(item => item.id !== id);
  saveState();
  render();
  showToast("Esercizio eliminato");
}

function render() {
  exerciseCount.textContent = state.exercises.length;
  setupList.innerHTML = "";
  workoutList.innerHTML = "";

  state.exercises.forEach(exercise => {
    setupList.appendChild(createExerciseRow(exercise, true));
    workoutList.appendChild(createExerciseRow(exercise, false));
  });

  const isEmpty = state.exercises.length === 0;
  setupEmpty.classList.toggle("hidden", !isEmpty);
  workoutEmpty.classList.toggle("hidden", !isEmpty);

  renderHistory();
}

function createExerciseRow(exercise, allowDelete) {
  const row = document.createElement("article");
  row.className = "exercise-row";

  row.innerHTML = `
    <div class="exercise-main">
      <div class="exercise-name">${escapeHtml(exercise.name)}</div>
      <div class="exercise-weight">
        ${formatKg(exercise.kg)} kg · ${Number(exercise.reps ?? 1)} ripetizioni
      </div>
    </div>
    <div class="exercise-actions">
      <button class="edit-button" data-edit-id="${exercise.id}" aria-label="Modifica ${escapeHtml(exercise.name)}">
        Modifica
      </button>
      ${allowDelete ? `<button class="delete-button" data-delete-id="${exercise.id}" aria-label="Elimina ${escapeHtml(exercise.name)}">Elimina</button>` : ""}
    </div>
  `;

  return row;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (state.history.length === 0) {
    historyList.innerHTML = `<div class="empty-state"><p>Nessun allenamento salvato.</p></div>`;
    return;
  }

  state.history.forEach(workout => {
    const item = document.createElement("article");
    item.className = "history-item";

    const date = new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(workout.date));

    const summary = workout.exercises
      .map(exercise =>
        `${escapeHtml(exercise.name)}: ${formatKg(exercise.kg)} kg × ${Number(exercise.reps ?? 1)}`
      )
      .join("<br>");

    item.innerHTML = `
      <div class="history-date">${date}</div>
      <div class="history-summary">${summary}</div>
    `;

    historyList.appendChild(item);
  });
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    }

    const stored = raw ? JSON.parse(raw) : null;

    if (stored && Array.isArray(stored.exercises) && Array.isArray(stored.history)) {
      stored.exercises = stored.exercises.map(item => ({
        ...item,
        reps: Number(item.reps ?? 1)
      }));

      stored.history = stored.history.map(workout => ({
        ...workout,
        exercises: Array.isArray(workout.exercises)
          ? workout.exercises.map(item => ({
              ...item,
              reps: Number(item.reps ?? 1)
            }))
          : []
      }));

      return stored;
    }
  } catch (error) {
    console.warn("Impossibile caricare i dati salvati.", error);
  }

  return { exercises: [], history: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatKg(value) {
  return Number(value).toLocaleString("it-IT", {
    maximumFractionDigits: 2
  });
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
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.warn);
  });
}

render();
