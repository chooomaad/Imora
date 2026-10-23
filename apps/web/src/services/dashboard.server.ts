import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

export type ListingStats = Record<
  "listings" | "views" | "favorites" | "phone_reveals" | "calls" | "whatsapp" | "messages" | "leads" | "visits" | "conversions",
  number
>;

export async function getMyAgency() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.rpc("user_agency_id");
  if (!data) return null;
  const { data: agency } = await supabase.from("agencies").select("id, slug, name, is_verified").eq("id", data).maybeSingle();
  const { data: me } = await supabase.from("agents").select("is_agency_admin").eq("agency_id", data).maybeSingle();
  return agency ? { ...agency, isAdmin: Boolean(me?.is_agency_admin) } : null;
}

export async function getListingStats(agencyId: string | null, days = 30): Promise<ListingStats | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("listing_stats", { p_agency_id: agencyId, p_days: days });
  return error ? null : (data as ListingStats);
}

export interface MyListing {
  id: string;
  slug: string;
  reference: string;
  title: string;
  status: string;
  price: number;
  price_period: "total" | "month" | "year";
  views_count: number;
  favorites_count: number;
  is_verified: boolean;
  has_360: boolean;
  has_3d: boolean;
  updated_at: string;
  media: { url: string | null; is_cover: boolean }[];
}

/** Listings the user can manage (own + agency), RLS-scoped. */
export async function getMyListings(): Promise<MyListing[]> {
  const supabase = await getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const { data: agencyId } = await supabase.rpc("user_agency_id");
  let q = supabase
    .from("properties")
    .select("id, slug, reference, title, status, price, price_period, views_count, favorites_count, is_verified, has_360, has_3d, updated_at, media:property_media(url, is_cover)")
    .order("updated_at", { ascending: false });
  q = agencyId ? q.or(`owner_id.eq.${auth.user!.id},agency_id.eq.${agencyId}`) : q.eq("owner_id", auth.user!.id);
  const { data } = await q;
  return (data ?? []) as unknown as MyListing[];
}

export interface LeadRow {
  id: string;
  source: string;
  status: string;
  interactions_count: number;
  last_activity_at: string;
  notes: string | null;
  buyer_id: string;
  property: { id: string; slug: string; title: string; listing_type: "sale" | "rent" | "investment"; price: number } | null;
  buyer: { full_name: string | null; avatar_url: string | null } | null;
}

export async function getLeads(): Promise<LeadRow[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("property_leads")
    .select("id, source, status, interactions_count, last_activity_at, notes, buyer_id, property:properties(id, slug, title, listing_type, price), buyer:profiles!property_leads_buyer_id_fkey(full_name, avatar_url)")
    .order("last_activity_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as LeadRow[];
}

export async function getOwnerVisits() {
  const supabase = await getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("visits")
    .select("id, date, time, status, notes, user_id, property:properties(slug, title), visitor:profiles!visits_user_id_fkey(full_name)")
    .neq("user_id", auth.user!.id)
    .order("date", { ascending: true })
    .limit(200);
  return (data ?? []) as unknown as {
    id: string; date: string; time: string; status: string; notes: string | null;
    property: { slug: string; title: string } | null; visitor: { full_name: string | null } | null;
  }[];
}
