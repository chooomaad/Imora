import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eye, Heart, Home } from "lucide-react";
import { formatPrice } from "@imora/shared";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { ListingRowActions } from "@/features/dashboard/ListingRowActions";
import { getMyListings } from "@/services/dashboard.server";

export default async function MyListingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const listings = await getMyListings();

  if (listings.length === 0) {
    return <EmptyState icon={<Home className="size-5" />} title={t("dashboard.noListings")} action={<ButtonLink href="/dashboard/listings/new">{t("dashboard.newListing")}</ButtonLink>} />;
  }
  return (
    <Card className="divide-y divide-line">
      {listings.map((l) => {
        const cover = l.media.find((m) => m.is_cover)?.url ?? l.media[0]?.url;
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              {cover && <Image src={cover} alt="" fill sizes="64px" className="object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={l.status === "published" ? `/property/${l.slug}` : `/dashboard/listings/${l.id}`} className="block truncate font-semibold hover:underline">{l.title}</Link>
              <p className="text-[12.5px] text-muted ltr-nums">{l.reference} · {formatPrice(l.price)} MRU</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                <Badge variant={l.status === "published" ? "green" : "outline"}>{t(`dashboard.status.${l.status}` as never)}</Badge>
                {l.is_verified && <Badge variant="soft">{t("property.verified")}</Badge>}
                <span className="flex items-center gap-1"><Eye className="size-3.5" />{l.views_count}</span>
                <span className="flex items-center gap-1"><Heart className="size-3.5" />{l.favorites_count}</span>
              </div>
            </div>
            <ListingRowActions id={l.id} status={l.status} verified={l.is_verified} />
          </div>
        );
      })}
    </Card>
  );
}
