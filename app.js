const STORAGE_KEY = "picon-counter-state-v1";
const DENSITY_ETHANOL = 0.789;
const STANDARD_GRAMS = 10;
const DAILY_LIMIT = 2;
const WEEKLY_LIMIT = 10;
const DRY_DAYS_TARGET = 2;
const PRESET_DISPLAY_NAMES = {
  demi: "Demi",
  pinte: "Pinte",
  leger: "Léger",
  schwartz: "Shwartz",
};

const PRESETS = {
  demi: { key: "demi", name: "Demi", beerMl: 250, beerAbv: 5, piconMl: 30, piconAbv: 18 },
  pinte: { key: "pinte", name: "Pinte", beerMl: 500, beerAbv: 5, piconMl: 50, piconAbv: 18 },
  leger: { key: "leger", name: "Léger", beerMl: 250, beerAbv: 4.5, piconMl: 20, piconAbv: 18 },
  schwartz: { key: "schwartz", name: "Shwartz", beerMl: 330, beerAbv: 5.2, piconMl: 35, piconAbv: 18 },
};

const PRESET_ALIASES = {
  classic: "demi",
  large: "pinte",
  light: "leger",
};

const defaultState = {
  entries: [],
  waters: [],
  recipe: { ...PRESETS.demi },
  flagsByDate: {},
  activeView: "today",
};

let state = loadState();
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const refs = {
  todayDate: $("#todayDate"),
  todayPicons: $("#todayPicons"),
  piconLabel: $("#piconLabel"),
  standardLine: $("#standardLine"),
  selectedPiconLine: $("#selectedPiconLine"),
  dailyMeter: $("#dailyMeter"),
  dailyMeterLabel: $("#dailyMeterLabel"),
  weeklyMeter: $("#weeklyMeter"),
  weeklyMeterLabel: $("#weeklyMeterLabel"),
  todayStandards: $("#todayStandards"),
  perPiconLine: $("#perPiconLine"),
  dryDays: $("#dryDays"),
  waterCount: $("#waterCount"),
  waterLine: $("#waterLine"),
  statusDot: $("#statusDot"),
  statusTitle: $("#statusTitle"),
  statusText: $("#statusText"),
  rhythmTitle: $("#rhythmTitle"),
  rhythmText: $("#rhythmText"),
  weekRose: $("#weekRose"),
  visualCaption: $("#visualCaption"),
  weekRange: $("#weekRange"),
  weekTotal: $("#weekTotal"),
  weekBars: $("#weekBars"),
  weeklyStatus: $("#weeklyStatus"),
  weeklyPause: $("#weeklyPause"),
  dashboardGauge: $("#dashboardGauge"),
  dashboardGaugeLabel: $("#dashboardGaugeLabel"),
  dashboardInsightTitle: $("#dashboardInsightTitle"),
  dashboardInsight: $("#dashboardInsight"),
  dashboardAverage: $("#dashboardAverage"),
  dashboardStreak: $("#dashboardStreak"),
  dashboardPeak: $("#dashboardPeak"),
  dashboardPeakLabel: $("#dashboardPeakLabel"),
  dashboardPace: $("#dashboardPace"),
  dashboardTrendSvg: $("#dashboardTrendSvg"),
  dashboardTrendLabels: $("#dashboardTrendLabels"),
  dashboardTypes: $("#dashboardTypes"),
  logList: $("#logList"),
  beerMl: $("#beerMl"),
  beerAbv: $("#beerAbv"),
  piconMl: $("#piconMl"),
  piconAbv: $("#piconAbv"),
  recipeGrams: $("#recipeGrams"),
  recipeStandards: $("#recipeStandards"),
  animatedGlass: $("#animatedGlass"),
  pourStream: $("#pourStream"),
  bubbleLayer: $("#bubbleLayer"),
  installButton: $("#installButton"),
};

init();

function init() {
  buildBubbles();
  bindEvents();
  syncRecipeForm();
  setView(state.activeView);
  render();
  registerServiceWorker();
}

