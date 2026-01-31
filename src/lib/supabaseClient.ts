import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables Supabase manquantes. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY."
  );
}

const hasWindow = typeof window !== "undefined";
const storage = hasWindow ? window.localStorage : undefined;
const fetcher = hasWindow ? window.fetch.bind(window) : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetcher
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage
  }
});
