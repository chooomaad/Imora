import type { MapMarker, PropertyCard, PropertyFilters } from "@imora/shared";
import { errorCode, supabase } from "./supabase";

/** Thin wrappers over the same RPCs/edge functions used by the web app. */
export async function searchProperties(filters: PropertyFilters, page = 0, size = 12, ids?: string[]) {
  const { data, error } = await supabase.rpc("search_properties", { p_filters: filters, p_limit: size, p_offset: page * size, p_ids: ids ?? null });
  if (error) throw new Error(errorCode(error));
  const items = (data ?? []) as PropertyCard[];
  return { items, total: Number(items[0]?.total_count ?? 0) };
}

export async function countProperties(filters: PropertyFilters) {
  const { data } = await supabase.rpc("count_properties", { p_filters: filters });
  return Number(data ?? 0);
}

export async function markersInBounds(b: [number, number, number, number], filters: PropertyFilters) {
  const { data } = await supabase.rpc("properties_in_bbox", { p_min_lng: b[0], p_min_lat: b[1], p_max_lng: b[2], p_max_lat: b[3], p_filters: filters, p_limit: 600 });
  return (data ?? []) as MapMarker[];
}

export async function aiSearch(query: string, locale: string) {
  const { data, error } = await supabase.functions.invoke("ai-search", { body: { query, locale } });
  if (error) {
    let code = "generic";
    try {
      code = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? code;
    } catch {
      /* ignore */
    }
    throw new Error(code);
  }
  return data as { filters: PropertyFilters; interpretation: string; count: number };
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errorCode(error));
  return data as T;
}

export const revealContact = async (propertyId: string) =>
  (await rpc<{ contact_name: string | null; phone: string | null; whatsapp: string | null }[]>("reveal_contact", { p_property_id: propertyId }))?.[0] ?? null;
export const logContactEvent = (propertyId: string, event: "whatsapp_click" | "call_click") =>
  rpc<void>("log_contact_event", { p_property_id: propertyId, p_event: event }).catch(() => undefined);
export const requestVisit = (propertyId: string, date: string, time: string) =>
  rpc<{ id: string }>("request_visit", { p_property_id: propertyId, p_date: date, p_time: time, p_notes: null });
export const visitSlots = () => rpc<string[]>("visit_slots", {});
export const recordView = (propertyId: string) => rpc<void>("record_property_view", { p_property_id: propertyId, p_session_id: null, p_source: "mobile" }).catch(() => undefined);
