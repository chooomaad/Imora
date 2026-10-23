import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BedDouble, Car, CircleCheck, Droplets, FileCheck2, Landmark, MapPin, Ruler, School, ScanLine, ShieldCheck,
  MoonStar, ShoppingBag, ShowerHead, Sofa, Trees, Umbrella, UserCheck, Waves, Zap,
} from "lucide-react";
import { formatArea, formatPrice } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, Eyebrow } from "@/components/ui/primitives";
import { Icon3D } from "@/components/icons";
import { BackHeader } from "@/components/layout/BackHeader";
import { Gallery } from "@/features/property-detail/Gallery";
import { ContactCard } from "@/features/property-detail/ContactCard";
import { VisitBooking } from "@/features/property-detail/VisitBooking";
import { NeighborhoodMap } from "@/features/property-detail/NeighborhoodMap";
import { CompareToggle, DeclareTransactionButton, ReportButton, ShareButton, ViewTracker } from "@/features/property-detail/Actions";
import { FavoriteButton } from "@/features/properties/FavoriteButton";
import { PropertyCardCompact } from "@/features/properties/PropertyCard";
import { localizedPlace, localizedTitle, priceParts } from "@/features/properties/format";
import { getPropertyBySlug, getSimilarProperties } from "@/services/properties.server";
import { getSession } from "@/services/auth.server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const p = await getPropertyBySlug(slug);
  if (!p) return {};
  const title = localizedTitle(p, locale);
  const cover = p.media.find((m) => m.kind === "image")?.url;
  return {
    title,
    description: (locale === "ar" ? p.description_ar : p.description)?.slice(0, 160) ?? undefined,
    openGraph: { title, images: cover ? [{ url: cover }] : undefined },
    robots: p.is_demo ? { index: false } : undefined,
  };
}

const NEARBY_ICONS: Record<string, React.ReactNode> = {
  school: <School className="size-5" />,
  embassy: <Landmark className="size-5" />,
  shop: <ShoppingBag className="size-5" />,
  mosque: <MoonStar className="size-5" />,
  beach: <Umbrella className="size-5" />,
};

