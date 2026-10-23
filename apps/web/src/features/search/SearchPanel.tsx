"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, ChevronDown, MapPin, Search, SlidersHorizontal, Wallet } from "lucide-react";
import { filtersToSearchParams, formatPrice, PROPERTY_TYPES, type ListingType, type PropertyFilters, type PropertyType } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Chip, Segmented } from "@/components/ui/primitives";
import { Icon3D } from "@/components/icons";
import { cn } from "@/lib/cn";
import { BUDGET_STEPS, decodeLocation, locationOptions } from "./locationOptions";
import { useLiveCount } from "./useLiveCount";

function PickerField({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("relative flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 transition focus-within:border-gold-bright", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-subtle">{label}</span>
        {children}
      </span>
      <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted" aria-hidden />
    </label>
  );
}

const selectCls = "w-full cursor-pointer appearance-none truncate bg-transparent text-[14.5px] font-semibold text-ink outline-none";

/** Home search: Acheter / Louer / Investir + location, type, budget and optional extra filters. */
export function SearchPanel({ initialCount }: { initialCount: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<ListingType>("sale");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [budget, setBudget] = useState<number | "">("");
  const [more, setMore] = useState(false);
  const [extra, setExtra] = useState<Pick<PropertyFilters, "bedrooms_min" | "area_min" | "parking" | "pool" | "has_3d" | "verified">>({});

  const filters: PropertyFilters = {
    listing_type: tab,
    ...decodeLocation(location),
    ...(type ? { property_types: [type] } : {}),
    ...(budget ? { price_max: budget } : {}),
    ...extra,
  };
  const count = useLiveCount(filters, initialCount);

  const submit = () => router.push(`/explore?${filtersToSearchParams(filters).toString()}`);
  const toggle = (k: "parking" | "pool" | "has_3d" | "verified") => setExtra((e) => ({ ...e, [k]: e[k] ? undefined : true }));

  return (
    <Card className="@container p-3.5 sm:p-4">
      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          setBudget("");
        }}
        options={(["sale", "rent", "investment"] as const).map((v) => ({ value: v, label: t(`search.tabs.${v}`) }))}
      />
      <div className="mt-3 grid gap-2.5 @3xl:grid-cols-[1.4fr_1fr_1fr_auto]">
        <PickerField icon={<MapPin className="size-[18px]" />} label={t("search.location")}>
          <select className={selectCls} value={location} onChange={(e) => setLocation(e.target.value)} aria-label={t("search.location")}>
            <option value="">{t("search.locationPlaceholder")}</option>
            {locationOptions(locale).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </PickerField>
        <div className="grid grid-cols-2 gap-2.5 @3xl:contents">
          <PickerField icon={<Building2 className="size-[18px]" />} label={t("search.propertyType")}>
            <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as PropertyType | "")} aria-label={t("search.propertyType")}>
              <option value="">{t("search.anyType")}</option>
              {PROPERTY_TYPES.map((p) => (
                <option key={p} value={p}>{t(`propertyTypes.${p}`)}</option>
              ))}
            </select>
          </PickerField>
          <PickerField icon={<Wallet className="size-[18px]" />} label={t("search.budgetMax")}>
            <select className={selectCls} value={budget} onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : "")} aria-label={t("search.budgetMax")}>
              <option value="">{t("search.anyBudget")}</option>
              {BUDGET_STEPS[tab].map((b) => (
                <option key={b} value={b}>≤ {formatPrice(b)} MRU</option>
              ))}
            </select>
          </PickerField>
        </div>
        <Button size="lg" onClick={submit} className="hidden h-auto min-h-14 @3xl:inline-flex">
          <Search className="size-[18px]" />
          {count == null ? t("search.exploreNoCount") : t("search.explore", { count })}
        </Button>
      </div>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
        className="mt-3 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted hover:text-ink">
        <SlidersHorizontal className="size-4" />
        {t("search.moreFilters")}
        <ChevronDown className={cn("size-4 transition", more && "rotate-180")} />
      </button>
      {more && (
        <div className="mt-3 animate-fade-up space-y-3">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} active={extra.bedrooms_min === n} onClick={() => setExtra((e) => ({ ...e, bedrooms_min: e.bedrooms_min === n ? undefined : n }))}>
                {n}+ {t("filters.bedrooms").toLowerCase()}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[100, 200, 300, 500].map((a) => (
              <Chip key={a} active={extra.area_min === a} onClick={() => setExtra((e) => ({ ...e, area_min: e.area_min === a ? undefined : a }))}>
                ≥ {a} m²
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={!!extra.parking} onClick={() => toggle("parking")}>{t("filters.parking")}</Chip>
            <Chip active={!!extra.pool} onClick={() => toggle("pool")}>{t("filters.pool")}</Chip>
            <Chip active={!!extra.has_3d} onClick={() => toggle("has_3d")}><Icon3D size={16} />{t("filters.has_3d")}</Chip>
            <Chip active={!!extra.verified} onClick={() => toggle("verified")}>{t("filters.verified")}</Chip>
          </div>
        </div>
      )}

      <Button size="lg" onClick={submit} className="mt-3 flex w-full @3xl:hidden">
        <Search className="size-[18px]" />
        {count == null ? t("search.exploreNoCount") : t("search.explore", { count })}
      </Button>
    </Card>
  );
}
