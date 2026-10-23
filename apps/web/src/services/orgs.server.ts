import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPropertiesByIds } from "./properties.server";

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  city: string;
  district: string | null;
  cover_url: string | null;
  status: "planned" | "under_construction" | "delivered";
  delivery_date: string | null;
  progress_pct: number;
  price_from: number | null;
  is_demo: boolean;
  developer: { company_name: string; slug: string; is_verified: boolean; logo_url: string | null } | null;
  units: { status: "available" | "reserved" | "sold" }[];
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select("id, slug, name, name_ar, city, district, cover_url, status, delivery_date, progress_pct, price_from, is_demo, developer:developers(company_name, slug, is_verified, logo_url), units:project_units(status)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as ProjectSummary[];
}

export async function getProject(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select("*, developer:developers(company_name, slug, is_verified, logo_url, description), units:project_units(id, label, unit_type, floor, bedrooms, bathrooms, area_m2, price, status, plan_url)")
    .eq("slug", slug)
    .maybeSingle();
  return data as (Omit<ProjectSummary, "units" | "developer"> & {
    description: string | null; description_ar: string | null; gallery: string[];
    developer: ProjectSummary["developer"] & { description: string | null };
    units: { id: string; label: string; unit_type: string; floor: number | null; bedrooms: number | null; bathrooms: number | null; area_m2: number | null; price: number | null; status: "available" | "reserved" | "sold"; plan_url: string | null }[];
  }) | null;
}

export async function getAgency(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServer();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, slug, name, name_ar, logo_url, cover_url, description, description_ar, city, address, email, website, is_verified, rating_avg, rating_count, avg_response_minutes, is_demo, agents(id, title, is_active, profile:profiles(full_name, avatar_url))")
    .eq("slug", slug)
    .maybeSingle();
  if (!agency) return null;
  const { data: ids } = await supabase
    .from("properties")
    .select("id")
    .eq("agency_id", agency.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  const listings = await getPropertiesByIds((ids ?? []).map((r) => r.id as string));
  return {
    agency: agency as unknown as {
      id: string; slug: string; name: string; name_ar: string | null; logo_url: string | null; cover_url: string | null;
      description: string | null; description_ar: string | null; city: string | null; address: string | null;
      email: string | null; website: string | null;
      is_verified: boolean; rating_avg: number; rating_count: number; avg_response_minutes: number | null; is_demo: boolean;
      agents: { id: string; title: string | null; is_active: boolean; profile: { full_name: string | null; avatar_url: string | null } | null }[];
    },
    listings,
  };
}
