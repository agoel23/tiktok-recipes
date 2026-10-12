import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StepTimer from "../components/StepTimer";
import { loadServings, saveServings, useChecklist } from "../lib/checklist";
import { cuisineEmoji } from "../lib/cuisines";
import { minutes } from "../lib/format";
import { formatFraction, scaleIngredient } from "../lib/scale";
import { sourceLabel } from "../lib/source";
import { supabase, thumbUrl } from "../lib/supabase";
import type { Ingredient, Recipe } from "../lib/types";
import { useWakeLock } from "../lib/wakeLock";

export default function RecipeView({ signedIn }: { signedIn: boolean }) {
  const id = decodeURIComponent(useParams().id ?? "");
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [missing, setMissing] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const checks = useChecklist(id);
  const wake = useWakeLock();

  useEffect(() => {
    supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setMissing(true);
        setRecipe(data as Recipe);
        setServings(loadServings(id) ?? data.base_servings);
      });
  }, [id]);

  const groups = useMemo(() => {
    const map = new Map<string, { ing: Ingredient; index: number }[]>();
    recipe?.ingredients.forEach((ing, index) => {
      const g = ing.group ?? "";
      map.set(g, [...(map.get(g) ?? []), { ing, index }]);
    });
    return [...map.entries()];
  }, [recipe]);

  if (missing) {
    return (
      <main className="page center">
        <p className="empty-emoji">🤷</p>
        <p>Recipe not found.</p>
        <Link to="/" className="btn">Back to recipes</Link>
      </main>
    );
  }
  if (!recipe || servings == null) return <main className="page"><div className="skeleton hero-skeleton" /></main>;

  const factor = servings / recipe.base_servings;
  const changeServings = (s: number) => {
    const next = Math.max(0.5, Math.round(s * 2) / 2);
    setServings(next);
    saveServings(recipe.id, next);
  };
  const img = thumbUrl(recipe.thumbnail_path);
  const t = recipe.time_estimated ? "~" : "";

  const reextract = async () => {
    setBusy("Re-running extraction…");
    const { error } = await supabase.from("jobs").insert({
      kind: "reextract", url: recipe.source_url, source_type: recipe.source_type, recipe_id: recipe.id,
    });
    setBusy(null);
    if (error) alert(error.message);
    else navigate("/add");
  };
  const remove = async () => {
    if (!confirm(`Delete "${recipe.title}"? This can't be undone.`)) return;
    setBusy("Deleting…");
    if (recipe.thumbnail_path) await supabase.storage.from("thumbs").remove([recipe.thumbnail_path]);
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    setBusy(null);
    if (error) alert(error.message);
    else navigate("/", { replace: true });
  };

  return (
    <main className="page recipe">
      <div className="topbar">
        <button className="icon-btn" onClick={() => (history.length > 1 ? navigate(-1) : navigate("/"))} aria-label="Back">
          ‹
        </button>
        <a className="pill" href={recipe.source_url} target="_blank" rel="noreferrer">
          View on {sourceLabel(recipe.source_type, recipe.source_name)} ↗
        </a>
        {wake.supported && (
          <button className={`pill toggle ${wake.on ? "on" : ""}`} onClick={() => wake.setOn(!wake.on)} aria-pressed={wake.on}>
            {wake.on ? "☀︎ Screen on" : "☾ Keep screen on"}
          </button>
        )}
      </div>

      {img && <img className="hero" src={img} alt="" />}

      <header className="recipe-header">
        <p className="eyebrow">
          {cuisineEmoji(recipe.cuisine)} {recipe.cuisine}
          {recipe.source_name && <> · {recipe.source_name}</>}
        </p>
        <h1>{recipe.title}</h1>
        {recipe.total_minutes != null && (
          <p className="time">
            ⏱ <strong>{t}{minutes(recipe.total_minutes)} total</strong>
            {recipe.prep_minutes != null && <> · {t}{minutes(recipe.prep_minutes)} prep</>}
            {recipe.cook_minutes != null && <> · {t}{minutes(recipe.cook_minutes)} cook</>}
          </p>
        )}
        {recipe.time_estimated && <p className="muted small">~ Times are estimated; the source didn't state them.</p>}
      </header>

      <section className="servings card-flat">
        <div className="servings-row">
          <button className="round-btn" onClick={() => changeServings(servings - 1)} aria-label="Fewer servings" disabled={servings <= 1}>
            −
          </button>
          <div className="servings-label">
            <span className="servings-num">{formatFraction(servings)}</span>
            <span className="muted small">servings{recipe.servings_estimated && " (est.)"}</span>
          </div>
          <button className="round-btn" onClick={() => changeServings(servings + 1)} aria-label="More servings">
            +
          </button>
        </div>
        <div className="mult-row">
          {[0.5, 1, 2, 3].map((m) => (
            <button
              key={m}
              className={`chip ${Math.abs(factor - m) < 0.01 ? "on" : ""}`}
              onClick={() => changeServings(recipe.base_servings * m)}
            >
              {m === 0.5 ? "½" : m}×
            </button>
          ))}
        </div>
      </section>

      {recipe.measurements_source !== "explicit" && (
        <div className="banner">
          <strong>Heads up:</strong> this recipe didn't include {recipe.measurements_source === "estimated" ? "" : "all of its "}
          exact measurements. Amounts marked <span className="est">~</span> are best guesses.
        </div>
      )}

      <section>
        <div className="section-head">
          <h2>Ingredients</h2>
          {checks.count > 0 && <button className="link-btn" onClick={checks.reset}>Reset checks</button>}
        </div>
        {groups.map(([group, items]) => (
          <div key={group || "_"}>
            {group && <h3 className="group">{group}</h3>}
            <ul className="checklist">
              {items.map(({ ing, index }) => {
                const { amount, unit } = scaleIngredient(ing, factor);
                const checked = checks.isChecked("ingredients", index);
                return (
                  <li key={index} className={checked ? "checked" : ""} onClick={() => checks.toggle("ingredients", index)}>
                    <span className="box" aria-hidden>{checked ? "✓" : ""}</span>
                    <span className="ing">
                      {amount && (
                        <strong className="amount">
                          {ing.estimated && <span className="est" title="Estimated">~</span>}
                          {amount}
                          {unit && ` ${unit}`}
                        </strong>
                      )}{" "}
                      {ing.item}
                      {ing.note && <span className="muted">, {ing.note}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Directions</h2>
        <ol className="checklist steps">
          {recipe.steps.map((step, i) => {
            const checked = checks.isChecked("steps", i);
            return (
              <li key={i} className={checked ? "checked" : ""} onClick={() => checks.toggle("steps", i)}>
                <span className="box step-num" aria-hidden>{checked ? "✓" : i + 1}</span>
                <span className="step-body">
                  {step.text}
                  {step.timer_minutes ? <StepTimer minutes={step.timer_minutes} /> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {recipe.notes && (
        <section>
          <h2>Notes</h2>
          <p className="notes">{recipe.notes}</p>
        </section>
      )}

      {recipe.tags.length > 0 && (
        <p className="tags">{recipe.tags.map((t) => <span key={t} className="chip ghost static">#{t}</span>)}</p>
      )}

      {signedIn && (
        <section className="admin">
          <h2>Manage</h2>
          {busy && <p className="muted">{busy}</p>}
          <div className="admin-actions">
            <Link className="btn" to={`/r/${encodeURIComponent(recipe.id)}/edit`}>Edit</Link>
            <button className="btn" onClick={reextract} disabled={!!busy}>Re-run extraction</button>
            <button className="btn danger" onClick={remove} disabled={!!busy}>Delete</button>
          </div>
        </section>
      )}
    </main>
  );
}
