import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { configured, useSession } from "./lib/supabase";
import RecipeList from "./pages/RecipeList";
import RecipeView from "./pages/RecipeView";
import EditRecipe from "./pages/EditRecipe";
import AddPage from "./pages/AddPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const session = useSession();
  const { pathname } = useLocation();
  const onRecipe = pathname.startsWith("/r/");

  if (!configured) {
    return (
      <main className="page center">
        <h1>Almost there</h1>
        <p className="muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>web/.env</code>.
        </p>
      </main>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RecipeList signedIn={!!session} />} />
        <Route path="/r/:id" element={<RecipeView signedIn={!!session} />} />
        <Route path="/r/:id/edit" element={<EditRecipe signedIn={!!session} />} />
        <Route path="/add" element={session ? <AddPage /> : <LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>

      {session && !onRecipe && (
        <nav className="tabbar">
          <NavLink to="/" end className="tab">
            <span className="tab-icon">📖</span>
            Recipes
          </NavLink>
          <NavLink to="/add" className="tab">
            <span className="tab-icon">＋</span>
            Add
          </NavLink>
        </nav>
      )}
    </>
  );
}
