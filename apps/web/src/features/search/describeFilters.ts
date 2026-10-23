import { formatPriceCompact, placeName, type Locale, type PropertyFilters } from "@imora/shared";

type T = (key: string, values?: Record<string, string | number>) => string;

/** Human-readable chips for a set of filters (AI interpretation, active filter bar, saved searches). */
export function describeFilters(f: PropertyFilters, t: T, locale: string): { key: keyof PropertyFilters | "types"; label: string }[] {
  const l = locale as Locale;
  const out: { key: keyof PropertyFilters | "types"; label: string }[] = [];
  if (f.district) out.push({ key: "district", label: placeName(f.district, l) });
  else if (f.city) out.push({ key: "city", label: placeName(f.city, l) });
  if (f.property_types?.length) {
    const types = f.property_types.map((ty) => t(`propertyTypes.${ty}`)).join(" / ");
    out.push({ key: "types", label: f.bedrooms_min ? `${types} ${f.bedrooms_min}+ ${t("filters.bedrooms").toLowerCase()}` : types });
  } else if (f.bedrooms_min) {
    out.push({ key: "bedrooms_min", label: `${f.bedrooms_min}+ ${t("filters.bedrooms").toLowerCase()}` });
  }
  if (f.bathrooms_min) out.push({ key: "bathrooms_min", label: `${f.bathrooms_min}+ ${t("filters.bathrooms").toLowerCase()}` });
  if (f.pool) out.push({ key: "pool", label: t("filters.pool") });
  if (f.parking) out.push({ key: "parking", label: t("filters.parking") });
  if (f.garden) out.push({ key: "garden", label: t("filters.garden") });
  if (f.furnished) out.push({ key: "furnished", label: t("filters.furnished") });
  if (f.has_3d) out.push({ key: "has_3d", label: t("filters.has_3d") });
  if (f.has_360) out.push({ key: "has_360", label: t("filters.has_360") });
  if (f.verified) out.push({ key: "verified", label: t("filters.verified") });
  if (f.price_min) out.push({ key: "price_min", label: `≥ ${formatPriceCompact(f.price_min)} MRU` });
  if (f.price_max) out.push({ key: "price_max", label: `≤ ${formatPriceCompact(f.price_max)} MRU` });
  if (f.area_min) out.push({ key: "area_min", label: `≥ ${f.area_min} m²` });
  if (f.q) out.push({ key: "q", label: `« ${f.q} »` });
  return out;
}
