import "server-only";
import type { PropertyFilters, PropertyCard, Tour } from "@imora/shared";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { PropertyDetail } from "@/types/models";
import { TOUR_SELECT, normalizeTour } from "@/features/tour/tourQuery";

export const PAGE_SIZE = 12;

export async function searchProperties(filters: PropertyFilters, page = 0, pageSize = PAGE_SIZE) {
  if (!isSupabaseConfigured) return { items: [] as PropertyCard[], total: 0 };
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("search_properties", {
    p_filters: filters,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  const items = (data ?? []) as PropertyCard[];
  return { items, total: Number(items[0]?.total_count ?? 0) };
}

export async function countProperties(filters: PropertyFilters = {}) {
  if (!isSupabaseConfigured) return 0;
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("count_properties", { p_filters: filters });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getPropertiesByIds(ids: string[]): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("search_properties", {
    p_filters: {},
    p_limit: Math.min(ids.length, 60),
    p_offset: 0,
    p_ids: ids,
  });
  if (error) throw error;
  const rows = (data ?? []) as PropertyCard[];
  // Preserve the requested order
  return ids.map((id) => rows.find((p) => p.id === id)).filter((p): p is PropertyCard => Boolean(p));
}

const DETAIL_SELECT = `
  id, slug, reference, title, title_ar, description, description_ar, listing_type, property_type, status,
  price, price_period, price_negotiable, notary_fees_estimate, owner_id, agency_id, agent_id,
  city, district, address, bedrooms, bathrooms, area_m2, land_area_m2, parking_spaces,
  has_pool, has_garden, has_generator, water_tank_liters, furnished, available_from,
  estimated_yield, occupancy_rate, is_verified, documents_verified, has_360, has_3d,
  views_count, is_demo, published_at,
  media:property_media(id, kind, url, caption, position, is_cover, width, height),
  features:property_features(feature_key, value),
  nearby:property_nearby(id, category, name, travel_minutes, travel_mode),
  agency:agencies(id, slug, name, name_ar, logo_url, is_verified, rating_avg, rating_count, avg_response_minutes, is_demo),
  owner:profiles!properties_owner_id_fkey(id, full_name, avatar_url, is_verified),
  agent:agents(id, title, profile:profiles(full_name, avatar_url)),
  tours:property_3d_tours(id, title, is_verified, status)
`;

export async function getPropertyBySlug(slug: string): Promise<PropertyDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("properties").select(DETAIL_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: loc } = await supabase.rpc("property_location", { p_property_id: data.id });
  const row = data as unknown as Omit<PropertyDetail, "location" | "tour"> & {
    tours: { id: string; title: string; is_verified: boolean; status: string }[];
  };
  const tour = row.tours?.find((t) => t.status === "published") ?? null;
  const media = [...(row.media ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position);
  return {
    ...row,
    media,
    location: Array.isArray(loc) && loc[0] ? loc[0] : null,
    tour: tour ? { id: tour.id, title: tour.title, is_verified: tour.is_verified } : null,
  };
}

export async function getSimilarProperties(propertyId: string, limit = 6): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("similar_properties", { p_property_id: propertyId, p_limit: limit });
  if (error) return [];
  return getPropertiesByIds((data ?? []).map((r: string | { similar_properties: string }) => (typeof r === "string" ? r : r.similar_properties)));
}

export async function getTourForProperty(propertyId: string): Promise<Tour | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("property_3d_tours")
    .select(TOUR_SELECT)
    .eq("property_id", propertyId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeTour(data) : null;
}

/** Published listings that have a 360°/3D tour (for the "3D Visite" tab). */
export async function listTourProperties(limit = 30) {
  return searchProperties({ has_360: true }, 0, limit);
}

/** Indicative yield across investment listings (never presented as guaranteed). */
export async function getInvestmentSnapshot() {
  if (!isSupabaseConfigured) return { avgYield: null as number | null, avgOccupancy: null as number | null, count: 0 };
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("properties")
    .select("estimated_yield, occupancy_rate")
    .eq("status", "published")
    .not("estimated_yield", "is", null);
  const rows = data ?? [];
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  return {
    avgYield: avg(rows.map((r) => Number(r.estimated_yield))),
    avgOccupancy: avg(rows.filter((r) => r.occupancy_rate != null).map((r) => Number(r.occupancy_rate))),
    count: rows.length,
  };
}
