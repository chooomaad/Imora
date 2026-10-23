import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { BedDouble, CalendarDays, Car, MessageSquareText, Ruler, ShieldCheck, ShowerHead, Waves } from "lucide-react";
import type { PropertyCard as PropertyCardData } from "@imora/shared";
import { Link } from "@/i18n/navigation";
import { Badge, VerifiedIcon } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Icon3D, Icon360 } from "@/components/icons";
import { cn } from "@/lib/cn";
import { FavoriteButton } from "./FavoriteButton";
import { formatPrice } from "@imora/shared";
import { localizedPlace, localizedTitle, priceParts } from "./format";

function Specs({ p, className }: { p: PropertyCardData; className?: string }) {
  const t = useTranslations("property");
  const items: { icon: React.ReactNode; label: string }[] = [];
  if (p.bedrooms) items.push({ icon: <BedDouble className="size-4" />, label: t("beds", { count: p.bedrooms }) });
  if (p.bathrooms) items.push({ icon: <ShowerHead className="size-4" />, label: t("baths", { count: p.bathrooms }) });
  if (p.area_m2) items.push({ icon: <Ruler className="size-4" />, label: `${Math.round(Number(p.area_m2))} m²` });
  if (p.parking_spaces) items.push({ icon: <Car className="size-4" />, label: t("parkings", { count: p.parking_spaces }) });
  if (p.has_pool) items.push({ icon: <Waves className="size-4" />, label: t("privatePool") });
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-muted", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="text-gold">{it.icon}</span>
          <span className="ltr-nums">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Large listing card (home "Biens d'exception", explorer grid). */
export function PropertyCard({ p, priority, className }: { p: PropertyCardData; priority?: boolean; className?: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const title = localizedTitle(p, locale);
  const price = priceParts(p.price, p.price_period, locale);
  const href = `/property/${p.slug}`;
  const yearlyIncome = p.estimated_yield && p.price_period === "total" ? Math.round((p.price * Number(p.estimated_yield)) / 100 / 1000) * 1000 : null;
  const tourHref = `/property/${p.slug}/tour`;

  return (
    <article className={cn("group overflow-hidden rounded-card border border-line/70 bg-surface shadow-soft transition hover:shadow-lift", className)}>
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-surface-2">
        {p.cover_url && (
          <Image
            src={p.cover_url}
            alt={title}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {p.agency_verified ? (
              <Badge icon={<ShieldCheck className="size-3.5 text-gold" />}>{t("property.agencyVerified")}</Badge>
            ) : p.is_verified ? (
              <Badge icon={<VerifiedIcon />}>{t("property.verified")}</Badge>
            ) : null}
            {p.has_3d ? (
              <Badge variant="dark" icon={<Icon3D size={14} className="text-gold-bright" />}>{t("property.tour3d")}</Badge>
            ) : p.listing_type === "rent" ? (
              <Badge variant="gold">{t("property.location")}</Badge>
            ) : null}
            {p.is_demo && <Badge variant="demo">{t("common.demo")}</Badge>}
          </div>
          <FavoriteButton propertyId={p.id} />
        </div>
        {(p.has_360 || p.has_3d) && (
          <div className="absolute bottom-3 start-3">
            <Badge icon={<Icon360 size={14} />}>{p.has_3d ? t("property.panoramic") : t("property.tour360")}</Badge>
          </div>
        )}
      </Link>

      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="ltr-nums text-[26px] font-bold tracking-tight text-ink tabular">{price.amount}</span>
            <span className="text-xs font-bold text-muted">{price.currency} {price.period}</span>
          </p>
          {yearlyIncome ? (
            <span className="text-end text-[13px] text-muted">{t("property.perYearIncome", { amount: formatPrice(yearlyIncome) })}</span>
          ) : p.listing_type === "rent" ? (
            <span className="text-[13px] text-muted">{t("property.availableNow")}</span>
          ) : null}
        </div>
        <div>
          <Link href={href} className="line-clamp-1 text-[19px] font-semibold text-ink hover:underline">{title}</Link>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{localizedPlace(p, locale)}</p>
        </div>
        <Specs p={p} />
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {p.has_3d || p.has_360 ? (
            <>
              <ButtonLink href={`${href}#${p.listing_type === "rent" ? "contact" : "visit"}`} variant="secondary" className="h-12">
                {p.listing_type === "rent" ? <MessageSquareText className="size-4" /> : <CalendarDays className="size-4" />}
                {p.listing_type === "rent" ? t("property.contact") : t("property.planVisit")}
              </ButtonLink>
              <ButtonLink href={tourHref} className="h-12">
                {p.has_3d ? <Icon3D size={17} className="text-gold-bright" /> : <Icon360 size={17} className="text-gold-bright" />}
                {p.has_3d ? t("property.launch3d") : t("property.visit360")}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={`${href}#visit`} variant="secondary" className="h-12">
                <CalendarDays className="size-4" />
                {t("property.planVisit")}
              </ButtonLink>
              <ButtonLink href={`${href}#contact`} className="h-12">
                <MessageSquareText className="size-4" />
                {t("property.contact")}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** Horizontal compact card (map bottom sheet, comparisons, similar listings). */
export function PropertyCardCompact({ p, className }: { p: PropertyCardData; className?: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const price = priceParts(p.price, p.price_period, locale);
  const href = `/property/${p.slug}`;
  return (
    <article className={cn("flex gap-3.5 rounded-card border border-line/70 bg-surface p-2.5 shadow-lift", className)}>
      <Link href={href} className="relative block aspect-[4/3] w-[42%] max-w-44 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
        {p.cover_url && <Image src={p.cover_url} alt="" fill sizes="180px" className="object-cover" />}
        {p.has_3d && (
          <span className="absolute start-2 top-2">
            <Badge variant="dark" icon={<Icon3D size={13} className="text-gold-bright" />}>3D</Badge>
          </span>
        )}
        {p.is_verified && (
          <span className="absolute bottom-2 end-2 grid size-7 place-items-center rounded-full bg-surface shadow-soft">
            <VerifiedIcon className="size-4 text-gold" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1 py-1 pe-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[12px] font-bold uppercase tracking-wide text-gold">{p.district ?? p.city}</p>
          <FavoriteButton propertyId={p.id} size="sm" className="-mt-1 -me-1 shadow-none" />
        </div>
        <Link href={href} className="line-clamp-1 text-[17px] font-semibold text-ink">{localizedTitle(p, locale)}</Link>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="ltr-nums text-[22px] font-bold text-ink tabular">{price.amount}</span>
          <span className="text-[11px] font-bold text-gold">{price.currency} {price.period}</span>
        </p>
        <Specs p={{ ...p, parking_spaces: 0, has_pool: false }} className="mt-1 text-[12.5px]" />
        {p.is_demo && <Badge variant="demo" className="mt-2">{t("common.demo")}</Badge>}
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line/70 bg-surface">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-7 w-1/2 rounded-lg" />
        <div className="skeleton h-5 w-3/4 rounded-lg" />
        <div className="skeleton h-4 w-2/3 rounded-lg" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
