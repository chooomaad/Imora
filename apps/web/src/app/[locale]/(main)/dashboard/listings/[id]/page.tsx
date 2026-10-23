import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { ListingForm, type ListingDraft } from "@/features/dashboard/ListingForm";
import { getSupabaseServer } from "@/lib/supabase/server";

const str = (v: unknown) => (v == null ? "" : String(v));

export default async function EditListingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("listingForm");
  const supabase = await getSupabaseServer();
  // RLS: only the owner / agency members / admins can read a non-published listing
  const { data: p } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: canManage }, { data: media }, { data: loc }] = await Promise.all([
    supabase.rpc("can_manage_property", { p_property_id: id }),
    supabase.from("property_media").select("id, url, is_cover, position, storage_path").eq("property_id", id).eq("kind", "image").order("position"),
    supabase.rpc("property_location_exact", { p_property_id: id }),
  ]);
  if (!canManage) notFound();
  const location = Array.isArray(loc) && loc[0] ? loc[0] : null;

  const initial: ListingDraft = {
    id: p.id, title: p.title, title_ar: str(p.title_ar), description: str(p.description), listing_type: p.listing_type,
    property_type: p.property_type, price: str(p.price), price_period: p.price_period, price_negotiable: p.price_negotiable,
    city: p.city, district: str(p.district), address: str(p.address), bedrooms: str(p.bedrooms), bathrooms: str(p.bathrooms),
    area_m2: str(p.area_m2), land_area_m2: str(p.land_area_m2), parking_spaces: str(p.parking_spaces), has_pool: p.has_pool,
    has_garden: p.has_garden, has_generator: p.has_generator, furnished: p.furnished, water_tank_liters: str(p.water_tank_liters),
    estimated_yield: str(p.estimated_yield), status: p.status,
    location: location ? [location.lng, location.lat] : null,
    is_approximate: location?.is_approximate ?? true,
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-semibold">{t("editTitle")} · <span className="text-muted">{p.reference}</span></h2>
      <ListingForm initial={initial} photos={(media ?? []).filter((m) => m.url) as never} agencyId={p.agency_id} agentId={p.agent_id} />
    </div>
  );
}
