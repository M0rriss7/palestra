const DIET_STORAGE_KEY = "gym-progress-diet-v1";

const DIET_MEAL_HEADERS = ["Colazione", "Pranzo", "Spuntino", "Cena", "Post cena"];

const DIET_SUB_CATEGORIES = [
  { key: "primo", match: /^Primo piatto/i, label: "PRIMO" },
  { key: "secondo", match: /^Secondo piatto/i, label: "SECONDO" },
  { key: "contorno", match: /^Contorno/i, label: "CONTORNO" },
  { key: "condimento", match: /^Condimento/i, label: "CONDIMENTO" },
  { key: "frutta", match: /^Frutta/i, label: "FRUTTA" }
];

const dietView = document.getElementById("dietView");
const dietUpload = document.getElementById("dietUpload");
const dietContent = document.getElementById("dietContent");
const dietFileInput = document.getElementById("dietFileInput");
const dietUploadError = document.getElementById("dietUploadError");

let dietData = loadDiet();

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

document.getElementById("dietBtn").addEventListener("click", openDiet);
document.getElementById("dietBackBtn").addEventListener("click", () => {
  if (typeof showHome === "function") showHome();
});
document.getElementById("dietResetBtn").addEventListener("click", resetDiet);
dietFileInput.addEventListener("change", handleDietFile);

function loadDiet() {
  try {
    return JSON.parse(localStorage.getItem(DIET_STORAGE_KEY));
  } catch (error) {
    console.warn(error);
    return null;
  }
}

function saveDiet() {
  localStorage.setItem(DIET_STORAGE_KEY, JSON.stringify(dietData));
}

function updateDietEntryCard() {
  const status = document.getElementById("dietEntryStatus");
  if (!status) return;
  status.textContent = dietData ? dietData.fileName : "Nessun file caricato";
}

function openDiet() {
  document.getElementById("homeView").classList.remove("active");
  document.getElementById("dayView").classList.remove("active");
  document.getElementById("groupsView").classList.remove("active");
  dietView.classList.add("active");
  renderDiet();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetDiet() {
  if (!confirm("Vuoi eliminare la dieta caricata? Potrai ricaricarne un'altra in qualsiasi momento.")) return;
  dietData = null;
  localStorage.removeItem(DIET_STORAGE_KEY);
  dietFileInput.value = "";
  renderDiet();
  updateDietEntryCard();
  if (typeof showToast === "function") showToast("Dieta cancellata");
}

async function handleDietFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  dietUploadError.classList.add("hidden");
  const uploadBtn = document.querySelector(".diet-upload-btn");
  const originalLabel = uploadBtn.textContent;
  uploadBtn.textContent = "Lettura in corso…";

  try {
    const rawText = await extractPdfText(file);
    const parsed = parseDietText(rawText);

    dietData = {
      fileName: file.name,
      importedAt: new Date().toISOString(),
      rawText,
      ...parsed
    };
    saveDiet();
    renderDiet();
    updateDietEntryCard();
    if (typeof showToast === "function") showToast("Dieta caricata");
  } catch (error) {
    console.warn(error);
    dietUploadError.textContent = "Non sono riuscito a leggere questo PDF. Riprova o controlla che il file non sia protetto.";
    dietUploadError.classList.remove("hidden");
  } finally {
    uploadBtn.textContent = originalLabel;
    dietFileInput.value = "";
  }
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    lines.push(...groupTextIntoLines(content.items));
  }

  return lines.join("\n");
}

function groupTextIntoLines(items) {
  const lines = [];
  let currentY = null;
  let currentLine = [];

  items.forEach(item => {
    const y = Math.round(item.transform[5]);
    if (currentY === null || Math.abs(y - currentY) > 3) {
      if (currentLine.length) lines.push(currentLine.map(i => i.str).join("").trim());
      currentLine = [item];
      currentY = y;
    } else {
      currentLine.push(item);
    }
  });
  if (currentLine.length) lines.push(currentLine.map(i => i.str).join("").trim());

  return lines.filter(line => line.length > 0);
}

