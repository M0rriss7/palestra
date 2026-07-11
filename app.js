const STORAGE_KEY = "gym-progress-v2-data";
const THEME_KEY = "gym-progress-v2-theme";
const DAYS = [
  { id: "monday", label: "Lunedì" },
  { id: "tuesday", label: "Martedì" },
  { id: "thursday", label: "Giovedì" },
  { id: "friday", label: "Venerdì" }
];

let state = loadState();
let currentDayId = null;
let editingExerciseId = null;

const $ = id => document.getElementById(id);

const homeView = $("homeView");
const dayView = $("dayView");
const dayGrid = $("dayGrid");
const exerciseList = $("exerciseList");
const emptyState = $("emptyState");
const exerciseModal = $("exerciseModal");
const historyModal = $("historyModal");
const settingsModal = $("settingsModal");
const exerciseForm = $("exerciseForm");
const toast = $("toast");

applyTheme();
renderHome();

$("themeToggle").addEventListener("click", toggleTheme);
$("openSettingsBtn").addEventListener("click", () => openSettings(false));
$("dayMenuBtn").addEventListener("click", () => openSettings(true));
$("backBtn").addEventListener("click", showHome);
$("addExerciseBtn").addEventListener("click", () => openExerciseModal());
$("saveSessionBtn").addEventListener("click", saveSession);

exerciseForm.addEventListener("submit", saveExercise);

