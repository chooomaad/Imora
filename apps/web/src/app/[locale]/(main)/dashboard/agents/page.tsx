import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { AgentsManager } from "@/features/dashboard/AgentsManager";
import { getMyAgency } from "@/services/dashboard.server";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function AgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const agency = await getMyAgency();
  if (!agency?.isAdmin) notFound();
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("agents")
    .select("id, title, is_active, is_agency_admin, profile:profiles(full_name, avatar_url)")
    .eq("agency_id", agency.id)
    .order("created_at");
  return <AgentsManager agencyId={agency.id} agents={(data ?? []) as never} />;
}
