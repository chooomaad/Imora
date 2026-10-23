import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, Clock, Globe, Mail, MapPin, Star } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { getAgency } from "@/services/orgs.server";

export default async function AgencyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const res = await getAgency(slug);
  if (!res) notFound();
  const { agency, listings } = res;
  const name = locale === "ar" && agency.name_ar ? agency.name_ar : agency.name;
  const desc = (locale === "ar" && agency.description_ar) || agency.description;

  return (
    <div className="space-y-6 px-4 pt-6 sm:px-6">
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={agency.name} src={agency.logo_url} size={84} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="flex items-center gap-2 font-display text-[30px] leading-tight">
            {name} {agency.is_verified && <BadgeCheck className="size-6 text-gold" aria-label={t("property.agencyVerified")} />}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
            <span className="flex items-center gap-1"><Star className="size-4 fill-gold-bright text-gold-bright" /> <span className="ltr-nums">{Number(agency.rating_avg).toFixed(1)}</span> ({t("contact.reviews", { count: agency.rating_count })})</span>
            <span>{t("agency.properties", { count: listings.length })}</span>
            {agency.avg_response_minutes && <span className="flex items-center gap-1"><Clock className="size-4" /> {t("agency.responseTime")} : {t("agency.minutes", { count: agency.avg_response_minutes })}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agency.is_verified && <Badge variant="soft">{t("property.agencyVerified")}</Badge>}
            {agency.is_demo && <Badge variant="demo">{t("common.demo")}</Badge>}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {desc && <Card className="p-5 text-[15px] leading-relaxed text-ink-2">{desc}</Card>}
          <section className="space-y-3">
            <SectionTitle className="text-[24px]">{t("agency.listings")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">{listings.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t("agency.agents")}</h2>
            {agency.agents.filter((a) => a.is_active).map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <Avatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={40} />
                <div>
                  <p className="text-[14px] font-medium">{a.profile?.full_name}</p>
                  <p className="text-[12px] text-muted">{a.title}</p>
                </div>
              </div>
            ))}
          </Card>
          <Card className="space-y-2.5 p-5 text-[14px]">
            <h2 className="font-semibold">{t("agency.contact")}</h2>
            {agency.address && <p className="flex items-start gap-2 text-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-gold" />{agency.address}</p>}
            {agency.email && <a href={`mailto:${agency.email}`} className="flex items-center gap-2 text-muted hover:text-ink"><Mail className="size-4 text-gold" />{agency.email}</a>}
            {agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted hover:text-ink"><Globe className="size-4 text-gold" />{agency.website}</a>}
            <p className="text-[12px] text-subtle">{t("contact.showPhoneAgency")} → {t("property.contact")}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
