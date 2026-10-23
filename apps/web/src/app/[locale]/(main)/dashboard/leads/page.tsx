import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Card, EmptyState } from "@/components/ui/primitives";
import { LeadItem } from "@/features/dashboard/LeadItem";
import { getLeads } from "@/services/dashboard.server";

export default async function LeadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("dashboard");
  const leads = await getLeads();
  if (leads.length === 0) return <EmptyState icon={<Sparkles className="size-5" />} title={t("noLeads")} />;
  return <Card className="divide-y divide-line">{leads.map((l) => <LeadItem key={l.id} lead={l} />)}</Card>;
}
