import type { Metadata } from "next";
import Image from "next/image";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, Building } from "lucide-react";
import { formatPrice, placeName, type Locale } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { listProjects } from "@/services/orgs.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("project");
  return { title: t("title") };
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const format = await getFormatter();
  const projects = await listProjects();

  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <div>
        <SectionTitle>{t("project.title")}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t("project.subtitle")}</p>
      </div>
      {projects.length === 0 ? (
        <EmptyState icon={<Building className="size-5" />} title={t("common.none")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const available = p.units.filter((u) => u.status === "available").length;
            return (
              <Link key={p.id} href={`/projects/${p.slug}`} className="group block">
                <Card className="overflow-hidden">
                  <div className="relative aspect-[16/10] bg-surface-2">
                    {p.cover_url && <Image src={p.cover_url} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />}
                    <div className="absolute start-3 top-3 flex gap-1.5">
                      <Badge variant="dark">{t(`project.status.${p.status}`)}</Badge>
                      {p.is_demo && <Badge variant="demo">{t("common.demo")}</Badge>}
                    </div>
                  </div>
                  <div className="space-y-2 p-5">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gold">
                      {p.developer?.company_name} {p.developer?.is_verified && <BadgeCheck className="size-3.5" />}
                    </p>
                    <h3 className="text-[19px] font-semibold">{locale === "ar" && p.name_ar ? p.name_ar : p.name}</h3>
                    <p className="text-[13px] text-muted">{[placeName(p.district, locale as Locale), placeName(p.city, locale as Locale)].filter(Boolean).join(", ")}</p>
                    {p.price_from && <p className="font-semibold ltr-nums">{t("project.priceFrom", { price: formatPrice(p.price_from) })}</p>}
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${p.progress_pct}%` }} />
                    </div>
                    <p className="flex justify-between text-[12px] text-muted">
                      <span>{t("project.progress", { value: p.progress_pct })}</span>
                      {p.delivery_date && <span>{t("project.delivery", { date: format.dateTime(new Date(p.delivery_date), { month: "short", year: "numeric" }) })}</span>}
                    </p>
                    <p className="text-[12.5px] font-semibold text-green">{available} / {p.units.length} {t("project.available").toLowerCase()}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
