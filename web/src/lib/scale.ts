import type { Ingredient } from "./types";

// Kitchen fractions we're willing to show, and their glyphs.
const FRACTIONS: [number, string][] = [
  [0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""],
];
const COARSE = new Set(["", "½"]); // for big numbers, ⅛ precision is silly

const TSP_PER: Record<string, number> = { tsp: 1, tbsp: 3, cup: 48 };
const METRIC = new Set(["g", "ml"]);

const COUNT_PLURALS: Record<string, string> = {
  cup: "cups", clove: "cloves", slice: "slices", piece: "pieces", can: "cans", stick: "sticks",
  bunch: "bunches", sprig: "sprigs", handful: "handfuls", pinch: "pinches", dash: "dashes",
};

/** Nearest kitchen fraction, e.g. 1.33 → { whole: 1, frac: "⅓", value: 1.333 } */
function nearestFraction(x: number): { whole: number; glyph: string; value: number } {
  let whole = Math.floor(x);
  const rest = x - whole;
  const choices = x >= 10 ? FRACTIONS.filter(([, g]) => COARSE.has(g)) : FRACTIONS;
  let best = choices[0];
  for (const c of choices) if (Math.abs(c[0] - rest) < Math.abs(best[0] - rest)) best = c;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  return { whole, glyph: best[1], value: whole + best[0] };
}

export function formatFraction(x: number): string {
  if (x <= 0) return "0";
  const { whole, glyph } = nearestFraction(x);
  if (whole === 0 && !glyph) return "⅛"; // never round a real amount down to nothing
  return `${whole || ""}${glyph}` || "0";
}

// Amounts worth switching units for: "¾ cup" yes, "⅜ cup" no (keep it as 6 tbsp).
const NICE = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

function isNice(x: number): boolean {
  if (x <= 0) return false;
  const rest = x - Math.floor(x);
  return NICE.some((f) => Math.abs(f - rest) / x < 0.04);
}

function formatMetric(x: number): string {
  if (x < 10) return String(Math.round(x * 10) / 10);
  if (x < 100) return String(Math.round(x));
  return String(Math.round(x / 5) * 5);
}

function formatDecimal(x: number): string {
  return String(Math.round(x * 100) / 100);
}

/** Choose a friendlier unit after scaling (6 tsp → 2 tbsp, 1200 g → 1.2 kg). */
export function normalize(qty: number, unit: string | null): { qty: number; unit: string | null } {
  if (!unit) return { qty, unit };
  const u = unit.toLowerCase();

  if (u in TSP_PER) {
    const tsp = qty * TSP_PER[u];
    if (tsp / 48 >= 0.25 && isNice(tsp / 48)) return { qty: tsp / 48, unit: "cup" };
    if (tsp / 3 >= 1 && isNice(tsp / 3)) return { qty: tsp / 3, unit: "tbsp" };
    if (tsp < 3 || u === "tsp") return { qty: tsp, unit: "tsp" };
    if (u === "cup" && tsp / 3 < 4) return { qty: tsp / 3, unit: "tbsp" };
    return { qty, unit: u };
  }
  if (u === "g" && qty >= 1000) return { qty: qty / 1000, unit: "kg" };
  if (u === "kg" && qty < 1) return { qty: qty * 1000, unit: "g" };
  if (u === "ml" && qty >= 1000) return { qty: qty / 1000, unit: "l" };
  if (u === "l" && qty < 1) return { qty: qty * 1000, unit: "ml" };
  if (u === "oz" && qty >= 16) return { qty: qty / 16, unit: "lb" };
  if (u === "lb" && qty < 0.5) return { qty: qty * 16, unit: "oz" };
  return { qty, unit: u };
}

function displayUnit(unit: string | null, qty: number): string | null {
  if (!unit) return null;
  return qty > 1 && COUNT_PLURALS[unit] ? COUNT_PLURALS[unit] : unit;
}

export interface ScaledAmount {
  amount: string | null; // "1½", "250", null for "to taste"
  unit: string | null;
}

export function scaleIngredient(ing: Ingredient, factor: number): ScaledAmount {
  if (ing.quantity == null) return { amount: null, unit: ing.unit };
  const raw = ing.scalable ? ing.quantity * factor : ing.quantity;
  const { qty, unit } = normalize(raw, ing.unit);
  let amount: string;
  if (unit && METRIC.has(unit)) amount = formatMetric(qty);
  else if (unit === "kg" || unit === "l") amount = formatDecimal(qty);
  else amount = formatFraction(qty);
  return { amount, unit: displayUnit(unit, qty) };
}
