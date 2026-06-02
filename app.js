const STORAGE_KEY = "picon-counter-state-v1";
const DENSITY_ETHANOL = 0.789;
const STANDARD_GRAMS = 10;
const DAILY_LIMIT = 2;
const WEEKLY_LIMIT = 10;
const DRY_DAYS_TARGET = 2;
const SCHEMA_VERSION = 2;
const CONTEXT_TAGS = ["apéro", "repas", "fête", "stress", "solitude", "fatigue", "pression sociale", "envie réelle", "autre"];
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
  schemaVersion: SCHEMA_VERSION,
  entries: [],
  waters: [],
  recipe: { ...PRESETS.demi },
  flagsByDate: {},
  activeView: "today",
  selectedTags: [],
  settings: {
    discreetMode: false,
    goalMode: "observe",
    weeklyGoal: WEEKLY_LIMIT,
    dryDaysGoal: DRY_DAYS_TARGET,
  },
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
  weekMarkers: $("#weekMarkers"),
  visualIllustration: $("#visualIllustration"),
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
  dashboardTags: $("#dashboardTags"),
  logList: $("#logList"),
  quickTagList: $("#quickTagList"),
  goalMode: $("#goalMode"),
  weeklyGoal: $("#weeklyGoal"),
  dryDaysGoal: $("#dryDaysGoal"),
  goalFeedback: $("#goalFeedback"),
  discreetMode: $("#discreetMode"),
  privacyNote: $("#privacyNote"),
  importStatus: $("#importStatus"),
  updateBanner: $("#updateBanner"),
  reloadButton: $("#reloadButton"),
  editDialog: $("#editDialog"),
  editForm: $("#editForm"),
  editId: $("#editId"),
  editKind: $("#editKind"),
  editKindLabel: $("#editKindLabel"),
  editDate: $("#editDate"),
  editTime: $("#editTime"),
  editPreset: $("#editPreset"),
  editBeerMl: $("#editBeerMl"),
  editBeerAbv: $("#editBeerAbv"),
  editPiconMl: $("#editPiconMl"),
  editPiconAbv: $("#editPiconAbv"),
  editTagList: $("#editTagList"),
  deleteEditButton: $("#deleteEditButton"),
  saveEditButton: $("#saveEditButton"),
  beerMl: $("#beerMl"),
  beerAbv: $("#beerAbv"),
  piconMl: $("#piconMl"),
  piconAbv: $("#piconAbv"),
  recipeGrams: $("#recipeGrams"),
  recipeStandards: $("#recipeStandards"),
  animatedGlass: $("#animatedGlass"),
  pourStream: $("#pourStream"),
  thresholdAlert: $("#thresholdAlert"),
  bubbleLayer: $("#bubbleLayer"),
  installButton: $("#installButton"),
};

init();

function init() {
  buildBubbles();
  buildTagControls();
  bindEvents();
  syncRecipeForm();
  syncSettingsForm();
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
  refs.goalMode.addEventListener("change", updateSettingsFromForm);
  refs.weeklyGoal.addEventListener("input", updateSettingsFromForm);
  refs.dryDaysGoal.addEventListener("input", updateSettingsFromForm);
  refs.discreetMode.addEventListener("change", updateSettingsFromForm);
  refs.reloadButton.addEventListener("click", () => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      else window.location.reload();
    });
  });
  refs.editPreset.addEventListener("change", syncEditRecipePreset);
  refs.saveEditButton.addEventListener("click", saveEditedItem);
  refs.deleteEditButton.addEventListener("click", deleteEditedItem);

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
    return migrateState(saved);
  } catch {
    return cloneDefaultState();
  }
}

