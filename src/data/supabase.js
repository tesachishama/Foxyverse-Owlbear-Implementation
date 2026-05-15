/**
 * Single Supabase client for the browser extension (anon key, row-level security on the server).
 * Fails fast at import time if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing.
 *
 * @see docs/CODEBASE.md#supporting-modules
 * @see docs/database.md
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
