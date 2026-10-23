import { getTranslations, setRequestLocale } from "next-intl/server";
import { Heart, Search } from "lucide-react";
import { filtersToSearchParams, type PropertyFilters } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { SavedSearchActions } from "@/features/search/SavedSearchActions";
import { getPropertiesByIds } from "@/services/properties.server";
import { getMyFavoriteIds, getMySavedSearches } from "@/services/user.server";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const [ids, searches] = await Promise.all([getMyFavoriteIds(), getMySavedSearches()]);
  const favorites = await getPropertiesByIds(ids);

  return (
    <div className="space-y-8 px-4 pt-6 sm:px-6">
      <section className="space-y-4">
        <SectionTitle>{t("favorites.title")}</SectionTitle>
        {favorites.length === 0 ? (
          <EmptyState icon={<Heart className="size-5" />} title={t("favorites.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favorites.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
        )}
      </section>
      <section id="searches" className="scroll-mt-24 space-y-4">
        <h2 className="text-[20px] font-semibold">{t("favorites.savedSearches")}</h2>
        {searches.length === 0 ? (
          <EmptyState icon={<Search className="size-5" />} title={t("favorites.noSavedSearches")} />
        ) : (
          <Card className="divide-y divide-line">
            {searches.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-4">
                <Link href={`/explore?${filtersToSearchParams(s.filters as PropertyFilters).toString()}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                </Link>
                <SavedSearchActions id={s.id} notify={s.notify} />
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
