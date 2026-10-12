import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, thumbUrl } from "../lib/supabase";
import { cuisineEmoji } from "../lib/cuisines";
import { minutes } from "../lib/format";
import { SOURCE_ICON } from "../lib/source";
import type { Recipe } from "../lib/types";

type Sort = "newest" | "quickest";
type View = "all" | "cuisines";

const COLUMNS =
  "id,title,cuisine,tags,total_minutes,time_estimated,thumbnail_path,source_type,source_name,ingredients,created_at";

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function RecipeList({ signedIn }: { signedIn: boolean }) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(() => readPref("recipe-book:sort", "newest"));
  const [view, setView] = useState<View>(() => readPref("recipe-book:view", "all"));

  useEffect(() => {
    supabase
      .from("recipes")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRecipes(data as unknown as Recipe[]);
      });
  }, []);

  const cuisineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes ?? []) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [recipes]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes ?? []) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (recipes ?? []).filter((r) => {
      if (cuisine && r.cuisine !== cuisine) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.item.toLowerCase().includes(q))
      );
    });
    if (sort === "quickest") {
      list.sort((a, b) => (a.total_minutes ?? 9999) - (b.total_minutes ?? 9999));
    }
    return list;
  }, [recipes, query, cuisine, tag, sort]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Recipe[]>();
    for (const r of filtered) groups.set(r.cuisine, [...(groups.get(r.cuisine) ?? []), r]);
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const setSortPref = (s: Sort) => (setSort(s), writePref("recipe-book:sort", s));
  const setViewPref = (v: View) => (setView(v), writePref("recipe-book:view", v));

  return (
    <main className={`page ${signedIn ? "with-tabbar" : ""}`}>
      <header className="list-header">
        <h1>Recipe Book</h1>
        <p className="muted small">{recipes ? `${recipes.length} recipes` : " "}</p>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Search recipes or ingredients"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        enterKeyHint="search"
      />

      {cuisineCounts.length > 0 && (
        <div className="chip-row" role="tablist" aria-label="Cuisine">
          <button className={`chip ${!cuisine ? "on" : ""}`} onClick={() => setCuisine(null)}>
            All
          </button>
          {cuisineCounts.map(([c, n]) => (
            <button key={c} className={`chip ${cuisine === c ? "on" : ""}`} onClick={() => setCuisine(cuisine === c ? null : c)}>
              {cuisineEmoji(c)} {c} <span className="chip-count">{n}</span>
            </button>
          ))}
        </div>
      )}

      {topTags.length > 0 && (
        <div className="chip-row small-chips">
          {topTags.map((t) => (
            <button key={t} className={`chip ghost ${tag === t ? "on" : ""}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="segmented">
          <button className={view === "all" ? "on" : ""} onClick={() => setViewPref("all")}>Grid</button>
          <button className={view === "cuisines" ? "on" : ""} onClick={() => setViewPref("cuisines")}>By cuisine</button>
        </div>
        <div className="segmented">
          <button className={sort === "newest" ? "on" : ""} onClick={() => setSortPref("newest")}>Newest</button>
          <button className={sort === "quickest" ? "on" : ""} onClick={() => setSortPref("quickest")}>Quickest</button>
        </div>
      </div>

      {error && <p className="error">Couldn't load recipes: {error}</p>}
      {!recipes && !error && <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" />)}</div>}

      {recipes && filtered.length === 0 && (
        <div className="empty">
          {recipes.length === 0 ? (
            <>
              <p className="empty-emoji">🍳</p>
              <p>No recipes yet.</p>
              {signedIn && <Link to="/add" className="btn primary">Add your first recipe</Link>}
            </>
          ) : (
            <p>Nothing matches. Try another search.</p>
          )}
        </div>
      )}

      {view === "all" ? (
        <div className="grid">{filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}</div>
      ) : (
        grouped.map(([c, list]) => (
          <section key={c} className="cuisine-section">
            <h2>
              {cuisineEmoji(c)} {c} <span className="muted small">{list.length}</span>
            </h2>
            <div className="grid">{list.map((r) => <RecipeCard key={r.id} recipe={r} />)}</div>
          </section>
        ))
      )}

      {!signedIn && (
        <p className="footer-link">
          <Link to="/login">Owner sign in</Link>
        </p>
      )}
    </main>
  );
}

function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const img = thumbUrl(r.thumbnail_path);
  return (
    <Link to={`/r/${encodeURIComponent(r.id)}`} className="card">
      <div className="card-img">
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="card-placeholder">{cuisineEmoji(r.cuisine)}</span>}
        <span className="card-source" aria-label={r.source_type}>{SOURCE_ICON[r.source_type]}</span>
      </div>
      <div className="card-body">
        <h3>{r.title}</h3>
        <p className="muted small">
          {r.cuisine}
          {r.total_minutes != null && ` · ${r.time_estimated ? "~" : ""}${minutes(r.total_minutes)}`}
        </p>
      </div>
    </Link>
  );
}