function bindEvents() {
  $("#addButton").addEventListener("click", addPicon);
  $("#removeButton").addEventListener("click", removeLastPicon);
  $("#waterButton").addEventListener("click", addWater);
  $("#clearTodayButton").addEventListener("click", clearToday);
  $("#exportButton").addEventListener("click", exportData);
  $("#importInput").addEventListener("change", importData);
  $("#resetButton").addEventListener("click", resetAll);

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $$(".preset").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  [refs.beerMl, refs.beerAbv, refs.piconMl, refs.piconAbv].forEach((input) => {
    input.addEventListener("input", updateRecipeFromForm);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refs.installButton.hidden = false;
  });

  refs.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    refs.installButton.hidden = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return cloneDefaultState();

    return {
      ...cloneDefaultState(),
      ...saved,
      recipe: normalizeRecipe(saved.recipe),
      flagsByDate: saved.flagsByDate || {},
      entries: Array.isArray(saved.entries) ? saved.entries : [],
      waters: Array.isArray(saved.waters) ? saved.waters : [],
    };
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
}

function formatDay(key, options = {}) {
  return new Intl.DateTimeFormat("fr-FR", options).format(dateFromKey(key));
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function recipeAlcoholGrams(recipe = state.recipe) {
  const beerAlcoholMl = Number(recipe.beerMl) * (Number(recipe.beerAbv) / 100);
  const piconAlcoholMl = Number(recipe.piconMl) * (Number(recipe.piconAbv) / 100);
  return (beerAlcoholMl + piconAlcoholMl) * DENSITY_ETHANOL;
}

function recipeStandardDrinks(recipe = state.recipe) {
  return recipeAlcoholGrams(recipe) / STANDARD_GRAMS;
}

function addPicon() {
  const now = new Date();
  const recipe = sanitizeRecipe(state.recipe);
  state.entries.push({
    id: createId(),
    date: dateKey(now),
    time: now.toISOString(),
    recipe,
    standardDrinks: recipeStandardDrinks(recipe),
    grams: recipeAlcoholGrams(recipe),
  });
  saveState();
  animatePour();
  render();
}

function removeLastPicon() {
  const key = todayKey();
  const index = [...state.entries].map((entry) => entry.date).lastIndexOf(key);
  if (index === -1) return;
  state.entries.splice(index, 1);
  saveState();
  render();
}

function addWater() {
  const now = new Date();
  state.waters.push({ id: createId(), date: dateKey(now), time: now.toISOString() });
  saveState();
  render();
}

function clearToday() {
  const key = todayKey();
  if (!confirm("Effacer les Picon-bières et verres d'eau d'aujourd'hui ?")) return;
  state.entries = state.entries.filter((entry) => entry.date !== key);
  state.waters = state.waters.filter((entry) => entry.date !== key);
  saveState();
  render();
}

function resetAll() {
  if (!confirm("Vider tout le journal local ?")) return;
  state = cloneDefaultState();
  syncRecipeForm();
  setView("today");
  saveState();
  render();
}

function updateFlag(flag, value) {
  const key = todayKey();
  state.flagsByDate[key] = { ...(state.flagsByDate[key] || {}), [flag]: value };
  saveState();
  render();
}

function applyPreset(name) {
  const presetKey = PRESET_ALIASES[name] || name;
  if (!PRESETS[presetKey]) return;
  state.recipe = { ...PRESETS[presetKey] };
  syncRecipeForm();
  saveState();
  render();
}

function updateRecipeFromForm() {
  state.recipe = sanitizeRecipe({
    name: "Perso",
    beerMl: refs.beerMl.value,
    beerAbv: refs.beerAbv.value,
    piconMl: refs.piconMl.value,
    piconAbv: refs.piconAbv.value,
  });
  saveState();
  renderRecipe();
  renderPresetState();
}

function sanitizeRecipe(recipe) {
  const presetKey = PRESET_ALIASES[recipe.key] || recipe.key || "custom";
  return {
    key: presetKey,
    name: recipe.name || "Perso",
    beerMl: clamp(Number(recipe.beerMl) || 0, 50, 1000),
    beerAbv: clamp(Number(recipe.beerAbv) || 0, 0, 20),
    piconMl: clamp(Number(recipe.piconMl) || 0, 0, 120),
    piconAbv: clamp(Number(recipe.piconAbv) || 0, 0, 45),
  };
}

function normalizeRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return { ...PRESETS.demi };

  const presetKey = PRESET_ALIASES[recipe.key] || recipe.key;
  if (presetKey && PRESETS[presetKey]) {
    return { ...PRESETS[presetKey], ...recipe, key: presetKey, name: PRESETS[presetKey].name };
  }

  const legacyMatch = Object.entries(PRESETS).find(([, preset]) =>
    ["beerMl", "beerAbv", "piconMl", "piconAbv"].every((key) => Number(preset[key]) === Number(recipe[key]))
  );

  if (legacyMatch) {
    const [key, preset] = legacyMatch;
    return { ...preset, ...recipe, key, name: preset.name };
  }

  return sanitizeRecipe({ ...PRESETS.demi, ...recipe, key: "custom", name: recipe.name || "Perso" });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncRecipeForm() {
  const recipe = normalizeRecipe(state.recipe);
  state.recipe = recipe;
  refs.beerMl.value = recipe.beerMl;
  refs.beerAbv.value = recipe.beerAbv;
  refs.piconMl.value = recipe.piconMl;
  refs.piconAbv.value = recipe.piconAbv;
  renderPresetState();
}

function setView(name) {
  const viewName = ["today", "dashboard", "week", "log", "recipe"].includes(name) ? name : "today";
  state.activeView = viewName;
  $$(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  saveState();
}

function render() {
  const key = todayKey();
  const today = aggregateDay(key);
  const week = aggregateWeek(key);
  const perPicon = recipeStandardDrinks();

  refs.todayDate.textContent = formatDay(key, { weekday: "long", day: "numeric", month: "long" });
  refs.todayPicons.textContent = today.count;
  refs.piconLabel.textContent = today.count > 1 ? "Picons" : "Picon";
  refs.standardLine.textContent = `${formatNumber(today.standardDrinks)} verre standard`;
  refs.selectedPiconLine.textContent = recipeDisplayName(state.recipe);
  refs.todayStandards.textContent = formatNumber(today.standardDrinks);
  refs.perPiconLine.textContent = `1 ${recipeDisplayName(state.recipe)} = ${formatNumber(perPicon)} verre standard`;
  refs.waterCount.textContent = today.waterCount;
  refs.waterLine.textContent = today.waterCount > 1 ? "Verres d'eau notés" : "Verre d'eau noté";
  refs.dryDays.textContent = `${week.dryDays}/${DRY_DAYS_TARGET}`;

  $("#removeButton").disabled = today.count === 0;

  const dailyPercent = (today.standardDrinks / DAILY_LIMIT) * 100;
  refs.dailyMeter.style.width = `${clamp(dailyPercent, 0, 100)}%`;
  refs.weeklyMeter.style.width = `${clamp((week.standardDrinks / WEEKLY_LIMIT) * 100, 0, 100)}%`;
  refs.dailyMeterLabel.textContent = `${formatNumber(today.standardDrinks)} / ${DAILY_LIMIT}`;
  refs.weeklyMeterLabel.textContent = `${formatNumber(week.standardDrinks)} / ${WEEKLY_LIMIT}`;

  const weeklyFill = week.standardDrinks === 0 ? 0 : clamp((week.standardDrinks / WEEKLY_LIMIT) * 86 + 10, 10, 96);
  document.documentElement.style.setProperty("--fill", `${weeklyFill}%`);
  refs.animatedGlass.classList.toggle("has-liquid", week.standardDrinks > 0);

  renderStatus(today, week);
  renderRhythm(today);
  renderWeekRose(week);
  renderDashboard(today, week);
  renderWeek(week);
  renderLog();
  renderRecipe();
}

function renderStatus(today, week) {
  refs.statusDot.className = "status-dot";


  if (today.standardDrinks > DAILY_LIMIT) {
    refs.statusDot.classList.add("danger");
    refs.statusTitle.textContent = "Au-dessus du repère jour";
    refs.statusText.textContent = `Aujourd'hui : ${formatNumber(today.standardDrinks)} verres standard pour un repère de ${DAILY_LIMIT}.`;
    return;
  }

  if (week.standardDrinks > WEEKLY_LIMIT) {
    refs.statusDot.classList.add("danger");
    refs.statusTitle.textContent = "Au-dessus du repère semaine";
    refs.statusText.textContent = `Semaine : ${formatNumber(week.standardDrinks)} verres standard pour un repère de ${WEEKLY_LIMIT}.`;
    return;
  }

  if (today.standardDrinks > 0) {
    refs.statusDot.classList.add("warn");
    refs.statusTitle.textContent = "Dans le repère jour";
    refs.statusText.textContent = "Le repère français reste aussi : pas tous les jours.";
    return;
  }

  refs.statusTitle.textContent = "Journée à zéro";
  refs.statusText.textContent = "La journée compte comme jour sans alcool dans le suivi hebdomadaire.";
}

function renderRhythm(today) {
  if (today.count === 0) {
    refs.rhythmTitle.textContent = "Rien au compteur";
    refs.rhythmText.textContent = "La rosace reste lumineuse tant qu'aucun Picon-bière n'est ajouté.";
    return;
  }

  const last = today.entries[today.entries.length - 1];
  const lastTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(last.time));
  const waterGap = Math.max(0, today.count - today.waterCount);

  refs.rhythmTitle.textContent = `${today.count} Picon-bière${today.count > 1 ? "s" : ""}`;
  refs.rhythmText.textContent =
    waterGap > 0
      ? `Dernier à ${lastTime}. Eau alternée manquante : ${waterGap}.`
      : `Dernier à ${lastTime}. Alternance eau équilibrée.`;
}

function recipeDisplayName(recipe) {
  if (!recipe || typeof recipe !== "object") return "Picon";
  const key = PRESET_ALIASES[recipe.key] || recipe.key;
  if (key && PRESET_DISPLAY_NAMES[key]) return PRESET_DISPLAY_NAMES[key];
  const rawName = recipe.name || recipe.recipeName || "Perso";
  return rawName.replace(/\s+(rétro|néon|laser|noir)$/iu, "");
}

function renderWeekRose(week) {
  refs.weekRose.innerHTML = "";

  const max = Math.max(DAILY_LIMIT, ...week.days.map((day) => day.standardDrinks));
  const activeDays = week.days.filter((day) => day.standardDrinks > 0).length;
  refs.visualCaption.textContent = activeDays === 0
    ? "Rosace claire : aucun Picon-bière enregistré cette semaine."
    : `${activeDays} pétale${activeDays > 1 ? "s" : ""} ambré${activeDays > 1 ? "s" : ""} sur la semaine.`;

  week.days.forEach((day, index) => {
    const petal = document.createElement("span");
    const intensity = clamp(day.standardDrinks / max, 0, 1);
    petal.className = `rose-petal${day.date === todayKey() ? " today" : ""}`;
    petal.style.setProperty("--angle", `${index * (360 / week.days.length)}deg`);
    petal.style.setProperty("--intensity", intensity.toFixed(2));
    petal.title = `${formatDay(day.date, { weekday: "long" })} : ${formatNumber(day.standardDrinks)} verre standard`;
    petal.setAttribute("aria-label", petal.title);
    refs.weekRose.append(petal);
  });
}

function renderWeek(week) {
  refs.weekRange.textContent = `${formatDay(week.days[0].date, { day: "numeric", month: "short" })} - ${formatDay(week.days[6].date, { day: "numeric", month: "short" })}`;
  refs.weekTotal.textContent = formatNumber(week.standardDrinks);
  refs.weeklyStatus.textContent = `${formatNumber(week.standardDrinks)}/${WEEKLY_LIMIT}`;
  refs.weeklyPause.textContent = `${week.dryDays} jour${week.dryDays > 1 ? "s" : ""}`;
  refs.weekBars.innerHTML = "";

  const max = Math.max(DAILY_LIMIT, ...week.days.map((day) => day.standardDrinks));

  week.days.forEach((day) => {
    const item = document.createElement("div");
    item.className = `day-bar${day.date === todayKey() ? " today" : ""}`;

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.height = `${clamp((day.standardDrinks / max) * 100, 0, 100)}%`;
    track.append(fill);

    const label = document.createElement("span");
    label.textContent = formatDay(day.date, { weekday: "short" }).replace(".", "");
    const value = document.createElement("strong");
    value.textContent = formatNumber(day.standardDrinks);

    item.append(track, label, value);
    refs.weekBars.append(item);
  });
}

function renderDashboard(today, week) {
  const range = aggregateRange(14);
  const total = range.reduce((sum, day) => sum + day.standardDrinks, 0);
  const average = total / range.length;
  const peak = range.reduce((best, day) => (day.standardDrinks > best.standardDrinks ? day : best), range[0]);
  const piconCount = range.reduce((sum, day) => sum + day.count, 0);
  const waterCount = range.reduce((sum, day) => sum + day.waterCount, 0);
  const pace = piconCount === 0 ? 0 : Math.round(clamp((waterCount / piconCount) * 100, 0, 100));
  const weekPercent = clamp((week.standardDrinks / WEEKLY_LIMIT) * 100, 0, 140);
  const dryStreak = countDryStreak(30);

  refs.dashboardGauge.style.setProperty("--gauge", `${clamp(weekPercent, 0, 100) * 3.6}deg`);
  refs.dashboardGaugeLabel.textContent = `${Math.round(weekPercent)}%`;
  refs.dashboardAverage.textContent = formatNumber(average);
  refs.dashboardStreak.textContent = dryStreak;
  refs.dashboardPeak.textContent = formatNumber(peak.standardDrinks);
  refs.dashboardPeakLabel.textContent = peak.standardDrinks > 0 ? formatDay(peak.date, { weekday: "short", day: "numeric" }) : "Aucun jour";
  refs.dashboardPace.textContent = `${pace}%`;

  if (week.standardDrinks > WEEKLY_LIMIT) {
    refs.dashboardInsightTitle.textContent = "Signal rouge";
    refs.dashboardInsight.textContent = `La semaine est à ${formatNumber(week.standardDrinks)} verres standard, au-dessus du repère de ${WEEKLY_LIMIT}.`;
  } else if (today.standardDrinks > DAILY_LIMIT) {
    refs.dashboardInsightTitle.textContent = "Pic journalier";
    refs.dashboardInsight.textContent = `Aujourd'hui dépasse le repère de ${DAILY_LIMIT} verres standard. Le tableau conserve la trace.`;
  } else if (week.dryDays < DRY_DAYS_TARGET) {
    refs.dashboardInsightTitle.textContent = "Pause à programmer";
    refs.dashboardInsight.textContent = `Il manque ${DRY_DAYS_TARGET - week.dryDays} jour sans alcool pour atteindre le repère hebdomadaire.`;
  } else {
    refs.dashboardInsightTitle.textContent = "Radar stable";
    refs.dashboardInsight.textContent = `Semaine à ${formatNumber(week.standardDrinks)} verres standard avec ${week.dryDays} jour${week.dryDays > 1 ? "s" : ""} à zéro.`;
  }

  renderTrend(range);
  renderTypeDistribution(range);
}

function renderTrend(days) {
  const width = 320;
  const height = 150;
  const pad = 18;
  const max = Math.max(DAILY_LIMIT, ...days.map((day) => day.standardDrinks));
  const points = days.map((day, index) => {
    const x = pad + (index * (width - pad * 2)) / (days.length - 1);
    const y = height - pad - (day.standardDrinks / max) * (height - pad * 2);
    return { x, y, day };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `M ${points[0].x.toFixed(1)} ${height - pad} L ${points
    .map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" L ")} L ${points[points.length - 1].x.toFixed(1)} ${height - pad} Z`;
  const limitY = height - pad - (DAILY_LIMIT / max) * (height - pad * 2);

  refs.dashboardTrendSvg.innerHTML = `
    <defs>
      <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#ffd04d" stop-opacity="0.46" />
        <stop offset="100%" stop-color="#52d4ff" stop-opacity="0.04" />
      </linearGradient>
      <filter id="trendGlow">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <path class="trend-grid-line" d="M ${pad} ${limitY.toFixed(1)} H ${width - pad}" />
    <path class="trend-area" d="${area}" />
    <polyline class="trend-line" points="${line}" filter="url(#trendGlow)" />
    ${points
      .map((point) => `<circle class="trend-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.day.standardDrinks > DAILY_LIMIT ? 4.8 : 3.6}" />`)
      .join("")}
  `;

  refs.dashboardTrendLabels.innerHTML = `
    <span>${formatDay(days[0].date, { day: "numeric", month: "short" })}</span>
    <span>${formatDay(days[days.length - 1].date, { day: "numeric", month: "short" })}</span>
  `;
}

function renderTypeDistribution(days) {
  const counts = new Map();
  days.reduce((entries, day) => entries.concat(day.entries), []).forEach((entry) => {
    const name = recipeDisplayName(entry.recipe) || entry.recipeName || "Picon";
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  refs.dashboardTypes.innerHTML = "";

  if (counts.size === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun format consommé sur 14 jours.";
    refs.dashboardTypes.append(empty);
    return;
  }

  const max = Math.max(...counts.values());
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    const row = document.createElement("div");
    row.className = "type-row";
    row.innerHTML = `
      <span>${name}</span>
      <div class="type-track"><i style="width: ${clamp((count / max) * 100, 8, 100)}%"></i></div>
      <strong>${count}</strong>
    `;
    refs.dashboardTypes.append(row);
  });
}

function renderLog() {
  const days = uniqueDays().slice(0, 30);
  refs.logList.innerHTML = "";

  if (days.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun Picon-bière enregistré.";
    refs.logList.append(empty);
    return;
  }

  days.forEach((key) => {
    const day = aggregateDay(key);
    const row = document.createElement("article");
    row.className = "log-item";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = formatDay(key, { weekday: "long", day: "numeric", month: "long" });
    const detail = document.createElement("small");
    detail.textContent = `${day.count} Picon, ${formatNumber(day.standardDrinks)} verre standard, ${day.waterCount} eau, ${dominantType(day)}`;
    text.append(title, detail);

    const pill = document.createElement("span");
    pill.className = "log-pill";
    pill.textContent = `${formatNumber(day.standardDrinks)}`;
    row.append(text, pill);
    refs.logList.append(row);
  });
}

function renderRecipe() {
  const grams = recipeAlcoholGrams();
  const standards = recipeStandardDrinks();
  refs.recipeGrams.textContent = `${formatNumber(grams)} g d'alcool pur`;
  refs.recipeStandards.textContent = `${formatNumber(standards)} verre standard`;
  refs.selectedPiconLine.textContent = recipeDisplayName(state.recipe);
  refs.perPiconLine.textContent = `1 ${recipeDisplayName(state.recipe)} = ${formatNumber(standards)} verre standard`;
}

function renderPresetState() {
  $$(".preset").forEach((button) => {
    const preset = PRESETS[PRESET_ALIASES[button.dataset.preset] || button.dataset.preset];
    if (!preset) return;
    const active = ["beerMl", "beerAbv", "piconMl", "piconAbv"].every((key) => Number(preset[key]) === Number(state.recipe[key]));
    button.classList.toggle("active", active);
  });
}

function aggregateDay(key) {
  const entries = state.entries.filter((entry) => entry.date === key);
  const waters = state.waters.filter((entry) => entry.date === key);
  const standardDrinks = entries.reduce((total, entry) => total + Number(entry.standardDrinks || 0), 0);
  const grams = entries.reduce((total, entry) => total + Number(entry.grams || 0), 0);

  return {
    date: key,
    entries,
    waters,
    count: entries.length,
    waterCount: waters.length,
    standardDrinks,
    grams,
  };
}

function aggregateWeek(anchorKey) {
  const start = startOfWeek(dateFromKey(anchorKey));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return aggregateDay(dateKey(date));
  });
  const standardDrinks = days.reduce((total, day) => total + day.standardDrinks, 0);
  const today = todayKey();
  const dryDays = days.filter((day) => day.date <= today && day.count === 0).length;

  return { days, standardDrinks, dryDays };
}

function aggregateRange(length) {
  const end = dateFromKey(todayKey());
  return Array.from({ length }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (length - index - 1));
    return aggregateDay(dateKey(date));
  });
}

