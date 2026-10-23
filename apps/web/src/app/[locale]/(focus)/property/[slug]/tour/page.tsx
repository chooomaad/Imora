import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { BackHeader } from "@/components/layout/BackHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";
import { ShareButton } from "@/features/property-detail/Actions";
import { TourClient } from "@/features/tour/TourClient";
import { localizedTitle } from "@/features/properties/format";
import { getPropertyBySlug, getTourForProperty } from "@/services/properties.server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await getTranslations("tour");
  const p = await getPropertyBySlug(slug);
  return { title: p ? `${t("pageTitle")} — ${localizedTitle(p, locale)}` : t("pageTitle") };
}

export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();
  const tour = await getTourForProperty(property.id);
  const title = localizedTitle(property, locale);

  return (
    <>
      <BackHeader title={tour?.title ?? t("tour.pageTitle")} actions={<ShareButton title={title} />} />
      {tour && (tour.scenes.length > 0 || tour.rooms.length > 0) ? (
        <TourClient tour={tour} property={{ slug: property.slug, title }} />
      ) : (
        <div className="mx-auto max-w-lg p-6">
          <EmptyState title={t("tour.noTour")} action={<ButtonLink href={`/property/${slug}`} variant="secondary">{t("common.back")}</ButtonLink>} />
        </div>
      )}
    </>
  );
}
