import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { VisitActions } from "@/features/property-detail/VisitActions";
import { getSession } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

type VisitRow = {
  id: string;
  date: string;
  time: string;
  status: string;
  property: { slug: string; title: string } | null;
};

export default async function MyVisitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const format = await getFormatter();
  const { userId } = await getSession();
  let visits: VisitRow[] = [];
  if (userId) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("visits")
      .select("id, date, time, status, property:properties(slug, title)")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    visits = (data ?? []) as unknown as VisitRow[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
      <SectionTitle>{t("visit.myVisits")}</SectionTitle>
      {visits.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-5" />} title={t("dashboard.noVisits")} />
      ) : (
        <Card className="divide-y divide-line">
          {visits.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <Link href={`/property/${v.property?.slug}`} className="font-semibold hover:underline">{v.property?.title}</Link>
                <p className="text-[13px] text-muted">
                  {format.dateTime(new Date(`${v.date}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · {v.time.slice(0, 5)}
                </p>
              </div>
              <VisitActions id={v.id} status={v.status} side="visitor" />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
