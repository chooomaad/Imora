import type { PricePeriod } from "./domain";

export type Locale = "fr" | "ar";

const numberLocale: Record<Locale, string> = { fr: "fr-FR", ar: "ar-MR" };

/** Full price, e.g. "8 500 000". Arabic UI keeps Latin digits, which is the norm for prices in Mauritania. */
export function formatPrice(value: number, locale: Locale = "fr"): string {
  return new Intl.NumberFormat(locale === "ar" ? "fr-FR" : numberLocale[locale], {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact price for map markers and chips: 8.5M, 650k, 35k. */
export function formatPriceCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function periodSuffix(period: PricePeriod, locale: Locale = "fr"): string {
  if (period === "month") return locale === "ar" ? "/ شهر" : "/ mois";
  if (period === "year") return locale === "ar" ? "/ سنة" : "/ an";
  return "";
}

export function formatArea(m2: number | null | undefined): string {
  if (m2 == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(m2)} m²`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

/** WhatsApp deep link. Mauritanian numbers are normalized to +222. */
export function whatsappLink(phone: string, text?: string): string {
  const digits = normalizePhone(phone).replace(/^\+/, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 8) return `+222${digits}`;
  return `+${digits}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