document.addEventListener("click", event => {
  const dayButton = event.target.closest("[data-day-id]");
  const toggleButton = event.target.closest("[data-toggle-id]");
  const editButton = event.target.closest("[data-edit-id]");
  const historyButton = event.target.closest("[data-history-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (dayButton) openDay(dayButton.dataset.dayId);
  if (toggleButton) toggleExercise(toggleButton.dataset.toggleId);
  if (editButton) openExerciseModal(editButton.dataset.editId);
  if (historyButton) openHistory(historyButton.dataset.historyId);
  if (deleteButton) deleteExercise(deleteButton.dataset.deleteId);

  if (event.target.closest("[data-close-exercise]")) closeExerciseModal();
  if (event.target.closest("[data-close-history]")) closeHistoryModal();
  if (event.target.closest("[data-close-settings]")) closeSettings();
});

$("resetCurrentDayBtn").addEventListener("click", resetCurrentDay);
$("resetAllBtn").addEventListener("click", resetAll);

function defaultState() {
  return {
    days: Object.fromEntries(
      DAYS.map(day => [day.id, { exercises: [], sessions: [], completedThisWeek: false }])
    )
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.days) {
      DAYS.forEach(day => {
        if (!parsed.days[day.id]) {
          parsed.days[day.id] = { exercises: [], sessions: [], completedThisWeek: false };
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

function renderHome() {
  dayGrid.innerHTML = "";

  DAYS.forEach((day, index) => {
    const data = state.days[day.id];
    const exerciseCount = data.exercises.length;
    const completed = data.completedThisWeek;

    const button = document.createElement("button");
    button.className = `day-card ${completed ? "completed" : ""}`;
    button.dataset.dayId = day.id;
    button.innerHTML = `
      <div class="day-card-top">
        <span class="day-index">${completed ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <span class="day-status">${completed ? "Completato" : `${exerciseCount} esercizi`}</span>
      </div>
      <h2>${day.label}</h2>
      <p>${exerciseCount ? "Apri la scheda e aggiorna i carichi" : "Crea la tua scheda"}</p>
    `;
    dayGrid.appendChild(button);
  });

  const completedDays = DAYS.filter(day => state.days[day.id].completedThisWeek).length;
  $("weekProgress").textContent = `${completedDays}/4 completati`;
  $("totalExercises").textContent = DAYS.reduce((sum, day) => sum + state.days[day.id].exercises.length, 0);
  $("totalSessions").textContent = DAYS.reduce((sum, day) => sum + state.days[day.id].sessions.length, 0);
  $("totalPRs").textContent = countPRs();
}

function countPRs() {
  let total = 0;
  DAYS.forEach(day => {
    state.days[day.id].exercises.forEach(exercise => {
      if (exercise.history?.length > 1) {
        const values = exercise.history.map(item => Number(item.kg));
        const max = Math.max(...values);
        if (Number(exercise.kg) >= max) total += 1;
      }
    });
  });
  return total;
}

function openDay(dayId) {
  currentDayId = dayId;
  homeView.classList.remove("active");
  dayView.classList.add("active");
  $("currentDayTitle").textContent = DAYS.find(day => day.id === dayId).label;
  renderDay();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  currentDayId = null;
  dayView.classList.remove("active");
  homeView.classList.add("active");
  renderHome();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function currentDay() {
  return state.days[currentDayId];
}

function renderDay() {
  const day = currentDay();
  exerciseList.innerHTML = "";

  day.exercises.forEach(exercise => {
    const card = document.createElement("article");
    card.className = `exercise-card ${exercise.completed ? "done" : ""}`;

    const maxHistory = exercise.history?.length
      ? Math.max(...exercise.history.map(item => Number(item.kg)))
      : Number(exercise.kg);
    const isPR = exercise.history?.length > 1 && Number(exercise.kg) >= maxHistory;

    card.innerHTML = `
      <div class="exercise-top">
        <div class="exercise-title">
          <button class="complete-toggle" data-toggle-id="${exercise.id}">✓</button>
          <div>
            <div class="exercise-name">${escapeHtml(exercise.name)}</div>
            <div class="exercise-meta">
              ${formatKg(exercise.kg)} kg · ${exercise.sets} serie · ${exercise.reps} rip.
            </div>
          </div>
        </div>
        ${isPR ? `<span class="pr-badge">🏆 PR</span>` : ""}
      </div>

      ${exercise.notes ? `<div class="exercise-notes">${escapeHtml(exercise.notes)}</div>` : ""}

      <div class="exercise-actions">
        <button class="action-button primary" data-edit-id="${exercise.id}">Modifica</button>
        <button class="action-button" data-history-id="${exercise.id}">Storico</button>
        <button class="action-button danger" data-delete-id="${exercise.id}">Elimina</button>
      </div>
    `;

    exerciseList.appendChild(card);
  });

  const total = day.exercises.length;
  const completed = day.exercises.filter(ex => ex.completed).length;
  const volume = day.exercises.reduce(
    (sum, ex) => sum + Number(ex.kg) * Number(ex.sets) * Number(ex.reps),
    0
  );

  $("completedCount").textContent = `${completed}/${total}`;
  $("dayVolume").textContent = `${formatKg(volume)} kg`;
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
  $("exerciseKg").value = exercise?.kg ?? 0;
  $("exerciseSets").value = exercise?.sets ?? 1;
  $("exerciseReps").value = exercise?.reps ?? 1;
  $("exerciseNotes").value = exercise?.notes ?? "";
  $("saveToHistory").checked = true;

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
  const kg = Number($("exerciseKg").value);
  const sets = Number($("exerciseSets").value);
  const reps = Number($("exerciseReps").value);
  const notes = $("exerciseNotes").value.trim();
  const saveHistory = $("saveToHistory").checked;

  if (!name || kg < 0 || sets < 1 || reps < 1) return;

  const day = currentDay();
  const timestamp = new Date().toISOString();

  if (editingExerciseId) {
    const exercise = day.exercises.find(item => item.id === editingExerciseId);
    const oldKg = Number(exercise.kg);

    Object.assign(exercise, { name, kg, sets, reps, notes });

    if (saveHistory && kg !== oldKg) {
      exercise.history = exercise.history || [];
      exercise.history.push({ date: timestamp, kg, sets, reps });
    }
    showToast(kg > oldKg ? "Nuovo carico salvato 🏆" : "Esercizio aggiornato");
  } else {
    day.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      kg,
      sets,
      reps,
      notes,
      completed: false,
      history: [{ date: timestamp, kg, sets, reps }]
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
      kg: ex.kg,
      sets: ex.sets,
      reps: ex.reps,
      notes: ex.notes
    }))
  };

  day.sessions.unshift(session);
  day.sessions = day.sessions.slice(0, 50);
  day.completedThisWeek = true;
  day.exercises.forEach(ex => ex.completed = false);

  saveState();
  renderDay();
  showToast("Allenamento salvato");
}

function openHistory(id) {
  const exercise = currentDay().exercises.find(item => item.id === id);
  if (!exercise) return;

  $("historyTitle").textContent = exercise.name;
  const history = [...(exercise.history || [])].reverse();
  const entries = $("historyEntries");

  entries.innerHTML = history.length
    ? history.map(item => `
        <div class="history-entry">
          <strong>${formatDate(item.date)}</strong>
          <span>${formatKg(item.kg)} kg · ${item.sets}×${item.reps}</span>
        </div>
      `).join("")
    : `<div class="empty-state"><p>Nessuno storico disponibile.</p></div>`;

  historyModal.classList.remove("hidden");
  drawChart(exercise.history || []);
}

function closeHistoryModal() {
  historyModal.classList.add("hidden");
}

function drawChart(history) {
  const canvas = $("historyChart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 680;
  const cssHeight = 220;

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const styles = getComputedStyle(document.body);
  const muted = styles.getPropertyValue("--muted").trim();
  const text = styles.getPropertyValue("--text").trim();
  const line = styles.getPropertyValue("--line").trim();

  if (!history.length) {
    ctx.fillStyle = muted;
    ctx.font = "14px -apple-system";
    ctx.textAlign = "center";
    ctx.fillText("Nessun dato", cssWidth / 2, cssHeight / 2);
    return;
  }

  const values = history.map(item => Number(item.kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = 28;
  const span = max - min || 1;

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = padding + ((cssHeight - padding * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(cssWidth - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = text;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = values.length === 1
      ? cssWidth / 2
      : padding + (index / (values.length - 1)) * (cssWidth - padding * 2);
    const y = cssHeight - padding - ((value - min) / span) * (cssHeight - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = text;
  values.forEach((value, index) => {
    const x = values.length === 1
      ? cssWidth / 2
      : padding + (index / (values.length - 1)) * (cssWidth - padding * 2);
    const y = cssHeight - padding - ((value - min) / span) * (cssHeight - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
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
  const label = DAYS.find(day => day.id === currentDayId).label;
  if (!confirm(`Vuoi cancellare tutta la scheda di ${label}?`)) return;

  state.days[currentDayId] = { exercises: [], sessions: [], completedThisWeek: false };
  saveState();
  closeSettings();
  renderDay();
  showToast("Scheda cancellata");
}

function resetAll() {
  if (!confirm("Vuoi cancellare tutte le schede, gli esercizi e lo storico?")) return;

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

function formatKg(value) {
  return Number(value).toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
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
    navigator.serviceWorker.register("service-worker.js?v=20").catch(console.warn);
  });
}
