/**
 * Reference geography for Mauritania. Used for filter pickers and the map's
 * initial viewport only. Property coordinates always come from `property_locations`.
 */
export const CITIES = [
  "Nouakchott",
  "Nouadhibou",
  "Rosso",
  "Atar",
  "Kiffa",
  "Kaédi",
  "Zouerate",
] as const;

export const NOUAKCHOTT_DISTRICTS = [
  "Tevragh-Zeina",
  "Las Palmas",
  "Ksar",
  "Teyarett",
  "Dar Naim",
  "Arafat",
  "Sebkha",
  "El Mina",
] as const;

/** Default map viewport: central Nouakchott. [lng, lat] */
export const DEFAULT_MAP_CENTER: [number, number] = [-15.975, 18.09];
export const DEFAULT_MAP_ZOOM = 12;

export const ARABIC_PLACE_NAMES: Record<string, string> = {
  Nouakchott: "نواكشوط",
  Nouadhibou: "نواذيبو",
  Rosso: "روصو",
  Atar: "أطار",
  Kiffa: "كيفة",
  Kaédi: "كيهيدي",
  Zouerate: "ازويرات",
  "Tevragh-Zeina": "تفرغ زينة",
  "Las Palmas": "لاس بالماس",
  Ksar: "لكصر",
  Teyarett: "تيارت",
  "Dar Naim": "دار النعيم",
  Arafat: "عرفات",
  Sebkha: "السبخة",
  "El Mina": "الميناء",
};

export function placeName(name: string | null | undefined, locale: "fr" | "ar"): string {
  if (!name) return "";
  return locale === "ar" ? (ARABIC_PLACE_NAMES[name] ?? name) : name;
}
