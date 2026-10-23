import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState } from "@/components/ui/primitives";
import { VisitActions } from "@/features/property-detail/VisitActions";
import { getOwnerVisits } from "@/services/dashboard.server";

export default async function OwnerVisitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const visits = await getOwnerVisits();
  if (visits.length === 0) return <EmptyState icon={<CalendarDays className="size-5" />} title={t("noVisits")} />;
  return (
    <Card className="divide-y divide-line">
      {visits.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="font-semibold">{v.visitor?.full_name ?? "—"}</p>
            <p className="text-[13px] text-muted">
              <Link href={`/property/${v.property?.slug}`} className="hover:underline">{v.property?.title}</Link>
              {" · "}{format.dateTime(new Date(`${v.date}T00:00:00Z`), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {v.time.slice(0, 5)}
            </p>
            {v.notes && <p className="mt-1 text-[13px] italic text-ink-2">“{v.notes}”</p>}
          </div>
          <VisitActions id={v.id} status={v.status} side="owner" />
        </div>
      ))}
    </Card>
  );
}
