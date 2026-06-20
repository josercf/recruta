import { createClient } from "@supabase/supabase-js";

// Public, anon-key client. The anon key is safe to ship in the frontend by
// design — every row is protected by RLS (a user only ever sees their own jobs).
// NEVER put the service_role key or the Anthropic key here.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaces a clear console error during local dev if .env is missing.
  console.error(
    "[RecrutaBot] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Copy frontend/.env.example to frontend/.env and fill them in."
  );
}

export const supabase = createClient(url || "http://localhost", anonKey || "anon", {
  auth: { persistSession: true, autoRefreshToken: true },
});
