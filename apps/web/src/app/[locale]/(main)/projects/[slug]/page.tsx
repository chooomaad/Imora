import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import { formatPrice, placeName, type Locale } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { getProject } from "@/services/orgs.server";

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const format = await getFormatter();
  const p = await getProject(slug);
  if (!p) notFound();
  const desc = (locale === "ar" && p.description_ar) || p.description;
  const counts = { available: 0, reserved: 0, sold: 0 };
  p.units.forEach((u) => counts[u.status]++);

  return (
    <div className="space-y-6 px-4 pt-6 sm:px-6">
      <div className="relative aspect-[16/8] overflow-hidden rounded-[28px] bg-surface-2">
        {p.cover_url && <Image src={p.cover_url} alt="" fill priority sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <div className="mb-2 flex gap-1.5">
            <Badge variant="gold">{t(`project.status.${p.status}`)}</Badge>
            {p.is_demo && <Badge variant="demo">{t("common.demo")}</Badge>}
          </div>
          <h1 className="font-display text-[32px] leading-tight sm:text-[44px]">{locale === "ar" && p.name_ar ? p.name_ar : p.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin className="size-4" />{[placeName(p.district, locale as Locale), placeName(p.city, locale as Locale)].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {desc && <Card className="p-5 text-[15px] leading-relaxed text-ink-2">{desc}</Card>}
          <section className="space-y-3">
            <SectionTitle className="text-[24px]">{t("project.units")}</SectionTitle>
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <table className="w-full min-w-[520px] text-[14px]">
                <thead className="text-[12px] text-muted">
                  <tr className="text-start">
                    <th className="px-4 py-3 text-start font-semibold">#</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("filters.bedrooms")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("compare.area")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("compare.price")}</th>
                    <th className="px-4 py-3 text-start font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {p.units.sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true })).map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="px-4 py-2.5 font-medium">{u.label}</td>
                      <td className="px-4 py-2.5">{u.bedrooms ?? "—"}</td>
                      <td className="px-4 py-2.5 ltr-nums">{u.area_m2 ? `${Math.round(Number(u.area_m2))} m²` : "—"}</td>
                      <td className="px-4 py-2.5 ltr-nums">{u.price ? `${formatPrice(u.price)} MRU` : "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant={u.status === "available" ? "green" : "outline"}>{t(`project.${u.status}`)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-1.5 font-semibold">{p.developer?.company_name} {p.developer?.is_verified && <BadgeCheck className="size-4 text-gold" />}</p>
            {p.developer?.description && <p className="text-[13px] text-muted">{p.developer.description}</p>}
            <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-gold" style={{ width: `${p.progress_pct}%` }} /></div>
            <p className="text-[13px] text-muted">{t("project.progress", { value: p.progress_pct })}</p>
            {p.delivery_date && (
              <p className="flex items-center gap-2 text-[13px]"><CalendarClock className="size-4 text-gold" />{t("project.delivery", { date: format.dateTime(new Date(p.delivery_date), { month: "long", year: "numeric" }) })}</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
              <div className="rounded-xl bg-green-soft p-2 text-green"><p className="text-[18px] font-bold">{counts.available}</p>{t("project.available")}</div>
              <div className="rounded-xl bg-gold-soft p-2 text-gold"><p className="text-[18px] font-bold">{counts.reserved}</p>{t("project.reserved")}</div>
              <div className="rounded-xl bg-surface-2 p-2 text-muted"><p className="text-[18px] font-bold">{counts.sold}</p>{t("project.sold")}</div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
