import { CITIES, NOUAKCHOTT_DISTRICTS, placeName, type Locale } from "@imora/shared";

/** Options for the combined "Quartier & ville" picker. Value format: "city|district". */
export function locationOptions(locale: string) {
  const l = locale as Locale;
  const opts: { value: string; label: string }[] = [{ value: "Nouakchott|", label: placeName("Nouakchott", l) }];
  for (const d of NOUAKCHOTT_DISTRICTS) {
    opts.push({ value: `Nouakchott|${d}`, label: `${placeName(d, l)}, ${placeName("Nouakchott", l)}` });
  }
  for (const c of CITIES.filter((c) => c !== "Nouakchott")) opts.push({ value: `${c}|`, label: placeName(c, l) });
  return opts;
}

export function encodeLocation(city?: string, district?: string) {
  return city ? `${city}|${district ?? ""}` : "";
}

export function decodeLocation(value: string): { city?: string; district?: string } {
  if (!value) return {};
  const [city, district] = value.split("|");
  return { city: city || undefined, district: district || undefined };
}

export const BUDGET_STEPS = {
  sale: [1_000_000, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000, 15_000_000, 25_000_000],
  rent: [20_000, 35_000, 50_000, 80_000, 120_000, 200_000],
  investment: [5_000_000, 10_000_000, 20_000_000, 40_000_000],
} as const;