function cleanLine(value) {
  return value
    .replace(/…+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/(^|\s)\.(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLine(line) {
  return /^Mail:|^Dott\.|Dietista e Preparatore|Iscrizione Albo/i.test(line);
}

function parseDietText(rawText) {
  const allLines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length && !isNoiseLine(line));

  const subsIndex = allLines.findIndex(line => /^Sostituzioni/i.test(line));
  const dayLines = subsIndex === -1 ? allLines : allLines.slice(0, subsIndex);
  const subsLines = subsIndex === -1 ? [] : allLines.slice(subsIndex + 1);

  return {
    giornataTipo: parseGiornataTipo(dayLines),
    sostituzioni: parseSostituzioni(subsLines)
  };
}

function parseGiornataTipo(lines) {
  const meals = Object.fromEntries(DIET_MEAL_HEADERS.map(name => [name, []]));
  let acqua = "";
  let totale = null;
  let currentMeal = null;

  lines.forEach(rawLine => {
    const line = cleanLine(rawLine);
    if (!line) return;

    const mealMatch = DIET_MEAL_HEADERS.find(name => line === name || line.startsWith(name + ":"));
    if (mealMatch && line === mealMatch) {
      currentMeal = mealMatch;
      return;
    }

    if (/^Acqua:/i.test(line)) {
      acqua = cleanLine(line.replace(/^Acqua:/i, ""));
      currentMeal = null;
      return;
    }

    if (/^Totale:/i.test(line)) {
      totale = parseTotale(line);
      currentMeal = null;
      return;
    }

    if (/^Schema Alimentare$|^Esempio di una giornata tipo$/i.test(line)) return;

    if (currentMeal) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        meals[currentMeal].push({
          name: line.slice(0, colonIndex).trim(),
          amount: line.slice(colonIndex + 1).trim()
        });
      } else {
        meals[currentMeal].push({ name: line, amount: "" });
      }
    }
  });

  return { meals, acqua, totale };
}

function parseTotale(line) {
  const rest = cleanLine(line.replace(/^Totale:/i, ""));
  const macroRegex = /(Pr|Li|Hc|Kcal)\s*([\d.,]+g?(?:\s*\([^)]*\))?)/g;
  const macros = [];
  let match;
  while ((match = macroRegex.exec(rest)) !== null) {
    macros.push({ label: match[1], value: match[2].trim() });
  }
  return macros.length ? macros : [{ label: "Totale", value: rest }];
}

function parseSostituzioni(lines) {
  const result = {
    colazioneDolce: { label: "COLAZIONE DOLCE", items: [] },
    colazioneSalata: { label: "COLAZIONE SALATA (max 4 volte)", items: [] },
    pranzoCena: {
      label: "Pranzo e Cena",
      sub: Object.fromEntries(DIET_SUB_CATEGORIES.map(c => [c.key, { label: c.label, items: [] }]))
    },
    altro: { label: "Altro", items: [] }
  };

  let currentTop = null;
  let currentSub = null;
  let lastItemRef = null;
  let awaitingFirstBullet = false;

  lines.forEach(rawLine => {
    const line = cleanLine(rawLine);
    if (!line) return;

    if (/^Colazione dolce/i.test(line)) {
      currentTop = "colazioneDolce";
      currentSub = null;
      lastItemRef = null;
      awaitingFirstBullet = true;
      return;
    }
    if (/^Colazione salata/i.test(line)) {
      currentTop = "colazioneSalata";
      currentSub = null;
      lastItemRef = null;
      awaitingFirstBullet = true;
      return;
    }
    if (/^Pranzo\/?Cena|^Pranzo\s*\/\s*Cena/i.test(line)) {
      currentTop = "pranzoCena";
      currentSub = null;
      lastItemRef = null;
      awaitingFirstBullet = true;
      return;
    }

    if (currentTop === "pranzoCena") {
      const subMatch = DIET_SUB_CATEGORIES.find(c => c.match.test(line));
      if (subMatch) {
        currentSub = subMatch.key;
        lastItemRef = null;
        awaitingFirstBullet = true;
        return;
      }
    }

    if (line.startsWith("-")) {
      const text = cleanLine(line.replace(/^-\s*/, ""));
      const target = getBucket(result, currentTop, currentSub);
      if (target) {
        target.items.push(text);
        lastItemRef = target.items;
        awaitingFirstBullet = false;
      }
      return;
    }

    // Riga senza trattino: se stiamo ancora aspettando il primo elenco della
    // categoria, è testo descrittivo del titolo (es. note tra parentesi) e va
    // ignorato, per non trasformarlo in una voce fasulla.
    if (awaitingFirstBullet) return;

    // Altrimenti è la prosecuzione a capo dell'ultima voce puntata.
    if (lastItemRef && lastItemRef.length) {
      lastItemRef[lastItemRef.length - 1] = cleanLine(lastItemRef[lastItemRef.length - 1] + " " + line);
    }
  });

  return result;
}

