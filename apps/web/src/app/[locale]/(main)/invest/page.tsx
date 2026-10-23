import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Info, TrendingUp } from "lucide-react";
import { formatPercent } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Card, EmptyState, Eyebrow, SectionTitle } from "@/components/ui/primitives";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { getInvestmentSnapshot, searchProperties } from "@/services/properties.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invest");
  return { title: t("title") };
}

export default async function InvestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const [snapshot, { items, total }] = await Promise.all([
    getInvestmentSnapshot(),
    searchProperties({ listing_type: "investment", sort: "relevance" }, 0, 30),
  ]);

  return (
    <div className="space-y-6 px-4 pt-6 sm:px-6">
      <div>
        <Eyebrow icon={<TrendingUp className="size-3.5" />}>{t("home.investEyebrow")}</Eyebrow>
        <SectionTitle>{t("invest.title")}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t("invest.subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{t("invest.yield")}</p>
          <p className="mt-1 font-display text-[36px] text-gold ltr-nums">{snapshot.avgYield != null ? `~${formatPercent(snapshot.avgYield)}` : "—"}</p>
          <p className="text-[12px] text-subtle">{t("home.grossYearly")} · {t("home.estimated")}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{t("invest.occupancy")}</p>
          <p className="mt-1 font-display text-[36px] text-ink ltr-nums">{snapshot.avgOccupancy != null ? formatPercent(snapshot.avgOccupancy, 0) : "—"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{t("home.investOpportunities")}</p>
          <p className="mt-1 font-display text-[36px] text-green ltr-nums">{total}</p>
        </Card>
      </div>
      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" /> {t("invest.disclaimer")}
      </p>
      {items.length === 0 ? (
        <EmptyState title={t("home.noYieldData")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
