import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { NotificationRow } from "@/types/models";

export async function getMyFavoriteIds(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("favorites").select("property_id").order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.property_id as string);
}

export async function getMySavedSearches() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("saved_searches").select("id, name, filters, notify, created_at").order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

/** Deterministic recommendations from the user's own signals (see recommend_properties in SQL). */
export async function getRecommendedIds(limit = 8): Promise<{ property_id: string; reasons: string[] }[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("recommend_properties", { p_limit: limit });
  if (error) return [];
  return (data ?? []) as { property_id: string; reasons: string[] }[];
}
