import { formatPrice, placeName, type Locale, type PricePeriod } from "@imora/shared";

/** Localized title with Arabic fallback to French. */
export function localizedTitle(p: { title: string; title_ar?: string | null }, locale: string) {
  return locale === "ar" && p.title_ar ? p.title_ar : p.title;
}

export function localizedPlace(p: { city: string; district?: string | null }, locale: string) {
  const l = locale as Locale;
  return [placeName(p.district, l), placeName(p.city, l)].filter(Boolean).join(locale === "ar" ? "، " : ", ");
}

export function priceParts(price: number, period: PricePeriod, locale: string) {
  return {
    amount: formatPrice(price, locale as Locale),
    currency: locale === "ar" ? "أوقية" : "MRU",
    period: period === "month" ? (locale === "ar" ? "/ شهر" : "/ mois") : period === "year" ? (locale === "ar" ? "/ سنة" : "/ an") : "",
  };
}