function migrateState(saved) {
  if (!saved || typeof saved !== "object") return cloneDefaultState();

  const base = cloneDefaultState();
  const migrated = {
    ...base,
    ...saved,
    schemaVersion: SCHEMA_VERSION,
    recipe: normalizeRecipe(saved.recipe),
    flagsByDate: isPlainObject(saved.flagsByDate) ? saved.flagsByDate : {},
    entries: Array.isArray(saved.entries) ? saved.entries.map(normalizeEntry).filter(Boolean) : [],
    waters: Array.isArray(saved.waters) ? saved.waters.map(normalizeWater).filter(Boolean) : [],
    selectedTags: Array.isArray(saved.selectedTags) ? sanitizeTags(saved.selectedTags) : [],
    settings: normalizeSettings(saved.settings),
  };

  return migrated;
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
    tags: sanitizeTags(state.selectedTags),
  });
  saveState();
  render();
  animatePour();
  animateThresholdAlert();
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
  if (!confirm("Effacer les entrées alcoolisées et verres d'eau d'aujourd'hui ?")) return;
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
  const noun = entryNoun(today.count);
  refs.piconLabel.textContent = noun.counter;
  refs.standardLine.textContent = `${formatNumber(today.standardDrinks)} verre standard`;
  refs.selectedPiconLine.textContent = recipeDisplayName(state.recipe);
  refs.todayStandards.textContent = formatNumber(today.standardDrinks);
  refs.perPiconLine.textContent = `1 ${recipeDisplayName(state.recipe)} = ${formatNumber(perPicon)} verre standard`;
  refs.waterCount.textContent = today.waterCount;
  refs.waterLine.textContent = today.waterCount > 1 ? "Verres d'eau notés" : "Verre d'eau noté";
  refs.dryDays.textContent = `${week.dryDays}/${getDryDaysGoal()}`;

  $("#removeButton").disabled = today.count === 0;

  const dailyPercent = (today.standardDrinks / DAILY_LIMIT) * 100;
  const weeklyPercent = (week.standardDrinks / getWeeklyGoal()) * 100;
  const intensity = clamp(Math.max(dailyPercent, weeklyPercent) / 100, 0, 1.6);
  const overLimit = clamp(intensity - 1, 0, 0.6);
  document.body.style.setProperty("--intensity", intensity.toFixed(2));
  document.body.style.setProperty("--over-limit", overLimit.toFixed(2));
  document.body.classList.toggle("threshold-near", intensity >= 0.72 && intensity < 1);
  document.body.classList.toggle("threshold-reached", intensity >= 1);
  refs.dailyMeter.style.width = `${clamp(dailyPercent, 0, 100)}%`;
  refs.weeklyMeter.style.width = `${clamp(weeklyPercent, 0, 100)}%`;
  refs.dailyMeterLabel.textContent = `${formatNumber(today.standardDrinks)} / ${DAILY_LIMIT}`;
  refs.weeklyMeterLabel.textContent = `${formatNumber(week.standardDrinks)} / ${getWeeklyGoal()}`;

  const weeklyFill = week.standardDrinks === 0 ? 0 : clamp((week.standardDrinks / WEEKLY_LIMIT) * 86 + 10, 10, 96);
  document.documentElement.style.setProperty("--fill", `${weeklyFill}%`);
  refs.animatedGlass.classList.toggle("has-liquid", week.standardDrinks > 0);

  renderStatus(today, week);
  renderRhythm(today);
  renderWeekMarkers(week);
  renderDashboard(today, week);
  renderWeek(week);
  renderLog();
  renderRecipe();
  renderObjective(today, week);
  renderDiscreetMode();
}

function renderStatus(today, week) {
  refs.statusDot.className = "status-dot";

  if (today.standardDrinks >= DAILY_LIMIT) {
    refs.statusDot.classList.add("danger");
    refs.statusTitle.textContent = today.standardDrinks > DAILY_LIMIT ? "Au-dessus du repère jour" : "Seuil journalier atteint";
    refs.statusText.textContent = `Aujourd'hui : ${formatNumber(today.standardDrinks)} verres standard pour un repère de ${DAILY_LIMIT}. Faire une pause est le signal principal ; l’eau ne compense pas l’alcool.`;
    return;
  }

  if (week.standardDrinks >= WEEKLY_LIMIT) {
    refs.statusDot.classList.add("danger");
    refs.statusTitle.textContent = week.standardDrinks > WEEKLY_LIMIT ? "Au-dessus du repère semaine" : "Seuil hebdomadaire atteint";
    refs.statusText.textContent = `Semaine : ${formatNumber(week.standardDrinks)} verres standard pour un repère de ${WEEKLY_LIMIT}. Le repère est atteint ou dépassé.`;
    return;
  }

  if (today.standardDrinks > 0) {
    refs.statusDot.classList.add("warn");
    refs.statusTitle.textContent = "Dans le repère jour";
    refs.statusText.textContent = "Suivi indicatif : les repères incluent aussi des jours sans alcool.";
    return;
  }

  refs.statusTitle.textContent = "Journée à zéro";
  refs.statusText.textContent = "La journée compte comme jour sans alcool dans le suivi hebdomadaire.";
}

