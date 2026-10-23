import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { SectionTitle } from "@/components/ui/primitives";
import { EstimateForm } from "@/features/search/EstimateForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("estimate");
  return { title: t("title") };
}

export default async function EstimatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("estimate");
  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <div>
        <SectionTitle>{t("title")}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <EstimateForm />
    </div>
  );
}
