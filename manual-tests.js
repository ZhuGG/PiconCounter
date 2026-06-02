#!/usr/bin/env node
const DENSITY_ETHANOL = 0.789;
const STANDARD_GRAMS = 10;
const PRESETS = {
  demi: { key: "demi", name: "Demi", beerMl: 250, beerAbv: 5, piconMl: 30, piconAbv: 18 },
  pinte: { key: "pinte", name: "Pinte", beerMl: 500, beerAbv: 5, piconMl: 50, piconAbv: 18 },
};

function grams(recipe) {
  return (Number(recipe.beerMl) * Number(recipe.beerAbv) / 100 + Number(recipe.piconMl) * Number(recipe.piconAbv) / 100) * DENSITY_ETHANOL;
}
function standards(recipe) { return grams(recipe) / STANDARD_GRAMS; }
function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function startOfWeek(date) { const start = new Date(date); const day = start.getDay() || 7; start.setDate(start.getDate() - day + 1); start.setHours(12,0,0,0); return start; }
function aggregateDay(state, key) {
  const entries = state.entries.filter((entry) => entry.date === key);
  return { count: entries.length, standardDrinks: entries.reduce((sum, entry) => sum + Number(entry.standardDrinks || standards(entry.recipe)), 0) };
}
function aggregateWeek(state, anchorKey) {
  const start = startOfWeek(dateFromKey(anchorKey));
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return aggregateDay(state, dateKey(d)); });
  return { days, standardDrinks: days.reduce((sum, day) => sum + day.standardDrinks, 0) };
}
function validDateKey(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value); }
function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || !validDateKey(entry.date) || !entry.recipe) return null;
  return { ...entry, grams: grams(entry.recipe), standardDrinks: standards(entry.recipe), tags: Array.isArray(entry.tags) ? entry.tags : [] };
}
function validateImport(imported) {
  if (!imported || typeof imported !== "object" || !Array.isArray(imported.entries)) return { valid: false, entries: [] };
  return { valid: true, schemaVersion: 2, entries: imported.entries.map(normalizeEntry).filter(Boolean) };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function close(actual, expected, tolerance = 0.01) { if (Math.abs(actual - expected) > tolerance) throw new Error(`${actual} !== ${expected}`); }

test("calcul du Demi", () => close(standards(PRESETS.demi), 1.42));
test("calcul de la Pinte", () => close(standards(PRESETS.pinte), 2.68));
test("calcul d’une recette personnalisée", () => close(standards({ beerMl: 330, beerAbv: 4, piconMl: 20, piconAbv: 18 }), 1.33));
test("agrégation jour", () => {
  const state = { entries: [{ date: "2026-06-01", recipe: PRESETS.demi, standardDrinks: standards(PRESETS.demi) }, { date: "2026-06-01", recipe: PRESETS.pinte, standardDrinks: standards(PRESETS.pinte) }] };
  const day = aggregateDay(state, "2026-06-01");
  if (day.count !== 2) throw new Error("count");
  close(day.standardDrinks, standards(PRESETS.demi) + standards(PRESETS.pinte));
});
test("agrégation semaine", () => {
  const state = { entries: [{ date: "2026-06-01", recipe: PRESETS.demi, standardDrinks: standards(PRESETS.demi) }, { date: "2026-06-07", recipe: PRESETS.pinte, standardDrinks: standards(PRESETS.pinte) }] };
  close(aggregateWeek(state, "2026-06-03").standardDrinks, standards(PRESETS.demi) + standards(PRESETS.pinte));
});
test("import d’un ancien JSON", () => {
  const result = validateImport({ entries: [{ id: "old", date: "2026-06-01", recipe: PRESETS.demi }] });
  if (!result.valid || result.schemaVersion !== 2 || result.entries.length !== 1) throw new Error("legacy import");
  close(result.entries[0].standardDrinks, standards(PRESETS.demi));
});
test("import d’un JSON invalide", () => {
  const result = validateImport({ entries: [{ nope: true }] });
  if (!result.valid || result.entries.length !== 0) throw new Error("invalid entries should be ignored");
  if (validateImport(null).valid) throw new Error("null should be refused");
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`✅ ${name}`); }
  catch (error) { failures += 1; console.error(`❌ ${name}: ${error.message}`); }
}
if (failures) process.exit(1);
console.log(`✅ ${tests.length} mini-tests terminés`);
