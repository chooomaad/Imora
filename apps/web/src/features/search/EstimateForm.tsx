"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Calculator, Info } from "lucide-react";
import { CITIES, NOUAKCHOTT_DISTRICTS, PROPERTY_TYPES, formatPrice, placeName, type Locale, type PropertyType } from "@imora/shared";
import { Button } from "@/components/ui/Button";
import { Card, Field, Input, Select } from "@/components/ui/primitives";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Estimate =
  | { available: false; comparables: number }
  | { available: true; low: number; high: number; median: number; price_per_m2: number; comparables: number; scope: "district" | "city"; confidence: "low" | "medium" | "high" };

/** "Estimer mon bien" — percentile range from comparable listings (estimate_property_value RPC). */
export function EstimateForm() {
  const t = useTranslations("estimate");
  const tt = useTranslations("propertyTypes");
  const locale = useLocale() as Locale;
  const [city, setCity] = useState("Nouakchott");
  const [district, setDistrict] = useState<string>("Tevragh-Zeina");
  const [type, setType] = useState<PropertyType>("villa");
  const [area, setArea] = useState("250");
  const [result, setResult] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await getSupabaseBrowser().rpc("estimate_property_value", {
      p_city: city,
      p_district: city === "Nouakchott" ? district || null : null,
      p_property_type: type,
      p_area_m2: Number(area),
      p_listing_type: "sale",
    });
    setLoading(false);
    setResult(error ? { available: false, comparables: 0 } : (data as Estimate));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("city")}>
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => <option key={c} value={c}>{placeName(c, locale)}</option>)}
            </Select>
          </Field>
          <Field label={t("district")}>
            <Select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={city !== "Nouakchott"}>
              <option value="">—</option>
              {NOUAKCHOTT_DISTRICTS.map((d) => <option key={d} value={d}>{placeName(d, locale)}</option>)}
            </Select>
          </Field>
          <Field label={t("type")}>
            <Select value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
              {PROPERTY_TYPES.filter((p) => p !== "project").map((p) => <option key={p} value={p}>{tt(p)}</option>)}
            </Select>
          </Field>
          <Field label={t("area")}>
            <Input inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} required />
          </Field>
          <Button type="submit" size="lg" className="sm:col-span-2" loading={loading} disabled={!Number(area)}>
            <Calculator className="size-5" /> {t("submit")}
          </Button>
        </form>
      </Card>
      <div className="space-y-3">
        {result && (
          <Card className="animate-fade-up p-6">
            {result.available ? (
              <>
                <p className="font-display text-[26px] leading-snug text-ink ltr-nums">
                  {t("result", { low: formatPrice(result.low), high: formatPrice(result.high) })}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {t("basedOn", { count: result.comparables, scope: t(`scope.${result.scope}`) })} · {t(`confidence.${result.confidence}`)}
                </p>
                <p className="mt-1 text-sm text-muted ltr-nums">≈ {formatPrice(result.price_per_m2)} MRU / m²</p>
              </>
            ) : (
              <p className="text-sm text-muted">{t("unavailable")}</p>
            )}
          </Card>
        )}
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] font-medium text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-gold" /> {t("disclaimer")}
        </p>
      </div>
    </div>
  );
}
