import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Tour } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { TourBuilderClient } from "@/features/tour/TourBuilderClient";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function TourBuilderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("tourBuilder");
  const supabase = await getSupabaseServer();
  const [{ data: canManage }, { data: property }] = await Promise.all([
    supabase.rpc("can_manage_property", { p_property_id: id }),
    supabase.from("properties").select("id, title").eq("id", id).maybeSingle(),
  ]);
  if (!canManage || !property) notFound();
  // Latest tour (draft or published), full graph is loaded client-side by the builder
  const { data: tour } = await supabase.from("property_3d_tours").select("id").eq("property_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-semibold">{t("title")} · <span className="text-muted">{property.title}</span></h2>
      <TourBuilderClient propertyId={id} propertyTitle={property.title} tourId={(tour as Pick<Tour, "id"> | null)?.id ?? null} />
    </div>
  );
}