function countDryStreak(daysToCheck) {
  const end = dateFromKey(todayKey());
  let streak = 0;

  for (let index = 0; index < daysToCheck; index += 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - index);
    if (aggregateDay(dateKey(date)).count > 0) break;
    streak += 1;
  }

  return streak;
}

function dominantType(day) {
  if (day.entries.length === 0) return "pause";
  const counts = new Map();
  day.entries.forEach((entry) => {
    const name = recipeDisplayName(entry.recipe) || entry.recipeName || "Picon";
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function startOfWeek(date) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(12, 0, 0, 0);
  return start;
}

function uniqueDays() {
  return [...new Set([...state.entries.map((entry) => entry.date), ...state.waters.map((entry) => entry.date)])].sort().reverse();
}

function animatePour() {
  refs.pourStream.classList.remove("active");
  void refs.pourStream.offsetWidth;
  refs.pourStream.classList.add("active");
}

function buildBubbles() {
  refs.bubbleLayer.innerHTML = "";
  for (let index = 0; index < 34; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    bubble.style.left = `${8 + Math.random() * 84}%`;
    bubble.style.setProperty("--size", `${5 + Math.random() * 12}px`);
    bubble.style.setProperty("--duration", `${4 + Math.random() * 4}s`);
    bubble.style.setProperty("--delay", `${Math.random() * -7}s`);
    bubble.style.setProperty("--drift", `${-28 + Math.random() * 56}px`);
    refs.bubbleLayer.append(bubble);
  }
}

function exportData() {
  const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `picon-counter-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result));
      state = {
        ...cloneDefaultState(),
        ...imported,
        recipe: normalizeRecipe(imported.recipe || PRESETS.demi),
        entries: Array.isArray(imported.entries) ? imported.entries : [],
        waters: Array.isArray(imported.waters) ? imported.waters : [],
        flagsByDate: imported.flagsByDate || {},
      };
      syncRecipeForm();
      saveState();
      render();
    } catch {
      alert("Import JSON invalide.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