function getBucket(result, top, sub) {
  if (top === "pranzoCena") {
    if (sub) return result.pranzoCena.sub[sub];
    return null;
  }
  if (top && result[top]) return result[top];
  return null;
}

function renderDiet() {
  if (!dietData) {
    dietUpload.classList.remove("hidden");
    dietContent.classList.add("hidden");
    return;
  }

  dietUpload.classList.add("hidden");
  dietContent.classList.remove("hidden");

  document.getElementById("dietFileName").textContent = dietData.fileName;
  document.getElementById("dietRawText").textContent = dietData.rawText;

  renderDietDay(dietData.giornataTipo);
  renderDietSubs(dietData.sostituzioni);
  renderDietToc(dietData.sostituzioni);
}

function renderDietDay(giornataTipo) {
  const container = document.getElementById("dietDay");
  if (!giornataTipo) {
    container.innerHTML = `<p class="diet-empty">Non sono riuscito a riconoscere la giornata tipo in questo file.</p>`;
    return;
  }

  const mealsHtml = DIET_MEAL_HEADERS
    .filter(name => giornataTipo.meals[name]?.length)
    .map(name => `
      <div class="diet-meal-card">
        <p class="diet-meal-name">${escapeHtml(name)}</p>
        <ul class="diet-item-list">
          ${giornataTipo.meals[name].map(item => `
            <li class="diet-item-row">
              <span>${escapeHtml(item.name)}</span>
              ${item.amount ? `<span class="diet-item-amount">${escapeHtml(item.amount)}</span>` : ""}
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("");

  const extrasHtml = `
    <div class="diet-meal-card diet-extras">
      ${giornataTipo.acqua ? `<p class="diet-item-row"><span>Acqua</span><span class="diet-item-amount">${escapeHtml(giornataTipo.acqua)}</span></p>` : ""}
      ${giornataTipo.totale ? `
        <div class="diet-totals">
          ${giornataTipo.totale.map(macro => `
            <div class="diet-totals-cell">
              <strong>${escapeHtml(macro.value)}</strong>
              <span>${escapeHtml(macro.label)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;

  container.innerHTML = mealsHtml + (giornataTipo.acqua || giornataTipo.totale ? extrasHtml : "");
}

function renderDietSubs(sostituzioni) {
  const container = document.getElementById("dietSubs");
  if (!sostituzioni) {
    container.innerHTML = `<p class="diet-empty">Non ho trovato una sezione sostituzioni in questo file.</p>`;
    return;
  }

  const blocks = [];

  [sostituzioni.colazioneDolce, sostituzioni.colazioneSalata].forEach((cat, index) => {
    if (!cat.items.length) return;
    const id = index === 0 ? "sec-colazione-dolce" : "sec-colazione-salata";
    blocks.push(renderSubCategory(id, cat.label, cat.items));
  });

  DIET_SUB_CATEGORIES.forEach(c => {
    const cat = sostituzioni.pranzoCena.sub[c.key];
    if (!cat.items.length) return;
    blocks.push(renderSubCategory(`sec-${c.key}`, cat.label, cat.items));
  });

  if (sostituzioni.altro.items.length) {
    blocks.push(renderSubCategory("sec-altro", "Altre note", sostituzioni.altro.items));
  }

  container.innerHTML = blocks.length
    ? blocks.join("")
    : `<p class="diet-empty">Nessuna sostituzione riconosciuta in questo file.</p>`;
}

function renderSubCategory(id, label, items) {
  return `
    <section class="diet-category" id="${id}">
      <h4>${escapeHtml(label)}</h4>
      <ul class="diet-bullet-list">
        ${items.map(item => `<li class="diet-bullet">${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderDietToc(sostituzioni) {
  const toc = document.getElementById("dietToc");
  if (!sostituzioni) {
    toc.innerHTML = "";
    return;
  }

  const entries = [];
  if (sostituzioni.colazioneDolce.items.length) entries.push(["sec-colazione-dolce", "Colazione dolce"]);
  if (sostituzioni.colazioneSalata.items.length) entries.push(["sec-colazione-salata", "Colazione salata"]);
  DIET_SUB_CATEGORIES.forEach(c => {
    if (sostituzioni.pranzoCena.sub[c.key].items.length) entries.push([`sec-${c.key}`, c.label]);
  });

  toc.innerHTML = entries.map(([id, label]) =>
    `<button type="button" class="diet-toc-pill" data-jump="${id}">${escapeHtml(label)}</button>`
  ).join("");

  toc.querySelectorAll("[data-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