function renderRhythm(today) {
  if (today.count === 0) {
    refs.rhythmTitle.textContent = "Aucune entrée aujourd’hui";
    refs.rhythmText.textContent = "La journée est suivie sans ajout d’alcool pour le moment.";
    return;
  }

  const last = today.entries[today.entries.length - 1];
  const lastTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(last.time));
  const waterGap = Math.max(0, today.count - today.waterCount);

  refs.rhythmTitle.textContent = `${today.count} ${entryNoun(today.count).log}`;
  refs.rhythmText.textContent =
    waterGap > 0
      ? `Dernière entrée à ${lastTime}. ${waterGap} entrée${waterGap > 1 ? "s" : ""} sans verre d’eau noté.`
      : `Dernière entrée à ${lastTime}. L’eau est notée comme pause, sans compenser l’alcool.`;
}

function recipeDisplayName(recipe) {
  if (!recipe || typeof recipe !== "object") return "Picon";
  const key = PRESET_ALIASES[recipe.key] || recipe.key;
  if (key && PRESET_DISPLAY_NAMES[key]) return PRESET_DISPLAY_NAMES[key];
  const rawName = recipe.name || recipe.recipeName || "Perso";
  return rawName.replace(/\s+(rétro|néon|laser|noir)$/iu, "");
}

function renderWeekMarkers(week) {
  refs.weekMarkers.innerHTML = "";

  const max = Math.max(DAILY_LIMIT, ...week.days.map((day) => day.standardDrinks));
  const activeDays = week.days.filter((day) => day.standardDrinks > 0).length;
  const reachedLimit = week.days.some((day) => day.standardDrinks >= DAILY_LIMIT) || week.standardDrinks >= weeklyLimit();
  refs.visualCaption.textContent = activeDays === 0
    ? "Aucun jour avec alcool noté cette semaine."
    : `${activeDays} jour${activeDays > 1 ? "s" : ""} avec entrée alcoolisée cette semaine.`;
  if (refs.visualIllustration) {
    refs.visualIllustration.src = reachedLimit
      ? "assets/illustrations/threshold-reached.svg"
      : state.settings.discreetMode
        ? "assets/illustrations/discreet-mode.svg"
        : "assets/illustrations/empty-today.svg";
  }

  week.days.forEach((day, index) => {
    const marker = document.createElement("span");
    const intensity = clamp(day.standardDrinks / max, 0, 1);
    marker.className = `day-marker${day.date === todayKey() ? " today" : ""}`;
    marker.style.setProperty("--angle", `${index * (360 / week.days.length)}deg`);
    marker.style.setProperty("--marker-delay", `${index * -0.18}s`);
    marker.style.setProperty("--intensity", intensity.toFixed(2));
    marker.title = `${formatDay(day.date, { weekday: "long" })} : ${formatNumber(day.standardDrinks)} verre standard`;
    marker.setAttribute("aria-label", marker.title);
    refs.weekMarkers.append(marker);
  });
}

