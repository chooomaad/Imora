import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { EmptyState, Eyebrow, SectionTitle } from "@/components/ui/primitives";
import { Icon3D } from "@/components/icons";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { listTourProperties } from "@/services/properties.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("listTitle") };
}

export default async function ToursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("tour");
  const { items } = await listTourProperties();
  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <div>
        <Eyebrow icon={<Icon3D size={14} />}>{t("modes.free3d")} · {t("modes.pano")}</Eyebrow>
        <SectionTitle>{t("listTitle")}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t("listSubtitle")}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Icon3D size={20} />} title={t("noTour")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p, i) => <PropertyCard key={p.id} p={p} priority={i < 3} />)}
        </div>
      )}
    </div>
  );
}
