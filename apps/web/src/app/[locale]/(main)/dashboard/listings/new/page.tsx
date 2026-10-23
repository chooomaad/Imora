import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { EMPTY_DRAFT, ListingForm } from "@/features/dashboard/ListingForm";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function NewListingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("listingForm");
  const supabase = await getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const { data: agent } = await supabase.from("agents").select("id, agency_id").eq("profile_id", auth.user!.id).eq("is_active", true).maybeSingle();
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-semibold">{t("title")}</h2>
      <ListingForm initial={EMPTY_DRAFT} photos={[]} agencyId={agent?.agency_id ?? null} agentId={agent?.id ?? null} />
    </div>
  );
}
