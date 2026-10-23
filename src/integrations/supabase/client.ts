import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(url && key && key !== "not-configured");
export const supabase = createClient<Database>(url || "http://127.0.0.1:54321", key || "not-configured", {
  auth: { persistSession: isSupabaseConfigured, autoRefreshToken: isSupabaseConfigured },
});
