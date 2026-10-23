import "server-only";
import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/models";

/** Current user (verified against Supabase Auth, not just the cookie) and profile. */
export const getSession = cache(async (): Promise<{ userId: string | null; email: string | null; profile: Profile | null }> => {
  if (!isSupabaseConfigured) return { userId: null, email: null, profile: null };
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { userId: null, email: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, role_selected, preferred_locale, is_verified, is_demo")
    .eq("id", data.user.id)
    .maybeSingle();
  return { userId: data.user.id, email: data.user.email ?? null, profile: (profile as Profile) ?? null };
});

export const PRO_ROLES = ["proprietaire", "agent", "agency_admin", "developer", "admin"] as const;
export const isPro = (p: Profile | null) => Boolean(p && (PRO_ROLES as readonly string[]).includes(p.role));
