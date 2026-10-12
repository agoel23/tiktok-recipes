import { describe, expect, it } from "vitest";
import { formatFraction, normalize, scaleIngredient } from "./scale";
import type { Ingredient } from "./types";

const ing = (quantity: number | null, unit: string | null, extra: Partial<Ingredient> = {}): Ingredient => ({
  group: null, quantity, unit, item: "x", note: null, scalable: true, estimated: false, ...extra,
});

describe("formatFraction", () => {
  it("renders kitchen fractions", () => {
    expect(formatFraction(0.5)).toBe("½");
    expect(formatFraction(0.333)).toBe("⅓");
    expect(formatFraction(1.25)).toBe("1¼");
    expect(formatFraction(2)).toBe("2");
    expect(formatFraction(0.97)).toBe("1");
  });
  it("never rounds a real amount to zero", () => {
    expect(formatFraction(0.03)).toBe("⅛");
  });
  it("uses coarse fractions for big numbers", () => {
    expect(formatFraction(12.2)).toBe("12");
    expect(formatFraction(12.4)).toBe("12½");
  });
});

describe("normalize", () => {
  it("upgrades teaspoons to tablespoons and cups", () => {
    expect(normalize(6, "tsp")).toEqual({ qty: 2, unit: "tbsp" });
    expect(normalize(4, "tbsp")).toEqual({ qty: 0.25, unit: "cup" });
  });
  it("keeps awkward cup fractions in tablespoons", () => {
    expect(normalize(6, "tbsp")).toEqual({ qty: 6, unit: "tbsp" });
  });
  it("downgrades tiny cups", () => {
    expect(normalize(0.125, "cup")).toEqual({ qty: 2, unit: "tbsp" });
  });
  it("leaves small teaspoon amounts alone", () => {
    expect(normalize(1.5, "tsp")).toEqual({ qty: 1.5, unit: "tsp" });
  });
  it("converts metric and imperial weights", () => {
    expect(normalize(1500, "g")).toEqual({ qty: 1.5, unit: "kg" });
    expect(normalize(24, "oz")).toEqual({ qty: 1.5, unit: "lb" });
  });
});

describe("scaleIngredient", () => {
  it("scales and formats", () => {
    expect(scaleIngredient(ing(1, "tbsp"), 2)).toEqual({ amount: "2", unit: "tbsp" });
    expect(scaleIngredient(ing(0.5, "cup"), 3)).toEqual({ amount: "1½", unit: "cups" });
    expect(scaleIngredient(ing(2, null), 0.5)).toEqual({ amount: "1", unit: null });
    expect(scaleIngredient(ing(3, "clove"), 1)).toEqual({ amount: "3", unit: "cloves" });
  });
  it("rounds metric sensibly", () => {
    expect(scaleIngredient(ing(250, "g"), 1.5)).toEqual({ amount: "375", unit: "g" });
    expect(scaleIngredient(ing(30, "ml"), 0.5)).toEqual({ amount: "15", unit: "ml" });
  });
  it("doesn't scale unscalable items", () => {
    expect(scaleIngredient(ing(1, "pinch", { scalable: false }), 4)).toEqual({ amount: "1", unit: "pinch" });
  });
  it("handles 'to taste'", () => {
    expect(scaleIngredient(ing(null, null, { scalable: false, note: "to taste" }), 2)).toEqual({ amount: null, unit: null });
  });
});
