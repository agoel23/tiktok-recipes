import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CUISINES } from "../lib/cuisines";
import { supabase } from "../lib/supabase";
import type { Recipe } from "../lib/types";

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function EditRecipe({ signedIn }: { signedIn: boolean }) {
  const id = decodeURIComponent(useParams().id ?? "");
  const navigate = useNavigate();
  const [r, setR] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("recipes").select("*").eq("id", id).maybeSingle().then(({ data }) => setR(data as Recipe));
  }, [id]);

  if (!signedIn) return <main className="page center"><Link to="/login" className="btn">Sign in to edit</Link></main>;
  if (!r) return <main className="page"><div className="skeleton hero-skeleton" /></main>;

  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) => setR({ ...r, [k]: v });
  const setIng = (i: number, patch: Partial<Recipe["ingredients"][number]>) =>
    set("ingredients", r.ingredients.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const anyEstimated = r.ingredients.some((i) => i.scalable && i.quantity != null && i.estimated);
    const allEstimated = r.ingredients.filter((i) => i.scalable && i.quantity != null).every((i) => i.estimated);
    const { error } = await supabase
      .from("recipes")
      .update({
        title: r.title,
        cuisine: r.cuisine,
        base_servings: r.base_servings,
        servings_estimated: r.servings_estimated,
        prep_minutes: r.prep_minutes,
        cook_minutes: r.cook_minutes,
        total_minutes: r.total_minutes,
        time_estimated: r.time_estimated,
        ingredients: r.ingredients,
        measurements_source: !anyEstimated ? "explicit" : allEstimated ? "estimated" : "mixed",
      })
      .eq("id", r.id);
    setSaving(false);
    if (error) setError(error.message);
    else navigate(`/r/${encodeURIComponent(r.id)}`, { replace: true });
  };

  return (
    <main className="page edit">
      <div className="topbar">
        <Link className="icon-btn" to={`/r/${encodeURIComponent(r.id)}`} aria-label="Cancel">‹</Link>
        <h1 className="topbar-title">Edit recipe</h1>
      </div>

      <label className="field">
        <span>Title</span>
        <input value={r.title} onChange={(e) => set("title", e.target.value)} />
      </label>

      <label className="field">
        <span>Cuisine</span>
        <select value={r.cuisine} onChange={(e) => set("cuisine", e.target.value)}>
          {CUISINES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Servings</span>
          <input type="number" inputMode="numeric" min={1} value={r.base_servings}
            onChange={(e) => set("base_servings", Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="field">
          <span>Total min</span>
          <input type="number" inputMode="numeric" value={r.total_minutes ?? ""}
            onChange={(e) => set("total_minutes", numOrNull(e.target.value))} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Prep min</span>
          <input type="number" inputMode="numeric" value={r.prep_minutes ?? ""}
            onChange={(e) => set("prep_minutes", numOrNull(e.target.value))} />
        </label>
        <label className="field">
          <span>Cook min</span>
          <input type="number" inputMode="numeric" value={r.cook_minutes ?? ""}
            onChange={(e) => set("cook_minutes", numOrNull(e.target.value))} />
        </label>
      </div>
      <label className="check-field">
        <input type="checkbox" checked={r.time_estimated} onChange={(e) => set("time_estimated", e.target.checked)} />
        Times are estimates
      </label>

      <h2>Ingredient amounts</h2>
      <p className="muted small">Fixing an amount clears its “estimated” mark.</p>
      <ul className="edit-ings">
        {r.ingredients.map((ing, i) => (
          <li key={i}>
            <input className="qty" type="number" inputMode="decimal" step="any" value={ing.quantity ?? ""}
              placeholder="—" onChange={(e) => setIng(i, { quantity: numOrNull(e.target.value), estimated: false })} />
            <input className="unit" value={ing.unit ?? ""} placeholder="unit"
              onChange={(e) => setIng(i, { unit: e.target.value.trim() || null })} />
            <span className="item">{ing.item}</span>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}
      <div className="sticky-actions">
        <button className="btn primary block" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </main>
  );
}
