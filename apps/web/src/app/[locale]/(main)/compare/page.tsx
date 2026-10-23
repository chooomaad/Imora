import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Minus, Scale } from "lucide-react";
import { formatPrice } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { CompareRemove } from "@/features/compare/CompareRemove";
import { localizedPlace, localizedTitle, priceParts } from "@/features/properties/format";
import { getPropertiesByIds } from "@/services/properties.server";

export default async function ComparePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ids?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const ids = ((await searchParams).ids ?? "").split(",").filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 4);
  const items = await getPropertiesByIds(ids);

  const bool = (v: boolean) => (v ? <Check className="mx-auto size-5 text-green" /> : <Minus className="mx-auto size-5 text-subtle" />);
  const rows: { label: string; cell: (p: (typeof items)[number]) => React.ReactNode; best?: (p: (typeof items)[number]) => number | null; lower?: boolean }[] = [
    { label: t("compare.price"), cell: (p) => { const pp = priceParts(p.price, p.price_period, locale); return <span className="ltr-nums font-semibold">{pp.amount} {pp.currency} {pp.period}</span>; }, best: (p) => p.price, lower: true },
    { label: t("compare.area"), cell: (p) => (p.area_m2 ? `${Math.round(Number(p.area_m2))} m²` : "—"), best: (p) => (p.area_m2 ? Number(p.area_m2) : null) },
    { label: t("compare.pricePerM2"), cell: (p) => (p.area_m2 && p.price_period === "total" ? `${formatPrice(Math.round(p.price / Number(p.area_m2)))} MRU` : "—"), best: (p) => (p.area_m2 && p.price_period === "total" ? p.price / Number(p.area_m2) : null), lower: true },
    { label: t("compare.bedrooms"), cell: (p) => p.bedrooms ?? "—", best: (p) => p.bedrooms },
    { label: t("compare.bathrooms"), cell: (p) => p.bathrooms ?? "—", best: (p) => p.bathrooms },
    { label: t("compare.parking"), cell: (p) => (p.parking_spaces ? p.parking_spaces : bool(false)) },
    { label: t("filters.pool"), cell: (p) => bool(p.has_pool) },
    { label: t("compare.location"), cell: (p) => localizedPlace(p, locale) },
    { label: t("compare.tour"), cell: (p) => bool(p.has_3d || p.has_360) },
    { label: t("filters.verified"), cell: (p) => bool(p.is_verified) },
    { label: t("compare.yield"), cell: (p) => (p.estimated_yield ? `~${Number(p.estimated_yield).toFixed(1)}%` : "—"), best: (p) => (p.estimated_yield ? Number(p.estimated_yield) : null) },
  ];

  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <SectionTitle>{t("compare.title")}</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={<Scale className="size-5" />} title={t("compare.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
          <table className="w-full min-w-[640px] text-center text-[14px]">
            <thead>
              <tr>
                <th className="w-40" />
                {items.map((p) => (
                  <th key={p.id} className="p-3 align-top font-normal">
                    <Link href={`/property/${p.slug}`} className="block">
                      <span className="relative mb-2 block aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                        {p.cover_url && <Image src={p.cover_url} alt="" fill sizes="220px" className="object-cover" />}
                      </span>
                      <span className="line-clamp-2 font-semibold text-ink">{localizedTitle(p, locale)}</span>
                    </Link>
                    <CompareRemove id={p.id} ids={ids} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const values = r.best ? items.map((p) => r.best!(p)) : [];
                const valid = values.filter((v): v is number => v != null);
                const bestVal = valid.length > 1 ? (r.lower ? Math.min(...valid) : Math.max(...valid)) : null;
                return (
                  <tr key={r.label} className="border-t border-line">
                    <th className="px-4 py-3 text-start text-[13px] font-semibold text-muted">{r.label}</th>
                    {items.map((p, i) => (
                      <td key={p.id} className={`px-3 py-3 ${bestVal != null && values[i] === bestVal ? "bg-green-soft font-semibold text-green" : ""}`}>{r.cell(p)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
