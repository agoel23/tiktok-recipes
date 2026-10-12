import { useCallback, useEffect, useState } from "react";

// Per-viewer check state, kept in this browser only. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

interface State {
  ingredients: number[];
  steps: number[];
}

const EMPTY: State = { ingredients: [], steps: [] };
const key = (recipeId: string) => `recipe-book:checks:${recipeId}`;

function load(recipeId: string): State {
  try {
    const raw = localStorage.getItem(key(recipeId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(recipeId: string, state: State) {
  try {
    localStorage.setItem(key(recipeId), JSON.stringify(state));
  } catch {
    /* checks just won't persist */
  }
}

export function useChecklist(recipeId: string) {
  const [state, setState] = useState<State>(() => load(recipeId));
  useEffect(() => setState(load(recipeId)), [recipeId]);

  const toggle = useCallback(
    (list: keyof State, index: number) => {
      setState((prev) => {
        const set = new Set(prev[list]);
        set.has(index) ? set.delete(index) : set.add(index);
        const next = { ...prev, [list]: [...set] };
        save(recipeId, next);
        return next;
      });
    },
    [recipeId],
  );

  const reset = useCallback(() => {
    setState(EMPTY);
    save(recipeId, EMPTY);
  }, [recipeId]);

  return {
    isChecked: (list: keyof State, i: number) => state[list].includes(i),
    toggle,
    reset,
    count: state.ingredients.length + state.steps.length,
  };
}

/** Remembered servings per recipe (per viewer). */
export function loadServings(recipeId: string): number | null {
  try {
    const v = Number(localStorage.getItem(`recipe-book:servings:${recipeId}`));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveServings(recipeId: string, servings: number) {
  try {
    localStorage.setItem(`recipe-book:servings:${recipeId}`, String(servings));
  } catch {
    /* ignore */
  }
}
