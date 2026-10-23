"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let browserClient: SupabaseClient | undefined;

/** Singleton browser client (anon key + user session cookie). */
export function getSupabaseBrowser(): SupabaseClient {
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
