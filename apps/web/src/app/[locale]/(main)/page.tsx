import type { AppLocale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ChartNoAxesCombined, Glasses, LineChart, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { NOUAKCHOTT_DISTRICTS, filtersToSearchParams, placeName, formatPercent, type Locale } from "@imora/shared";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Eyebrow, SectionTitle } from "@/components/ui/primitives";
import { Icon3D } from "@/components/icons";
import { SearchPanel } from "@/features/search/SearchPanel";
import { AiSearchCard } from "@/features/ai/AiSearchCard";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { countProperties, getInvestmentSnapshot, getPropertiesByIds, searchProperties } from "@/services/properties.server";
import { getRecommendedIds } from "@/services/user.server";
import { getSession } from "@/services/auth.server";

const QUICK_PLACES: { city: string; district?: string }[] = [
  { city: "Nouakchott", district: "Tevragh-Zeina" },
  { city: "Nouadhibou" },
  { city: "Nouakchott", district: "Las Palmas" },
  { city: "Nouakchott", district: "Ksar" },
  { city: "Nouakchott", district: "Teyarett" },
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();

  const [saleCount, totalCount, featured, invest, session] = await Promise.all([
    countProperties({ listing_type: "sale" }),
    countProperties({}),
    searchProperties({ verified: true }, 0, 6),
    getInvestmentSnapshot(),
    getSession(),
  ]);
  const recommendations = session.userId ? await getRecommendedIds(6) : [];
  const recommended = await getPropertiesByIds(recommendations.map((r) => r.property_id));

  return (
    <div className="space-y-10 px-4 pt-5 sm:px-6 sm:pt-8 lg:space-y-14">
      {/* ------------------------------------------------------------ Hero */}
      <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-10">
        <div className="min-w-0 animate-fade-up space-y-4 lg:pt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold-soft px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-gold">
            <ShieldCheck className="size-4" />
            {t("home.verifiedBadge")}
          </span>
          <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[54px] lg:text-[64px]">
            {t("home.heroTitleStart")} <em className="font-normal italic text-gold">{t("home.heroTitleAccent")}</em> {t("home.heroTitleEnd")}
          </h1>
          <p className="max-w-xl text-[15.5px] leading-relaxed text-muted sm:text-[17px]">{t("home.heroSubtitle")}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
            {QUICK_PLACES.map((p, i) => (
              <Link
                key={p.district ?? p.city}
                href={`/explore?${filtersToSearchParams({ city: p.city, district: p.district }).toString()}`}
                className={
                  i === 0
                    ? "shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-on-ink"
                    : "shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-2"
                }
              >
                {placeName(p.district ?? p.city, locale as Locale)}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <SearchPanel initialCount={saleCount} />
          <AiSearchCard />
        </div>
      </section>

      {/* ---------------------------------------------- Virtual visit promo */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#0f0e0c] p-5 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(214,176,92,0.28),transparent_65%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold">
            <Icon3D size={16} className="text-[#e8c66d]" /> {t("home.tourBadge")}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#e8c66d]">
            <Glasses className="size-4" /> {t("home.tourDevices")}
          </span>
        </div>
        <div className="relative mt-5 max-w-2xl">
          <h2 className="font-display text-[30px] leading-tight sm:text-[40px]">{t("home.tourTitle")}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{t("home.tourSubtitle")}</p>
        </div>
        <div className="relative mt-6 flex gap-3">
          <ButtonLink href="/tours" className="h-12 flex-1 bg-white text-[#111] hover:bg-white/90 sm:flex-none sm:px-8">
            <Icon3D size={18} /> {t("home.exploreTours")}
          </ButtonLink>
        </div>
      </section>

      {/* ----------------------------------------------- Exceptional homes */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow icon={<Sparkles className="size-3.5" />}>{t("home.selectionEyebrow")}</Eyebrow>
            <SectionTitle>{t("home.selectionTitle")}</SectionTitle>
          </div>
          <Link href="/explore?verified=1" className="flex shrink-0 items-center gap-1 pb-1 text-[13px] font-semibold text-gold hover:underline">
            {t("common.seeAll", { count: totalCount })}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
          {featured.items.map((p, i) => (
            <PropertyCard key={p.id} p={p} priority={i < 2} className="w-[86vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none" />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- Recommendations */}
      {recommended.length > 0 && (
        <section className="space-y-4">
          <div>
            <Eyebrow icon={<Sparkles className="size-3.5" />}>{t("home.recommendedEyebrow")}</Eyebrow>
            <SectionTitle>{t("home.recommendedTitle")}</SectionTitle>
            <p className="mt-1 text-[13px] text-muted">{t("home.recommendedHint")}</p>
          </div>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-3">
            {recommended.map((p) => (
              <PropertyCard key={p.id} p={p} className="w-[86vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none" />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ Investment */}
      <section className="space-y-4">
        <div>
          <Eyebrow icon={<TrendingUp className="size-3.5" />}>{t("home.investEyebrow")}</Eyebrow>
          <SectionTitle>{t("home.investTitle")}</SectionTitle>
        </div>
        <Card className="p-5 sm:p-7">
          {invest.avgYield != null ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <div className="flex items-start justify-between">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{t("home.avgYield")}</p>
                  <span className="grid size-12 place-items-center rounded-full bg-gold-soft text-gold">
                    <ChartNoAxesCombined className="size-6" />
                  </span>
                </div>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-[44px] leading-none text-gold ltr-nums">~{formatPercent(invest.avgYield)}</span>
                  <span className="text-sm text-muted">{t("home.grossYearly")} · {t("home.estimated")}</span>
                </p>
                <p className="mt-4 text-[14px] leading-relaxed text-muted">{t("home.investText", { count: invest.count })}</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-line bg-surface p-4">
                    <p className="text-[12px] text-muted">{t("home.investOpportunities")}</p>
                    <p className="mt-1 text-[22px] font-bold text-green ltr-nums">{invest.count}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-4">
                    <p className="text-[12px] text-muted">{t("home.avgOccupancy")}</p>
                    <p className="mt-1 text-[22px] font-bold text-ink ltr-nums">{invest.avgOccupancy != null ? formatPercent(invest.avgOccupancy, 0) : "—"}</p>
                  </div>
                </div>
                <ButtonLink href="/invest" variant="outline" className="h-12 w-full">
                  <LineChart className="size-4" /> {t("home.investGuide")}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("home.noYieldData")}</p>
          )}
        </Card>
        <p className="text-[12px] text-subtle">{t("invest.disclaimer")}</p>
      </section>

      {/* --------------------------------------------------- Quick links */}
      <section className="grid gap-3 sm:grid-cols-3">
        <ButtonLink href="/estimate" variant="outline" className="h-14">{t("home.estimateCta")}</ButtonLink>
        <ButtonLink href="/projects" variant="outline" className="h-14">{t("home.newProjects")}</ButtonLink>
        <ButtonLink href={`/explore?${filtersToSearchParams({ city: "Nouakchott", district: NOUAKCHOTT_DISTRICTS[0], has_3d: true }).toString()}`} variant="outline" className="h-14">
          <Icon3D size={18} /> {t("filters.has_3d")} · {placeName(NOUAKCHOTT_DISTRICTS[0], locale as Locale)}
        </ButtonLink>
      </section>
    </div>
  );
}
