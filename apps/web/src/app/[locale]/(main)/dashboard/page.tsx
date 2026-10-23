import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Eye, Heart, Home, MessageCircle, MessageSquare, Phone, PhoneCall, Sparkles, CalendarDays, Trophy } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { getLeads, getListingStats, getMyAgency, type ListingStats } from "@/services/dashboard.server";

const KPI_ICONS: Record<keyof ListingStats, React.ReactNode> = {
  listings: <Home className="size-5" />,
  views: <Eye className="size-5" />,
  favorites: <Heart className="size-5" />,
  phone_reveals: <Phone className="size-5" />,
  calls: <PhoneCall className="size-5" />,
  whatsapp: <MessageCircle className="size-5" />,
  messages: <MessageSquare className="size-5" />,
  leads: <Sparkles className="size-5" />,
  visits: <CalendarDays className="size-5" />,
  conversions: <Trophy className="size-5" />,
};

export default async function DashboardHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const agency = await getMyAgency();
  const [stats, leads] = await Promise.all([getListingStats(agency?.id ?? null), getLeads()]);

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-muted">{t("last30")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats && (Object.keys(KPI_ICONS) as (keyof ListingStats)[]).map((k) => (
            <Card key={k} className="p-4">
              <span className="text-gold">{KPI_ICONS[k]}</span>
              <p className="mt-2 text-[26px] font-bold leading-none ltr-nums">{format.number(stats[k] ?? 0)}</p>
              <p className="mt-1 text-[12.5px] text-muted">{t(`kpi.${k}`)}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">{t("leads")}</h2>
          <Link href="/dashboard/leads" className="text-sm font-semibold text-gold">→</Link>
        </div>
        <Card className="divide-y divide-line">
          {leads.slice(0, 6).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.buyer?.full_name ?? "—"}</p>
                <p className="truncate text-[12.5px] text-muted">{l.property?.title} · {t(`leadSource.${l.source}` as never)}</p>
              </div>
              <Badge variant="soft">{t(`leadStatus.${l.status}` as never)}</Badge>
            </div>
          ))}
          {leads.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">{t("noLeads")}</p>}
        </Card>
      </section>
    </div>
  );
}