function Feature({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="mt-0.5 text-gold">{icon}</span>
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold text-ink ltr-nums">{title}</p>
        {sub && <p className="text-[12.5px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export default async function PropertyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const [p, session] = await Promise.all([getPropertyBySlug(slug), getSession()]);
  if (!p) notFound();
  const similar = await getSimilarProperties(p.id, 4);

  const title = localizedTitle(p, locale);
  const price = priceParts(p.price, p.price_period, locale);
  const description = (locale === "ar" && p.description_ar) || p.description;
  const isOwn = session.userId === p.owner_id;
  const hasTour = Boolean(p.tour) && (p.has_360 || p.has_3d);
  const generatorKva = p.features.find((f) => f.feature_key === "generator_kva")?.value;

  return (
    <>
      <BackHeader
        title={t("property.detailsTitle")}
        actions={<><ShareButton title={title} /><FavoriteButton propertyId={p.id} size="sm" className="shadow-none" /></>}
      />
      <ViewTracker propertyId={p.id} />

      <div className="mx-auto max-w-7xl pb-32 sm:px-6 sm:pt-6 lg:pb-16">
        {p.is_demo && (
          <p className="bg-[#fff4d6] px-4 py-2 text-center text-[12.5px] font-semibold text-[#7a5a00] dark:bg-[#3a2f12] dark:text-[#f0d27a] sm:mb-4 sm:rounded-xl">
            {t("common.demoNotice")}
          </p>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">
          {/* ------------------------------------------------ Main column */}
          <div className="space-y-5 lg:col-start-1 lg:row-start-1">
            <Gallery media={p.media} title={title}>
              <div className="mb-3 flex flex-wrap gap-2">
                {p.is_verified && <Badge icon={<CircleCheck className="size-3.5 text-green" />}>{t("property.verified100")}</Badge>}
                {p.documents_verified && <Badge icon={<FileCheck2 className="size-3.5 text-gold" />}>{t("property.titleVerified")}</Badge>}
              </div>
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#f1d58c]">
                <MapPin className="size-3.5" /> {localizedPlace(p, locale)}
              </p>
              <h2 className="mt-1 font-display text-[30px] leading-tight text-white sm:text-[40px]">{title}</h2>
            </Gallery>

            <div className="space-y-5 px-4 sm:px-0">
              {hasTour && (
                <section className="relative overflow-hidden rounded-[24px] bg-[#0f0e0c] p-5 text-white shadow-lift">
                  <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(214,176,92,0.25),transparent_65%)]" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-[#e8c66d]"><Icon3D size={22} /></span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e8c66d]">{t("property.immersionEyebrow")}</p>
                        <p className="font-display text-[22px] leading-tight">{t("property.immersionTitle")}</p>
                      </div>
                    </div>
                    {p.tour?.is_verified && <Badge variant="gold" className="shrink-0">{t("property.vrCertified")}</Badge>}
                  </div>
                  <p className="relative mt-3 text-[14px] leading-relaxed text-white/60">{t("property.immersionText")}</p>
                  <ButtonLink href={`/property/${p.slug}/tour`} variant="goldLight" className="relative mt-4 h-12 w-full !text-[#16130d] !bg-[#f6dc98]">
                    <Icon3D size={18} /> {t("property.launchTour")}
                  </ButtonLink>
                </section>
              )}

              {/* Price */}
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">
                      {p.price_period === "total" ? t("property.acquisitionPrice") : t("property.monthlyRent")}
                    </p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-[34px] font-bold tracking-tight text-ink tabular ltr-nums">{price.amount}</span>
                      <span className="text-sm font-bold text-muted">{price.currency} {price.period}</span>
                    </p>
                  </div>
                  {p.price_negotiable && <Badge variant="outline">{t("property.negotiable")}</Badge>}
                </div>
                {p.notary_fees_estimate && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[13.5px]">
                    <span className="flex items-center gap-2 text-muted"><Landmark className="size-4" /> {t("property.notaryFees")}</span>
                    <span className="font-semibold ltr-nums">~ {formatPrice(p.notary_fees_estimate)} MRU</span>
                  </div>
                )}
                {p.estimated_yield != null && (
                  <p className="mt-3 text-[13px] text-muted">
                    {t("property.estimatedYield")} : <strong className="text-green ltr-nums">~{Number(p.estimated_yield).toFixed(1)}%</strong> · {t("home.estimated")}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <CompareToggle propertyId={p.id} />
                  <span className="text-[12px] text-subtle">{t("property.reference", { ref: p.reference })}</span>
                </div>
              </Card>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { on: p.owner?.is_verified || p.agency?.is_verified, icon: <UserCheck className="size-5" />, label: p.agency ? t("property.agencyVerified") : t("property.ownerVerified") },
                  { on: p.documents_verified, icon: <ShieldCheck className="size-5" />, label: t("property.cadastre") },
                  { on: p.tour?.is_verified, icon: <ScanLine className="size-5" />, label: t("property.scannedByImora") },
                ].map((x) => (
                  <div key={x.label} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ${x.on ? "border-gold/25 bg-gold-soft text-ink" : "border-line bg-surface text-subtle"}`}>
                    <span className={x.on ? "text-gold" : ""}>{x.icon}</span>
                    <span className="text-[12px] font-semibold leading-tight">{x.label}</span>
                  </div>
                ))}
              </div>

              {/* Key features */}
              <section className="space-y-3">
                <h2 className="text-[20px] font-semibold text-ink">{t("property.keyFeatures")}</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {p.bedrooms != null && <Feature icon={<BedDouble className="size-5" />} title={t("property.bedrooms", { count: p.bedrooms })} sub={t("property.bedroomsSub")} />}
                  {p.bathrooms != null && <Feature icon={<ShowerHead className="size-5" />} title={t("property.bathrooms", { count: p.bathrooms })} sub={t("property.bathroomsSub")} />}
                  {p.area_m2 != null && (
                    <Feature icon={<Ruler className="size-5" />} title={t("property.livingArea", { area: formatArea(Number(p.area_m2)) })}
                      sub={p.land_area_m2 ? t("property.landArea", { area: formatArea(Number(p.land_area_m2)) }) : undefined} />
                  )}
                  {p.area_m2 == null && p.land_area_m2 != null && <Feature icon={<Ruler className="size-5" />} title={formatArea(Number(p.land_area_m2))} />}
                  {p.has_pool && <Feature icon={<Waves className="size-5" />} title={t("property.privatePool")} sub={t("property.poolSub")} />}
                  {p.parking_spaces > 0 && <Feature icon={<Car className="size-5" />} title={t("property.parkings", { count: p.parking_spaces })} sub={t("property.parkingSub")} />}
                  {p.has_generator && <Feature icon={<Zap className="size-5" />} title={t("property.generator")} sub={generatorKva ? t("property.generatorSub", { kva: generatorKva }) : undefined} />}
                  {p.has_garden && <Feature icon={<Trees className="size-5" />} title={t("property.garden")} />}
                  {p.furnished && <Feature icon={<Sofa className="size-5" />} title={t("property.furnished")} />}
                </div>
                {p.water_tank_liters && (
                  <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px]">
                    <span className="flex items-center gap-2 text-ink-2"><Droplets className="size-4 text-gold" /> {t("property.waterTank")}</span>
                    <span className="font-semibold ltr-nums">{t("property.liters", { count: formatPrice(p.water_tank_liters) })}</span>
                  </div>
                )}
              </section>

              {/* Description */}
              {description && (
                <section className="space-y-3">
                  <h2 className="text-[20px] font-semibold text-ink">{t("property.description")}</h2>
                  <Card className="space-y-3 p-5 text-[15px] leading-relaxed text-ink-2">
                    {description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
                  </Card>
                </section>
              )}

              {/* Neighborhood */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] font-semibold text-ink">{t("property.neighborhood")}</h2>
                    <p className="text-[13px] text-muted">{localizedPlace(p, locale)}</p>
                  </div>
                  {p.location?.is_approximate && <Badge variant="outline">{t("property.approximateLocation")}</Badge>}
                </div>
                {p.location && (
                  <NeighborhoodMap lng={p.location.lng} lat={p.location.lat} approximate={p.location.is_approximate}
                    label={`${t("propertyTypes." + p.property_type as never)} ${t("property.reference", { ref: p.reference })}`} />
                )}
                {p.nearby.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {p.nearby.map((n) => (
                      <div key={n.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
                        <span className="text-gold">{NEARBY_ICONS[n.category] ?? <MapPin className="size-5" />}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink">{n.name}</p>
                          {n.travel_minutes != null && (
                            <p className="text-[12px] text-muted">{n.travel_mode === "walk" ? t("property.minutesWalk", { count: n.travel_minutes }) : t("property.minutesCar", { count: n.travel_minutes })}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          </div>

          {/* ------------------------------------------- Booking & contact (sidebar on desktop) */}
          <aside className="mt-5 px-4 sm:px-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            <div className="space-y-5 lg:sticky lg:top-24">
              <VisitBooking propertyId={p.id} isOwn={isOwn} />
              <ContactCard property={p} />
            </div>
          </aside>

          <div className="mt-5 space-y-5 px-4 sm:px-0 lg:col-start-1">
              {similar.length > 0 && (
                <section className="space-y-3">
                  <Eyebrow>{t("property.similar")}</Eyebrow>
                  <div className="grid gap-3 md:grid-cols-2">
                    {similar.map((s) => <PropertyCardCompact key={s.id} p={s} className="shadow-soft" />)}
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <ReportButton propertyId={p.id} />
                {!isOwn && session.userId && <DeclareTransactionButton propertyId={p.id} listingType={p.listing_type} defaultAmount={p.price} />}
                <span className="text-[12px] text-subtle ltr-nums">{t("property.views", { count: p.views_count })}</span>
              </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-safe backdrop-blur-xl lg:hidden">
        <div className="mx-auto mb-3 grid max-w-lg grid-cols-2 gap-3">
          <ButtonLink href="#visit" variant="secondary" className="h-12">{t("visit.physical")}</ButtonLink>
          {hasTour ? (
            <ButtonLink href={`/property/${p.slug}/tour`} className="h-12"><Icon3D size={17} className="text-gold-bright" />{p.has_3d ? t("property.tour3d") : t("property.tour360")}</ButtonLink>
          ) : (
            <ButtonLink href="#contact" className="h-12">{t("property.contact")}</ButtonLink>
          )}
        </div>
      </div>
    </>
  );
}
