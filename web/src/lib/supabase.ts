import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const configured = Boolean(url && anonKey);

// The anon key is public by design; Row Level Security decides what it can do.
export const supabase = createClient(url || "http://localhost", anonKey || "missing");

export function thumbUrl(path: string | null): string | null {
  return path ? `${url}/storage/v1/object/public/thumbs/${path}` : null;
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