function renderWeek(week) {
  refs.weekRange.textContent = `${formatDay(week.days[0].date, { day: "numeric", month: "short" })} - ${formatDay(week.days[6].date, { day: "numeric", month: "short" })}`;
  refs.weekTotal.textContent = formatNumber(week.standardDrinks);
  refs.weeklyStatus.textContent = `${formatNumber(week.standardDrinks)}/${getWeeklyGoal()}`;
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
  const weekPercent = clamp((week.standardDrinks / getWeeklyGoal()) * 100, 0, 140);
  const dryStreak = countDryStreak(30);

  refs.dashboardGauge.style.setProperty("--gauge", `${clamp(weekPercent, 0, 100) * 3.6}deg`);
  refs.dashboardGaugeLabel.textContent = `${Math.round(weekPercent)}%`;
  refs.dashboardAverage.textContent = formatNumber(average);
  refs.dashboardStreak.textContent = dryStreak;
  refs.dashboardPeak.textContent = formatNumber(peak.standardDrinks);
  refs.dashboardPeakLabel.textContent = peak.standardDrinks > 0 ? formatDay(peak.date, { weekday: "short", day: "numeric" }) : "Aucun jour";
  refs.dashboardPace.textContent = `${pace}%`;

  if (week.standardDrinks >= WEEKLY_LIMIT) {
    refs.dashboardInsightTitle.textContent = "Repère hebdomadaire atteint";
    refs.dashboardInsight.textContent = `La semaine est à ${formatNumber(week.standardDrinks)} verres standard, au-dessus du repère de ${WEEKLY_LIMIT}.`;
  } else if (today.standardDrinks > DAILY_LIMIT) {
    refs.dashboardInsightTitle.textContent = "Pic journalier";
    refs.dashboardInsight.textContent = `Aujourd'hui dépasse le repère de ${DAILY_LIMIT} verres standard. Le tableau conserve la trace.`;
  } else if (week.dryDays < DRY_DAYS_TARGET) {
    refs.dashboardInsightTitle.textContent = "Pause à programmer";
    refs.dashboardInsight.textContent = `Il manque ${DRY_DAYS_TARGET - week.dryDays} jour sans alcool pour atteindre le repère hebdomadaire.`;
  } else {
    refs.dashboardInsightTitle.textContent = "Suivi dans les repères";
    refs.dashboardInsight.textContent = `Semaine à ${formatNumber(week.standardDrinks)} verres standard avec ${week.dryDays} jour${week.dryDays > 1 ? "s" : ""} à zéro.`;
  }

  renderTrend(range);
  renderTypeDistribution(range);
  renderTagSummary(range);
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
    row.className = "type-row framed-row";
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
    empty.textContent = "Aucune entrée enregistrée.";
    refs.logList.append(empty);
    return;
  }

  days.forEach((key) => {
    const day = aggregateDay(key);
    const article = document.createElement("article");
    article.className = "log-day framed-row";

    const summary = document.createElement("div");
    summary.className = "log-day-summary";
    const title = document.createElement("strong");
    title.textContent = formatDay(key, { weekday: "long", day: "numeric", month: "long" });
    const detail = document.createElement("small");
    detail.textContent = `${day.count} ${entryNoun(day.count).short}, ${formatNumber(day.standardDrinks)} verre standard, ${day.waterCount} eau, ${dominantType(day)}`;
    summary.append(title, detail);

    const list = document.createElement("div");
    list.className = "entry-list";

    [...day.entries.map((item) => ({ ...item, kind: "entry" })), ...day.waters.map((item) => ({ ...item, kind: "water" }))]
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .forEach((item) => list.append(createLogDetailRow(item)));

    article.append(summary, list);
    refs.logList.append(article);
  });
}

function createLogDetailRow(item) {
  const row = document.createElement("div");
  row.className = "entry-row";

  const main = document.createElement("div");
  const label = document.createElement("strong");
  const time = item.time ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.time)) : "--:--";
  label.textContent = item.kind === "water" ? `Eau · ${time}` : `${recipeDisplayName(item.recipe)} · ${time}`;
  const detail = document.createElement("small");
  detail.textContent = item.kind === "water"
    ? "Verre d’eau noté (ne compense pas l’alcool)."
    : `${formatNumber(Number(item.standardDrinks || 0))} verre standard · ${formatNumber(Number(item.grams || 0))} g${item.tags?.length ? ` · ${item.tags.join(", ")}` : ""}`;
  main.append(label, detail);

  const button = document.createElement("button");
  button.className = "text-button";
  button.type = "button";
  button.textContent = "Modifier";
  button.setAttribute("aria-label", `Modifier ${item.kind === "water" ? "ce verre d’eau" : "cette entrée"}`);
  button.addEventListener("click", () => openEditDialog(item.kind, item.id));

  row.append(main, button);
  return row;
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
  const standardDrinks = entries.reduce((total, entry) => total + entryStandardDrinks(entry), 0);
  const grams = entries.reduce((total, entry) => total + entryGrams(entry), 0);

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
  document.body.classList.remove("drink-added", "threshold-burst");
  void refs.pourStream.offsetWidth;
  refs.pourStream.classList.add("active");
  document.body.classList.add("drink-added");
  if (document.body.classList.contains("threshold-reached")) {
    document.body.classList.add("threshold-burst");
  }
  window.setTimeout(() => document.body.classList.remove("drink-added", "threshold-burst"), 1250);
}

