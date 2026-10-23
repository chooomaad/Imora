import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { filtersFromSearchParams } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { MapView } from "@/features/map/MapView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("map") };
}

export default async function MapPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const filters = filtersFromSearchParams(await searchParams);
  return <MapView filters={filters} />;
}
