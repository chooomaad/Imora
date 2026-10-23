import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { filtersFromSearchParams } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { ExplorerView } from "@/features/search/ExplorerView";
import { searchProperties } from "@/services/properties.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("explore") };
}

export default async function ExplorePage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const filters = filtersFromSearchParams(await searchParams);
  const { items, total } = await searchProperties(filters, 0);

  return (
    <div className="px-4 pt-5 sm:px-6">
      <ExplorerView filters={filters} initial={items} total={total} />
    </div>
  );
}