function animateThresholdAlert() {
  if (!document.body.classList.contains("threshold-reached") || !refs.thresholdAlert) return;
  refs.thresholdAlert.hidden = false;
  refs.thresholdAlert.setAttribute("aria-hidden", "false");
  refs.thresholdAlert.classList.remove("active");
  void refs.thresholdAlert.offsetWidth;
  refs.thresholdAlert.classList.add("active");
  window.setTimeout(() => {
    refs.thresholdAlert.classList.remove("active");
    refs.thresholdAlert.setAttribute("aria-hidden", "true");
    refs.thresholdAlert.hidden = true;
  }, 3800);
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
  const payload = JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `picon-counter-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setImportStatus("Export local créé. Conserve le fichier dans un endroit sûr.");
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result));
      const result = validateImportedState(imported);
      if (!result.valid) {
        setImportStatus(result.message, true);
        return;
      }
      state = result.state;
      syncRecipeForm();
      syncSettingsForm();
      saveState();
      render();
      setImportStatus(result.message);
    } catch {
      setImportStatus("Import impossible : le fichier n’est pas un JSON valide.", true);
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function validateImportedState(imported) {
  if (!isPlainObject(imported)) {
    return { valid: false, message: "Import refusé : structure JSON attendue sous forme d’objet." };
  }

  const entriesSource = Array.isArray(imported.entries) ? imported.entries : [];
  const watersSource = Array.isArray(imported.waters) ? imported.waters : [];
  const entries = entriesSource.map(normalizeEntry).filter(Boolean);
  const waters = watersSource.map(normalizeWater).filter(Boolean);

  if (!Array.isArray(imported.entries) && !Array.isArray(imported.waters)) {
    return { valid: false, message: "Import refusé : aucune liste entries ou waters exploitable." };
  }

  return {
    valid: true,
    state: {
      ...cloneDefaultState(),
      ...imported,
      schemaVersion: SCHEMA_VERSION,
      recipe: normalizeRecipe(imported.recipe || PRESETS.demi),
      entries,
      waters,
      flagsByDate: isPlainObject(imported.flagsByDate) ? imported.flagsByDate : {},
      selectedTags: Array.isArray(imported.selectedTags) ? sanitizeTags(imported.selectedTags) : [],
      settings: normalizeSettings(imported.settings),
    },
    message: `Import terminé : ${entries.length}/${entriesSource.length} entrée(s) et ${waters.length}/${watersSource.length} verre(s) d’eau conservés. Les éléments invalides ont été ignorés.`,
  };
}

function setImportStatus(message, isError = false) {
  if (!refs.importStatus) return;
  refs.importStatus.textContent = message;
  refs.importStatus.classList.toggle("error", isError);
}

function normalizeEntry(entry) {
  if (!isPlainObject(entry)) return null;
  const date = isValidDateKey(entry.date) ? entry.date : dateKeyFromTime(entry.time);
  const time = normalizeTime(entry.time, date);
  if (!date || !time) return null;
  const recipe = normalizeRecipe(entry.recipe || entry);
  const grams = recipeAlcoholGrams(recipe);
  return {
    ...entry,
    id: entry.id ? String(entry.id) : createId(),
    date,
    time,
    recipe,
    standardDrinks: grams / STANDARD_GRAMS,
    grams,
    tags: sanitizeTags(entry.tags),
  };
}

function normalizeWater(water) {
  if (!isPlainObject(water)) return null;
  const date = isValidDateKey(water.date) ? water.date : dateKeyFromTime(water.time);
  const time = normalizeTime(water.time, date);
  if (!date || !time) return null;
  return { ...water, id: water.id ? String(water.id) : createId(), date, time };
}

function normalizeTime(value, fallbackDate) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  if (!isValidDateKey(fallbackDate)) return null;
  return `${fallbackDate}T12:00:00.000Z`;
}

function dateKeyFromTime(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? dateKey(parsed) : null;
}

function isValidDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateFromKey(value).getTime());
}

function entryGrams(entry) {
  return Number.isFinite(Number(entry.grams)) ? Number(entry.grams) : recipeAlcoholGrams(normalizeRecipe(entry.recipe));
}

function entryStandardDrinks(entry) {
  return Number.isFinite(Number(entry.standardDrinks)) ? Number(entry.standardDrinks) : entryGrams(entry) / STANDARD_GRAMS;
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter((tag) => CONTEXT_TAGS.includes(tag)))];
}

function normalizeSettings(settings = {}) {
  const base = cloneDefaultState().settings;
  const goalMode = ["observe", "reduce", "pause"].includes(settings.goalMode) ? settings.goalMode : base.goalMode;
  return {
    discreetMode: Boolean(settings.discreetMode),
    goalMode,
    weeklyGoal: clamp(Number(settings.weeklyGoal ?? base.weeklyGoal) || base.weeklyGoal, 0.5, WEEKLY_LIMIT),
    dryDaysGoal: Math.round(clamp(Number(settings.dryDaysGoal ?? base.dryDaysGoal) || base.dryDaysGoal, 0, 7)),
  };
}

function buildTagControls() {
  renderTagCheckboxes(refs.quickTagList, state.selectedTags, (tags) => {
    state.selectedTags = tags;
    saveState();
  });
  renderTagCheckboxes(refs.editTagList, [], () => {});
}

function renderTagCheckboxes(container, selected, onChange) {
  if (!container) return;
  container.innerHTML = "";
  CONTEXT_TAGS.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "tag-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tag;
    input.checked = selected.includes(tag);
    input.addEventListener("change", () => onChange(getCheckedTags(container)));
    label.append(input, document.createTextNode(tag));
    container.append(label);
  });
}

function getCheckedTags(container) {
  return sanitizeTags(Array.from(container.querySelectorAll("input:checked")).map((input) => input.value));
}

function syncSettingsForm() {
  state.settings = normalizeSettings(state.settings);
  refs.goalMode.value = state.settings.goalMode;
  refs.weeklyGoal.value = state.settings.weeklyGoal;
  refs.dryDaysGoal.value = state.settings.dryDaysGoal;
  refs.discreetMode.checked = state.settings.discreetMode;
}

function updateSettingsFromForm() {
  state.settings = normalizeSettings({
    discreetMode: refs.discreetMode.checked,
    goalMode: refs.goalMode.value,
    weeklyGoal: refs.weeklyGoal.value,
    dryDaysGoal: refs.dryDaysGoal.value,
  });
  syncSettingsForm();
  saveState();
  render();
}

function getWeeklyGoal() {
  return normalizeSettings(state.settings).weeklyGoal;
}

function getDryDaysGoal() {
  return normalizeSettings(state.settings).dryDaysGoal;
}

function renderObjective(today, week) {
  const settings = normalizeSettings(state.settings);
  let text = "Mode Observer : simple suivi personnel, sans cible de réduction.";
  if (settings.goalMode === "reduce") {
    const remaining = settings.weeklyGoal - week.standardDrinks;
    text = remaining >= 0
      ? `Mode Réduire : ${formatNumber(remaining)} verre standard avant la cible personnelle de ${formatNumber(settings.weeklyGoal)} cette semaine.`
      : `Mode Réduire : cible personnelle de ${formatNumber(settings.weeklyGoal)} dépassée cette semaine.`;
  }
  if (settings.goalMode === "pause") {
    const missing = settings.dryDaysGoal - week.dryDays;
    text = missing > 0
      ? `Mode Pause : encore ${missing} jour${missing > 1 ? "s" : ""} sans alcool pour la cible personnelle.`
      : `Mode Pause : cible personnelle de jours sans alcool atteinte cette semaine.`;
  }
  refs.goalFeedback.textContent = text;
}

function renderDiscreetMode() {
  const discreet = Boolean(state.settings?.discreetMode);
  document.body.classList.toggle("discreet-mode", discreet);
  document.querySelectorAll("[data-copy='app-title']").forEach((node) => { node.textContent = discreet ? "Journal" : "Picon Counter"; });
  document.querySelectorAll("[data-copy='add-entry']").forEach((node) => { node.textContent = discreet ? "Entrée" : "Picon"; });
  document.querySelectorAll("[data-copy='formats-title']").forEach((node) => { node.textContent = discreet ? "Formats" : "Formats Picon"; });
  document.querySelectorAll("[data-aria-copy='app-title']").forEach((node) => { node.setAttribute("aria-label", discreet ? "Journal" : "Picon Counter"); });
  refs.privacyNote.textContent = "Données conservées uniquement dans le stockage local de ce navigateur : rien n’est envoyé à un serveur.";
}

function entryNoun(count = 1) {
  const discreet = Boolean(state.settings?.discreetMode);
  if (discreet) return { counter: count > 1 ? "entrées" : "entrée", log: `entrée${count > 1 ? "s" : ""}`, short: "entrée" };
  return { counter: count > 1 ? "Picons" : "Picon", log: `Picon-bière${count > 1 ? "s" : ""}`, short: "Picon" };
}

function renderTagSummary(days) {
  refs.dashboardTags.innerHTML = "";
  const counts = new Map();
  days.flatMap((day) => day.entries).forEach((entry) => sanitizeTags(entry.tags).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  if (counts.size === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun tag optionnel noté sur 14 jours.";
    refs.dashboardTags.append(empty);
    return;
  }
  const max = Math.max(...counts.values());
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    const row = document.createElement("div");
    row.className = "type-row framed-row";
    row.innerHTML = `<span>${tag}</span><div class="type-track"><i style="width: ${clamp((count / max) * 100, 8, 100)}%"></i></div><strong>${count}</strong>`;
    refs.dashboardTags.append(row);
  });
}

function openEditDialog(kind, id) {
  const collection = kind === "water" ? state.waters : state.entries;
  const item = collection.find((entry) => entry.id === id);
  if (!item) return;
  refs.editId.value = id;
  refs.editKind.value = kind;
  refs.editKindLabel.textContent = kind === "water" ? "Verre d’eau" : "Entrée";
  refs.editTitle.textContent = kind === "water" ? "Modifier un verre d’eau" : "Modifier une entrée";
  refs.editDate.value = item.date;
  refs.editTime.value = isoToTimeInput(item.time);
  document.querySelectorAll(".entry-only").forEach((node) => { node.hidden = kind === "water"; });
  if (kind !== "water") {
    const recipe = normalizeRecipe(item.recipe);
    refs.editPreset.value = PRESETS[recipe.key] ? recipe.key : "custom";
    fillEditRecipe(recipe);
    renderTagCheckboxes(refs.editTagList, sanitizeTags(item.tags), () => {});
  }
  refs.editDialog.showModal();
}

function isoToTimeInput(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "12:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function syncEditRecipePreset() {
  const preset = PRESETS[refs.editPreset.value];
  if (preset) fillEditRecipe(preset);
}

function fillEditRecipe(recipe) {
  refs.editBeerMl.value = recipe.beerMl;
  refs.editBeerAbv.value = recipe.beerAbv;
  refs.editPiconMl.value = recipe.piconMl;
  refs.editPiconAbv.value = recipe.piconAbv;
}

function saveEditedItem() {
  const id = refs.editId.value;
  const kind = refs.editKind.value;
  const date = refs.editDate.value;
  const time = refs.editTime.value;
  if (!isValidDateKey(date) || !time) return;
  const iso = localDateTimeToIso(date, time);

  if (kind === "water") {
    state.waters = state.waters.map((water) => water.id === id ? { ...water, date, time: iso } : water);
  } else {
    const recipe = sanitizeRecipe({
      key: refs.editPreset.value,
      name: refs.editPreset.value === "custom" ? "Perso" : PRESETS[refs.editPreset.value]?.name,
      beerMl: refs.editBeerMl.value,
      beerAbv: refs.editBeerAbv.value,
      piconMl: refs.editPiconMl.value,
      piconAbv: refs.editPiconAbv.value,
    });
    const grams = recipeAlcoholGrams(recipe);
    state.entries = state.entries.map((entry) => entry.id === id ? {
      ...entry,
      date,
      time: iso,
      recipe,
      grams,
      standardDrinks: grams / STANDARD_GRAMS,
      tags: getCheckedTags(refs.editTagList),
    } : entry);
  }
  refs.editDialog.close();
  saveState();
  render();
}

function deleteEditedItem() {
  const id = refs.editId.value;
  const kind = refs.editKind.value;
  const label = kind === "water" ? "ce verre d’eau" : "cette entrée";
  if (!confirm(`Supprimer ${label} du journal local ?`)) return;
  if (kind === "water") state.waters = state.waters.filter((water) => water.id !== id);
  else state.entries = state.entries.filter((entry) => entry.id !== id);
  refs.editDialog.close();
  saveState();
  render();
}

function localDateTimeToIso(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            refs.updateBanner.hidden = false;
          }
        });
      });
    }).catch(() => {});
  });
}

if (typeof window !== "undefined") {
  window.PiconCounterTests = {
    recipeAlcoholGrams,
    recipeStandardDrinks,
    aggregateDay,
    aggregateWeek,
    validateImportedState,
    PRESETS,
    setTestState(nextState) { state = migrateState(nextState); },
    getState() { return state; },
  };
}
