"use client";

import { Scale, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { useCollections } from "@/providers/CollectionsProvider";
import { usePathname } from "@/i18n/navigation";

/** Floating basket shown once at least one listing is selected for comparison. */
export function CompareBar() {
  const { compare, clearCompare } = useCollections();
  const pathname = usePathname();
  const t = useTranslations("compare");
  if (compare.length === 0 || pathname.startsWith("/compare")) return null;
  return (
    <div className="fixed inset-x-0 bottom-[84px] z-30 flex justify-center px-4 lg:bottom-6">
      <div className="flex animate-fade-up items-center gap-3 rounded-full bg-ink py-2 ps-4 pe-2 text-on-ink shadow-lift">
        <Scale className="size-4 text-gold-bright" />
        <span className="text-[13px] font-semibold">{t("bar", { count: compare.length })}</span>
        <ButtonLink href={`/compare?ids=${compare.join(",")}`} variant="goldLight" size="sm">{t("open")}</ButtonLink>
        <button type="button" onClick={clearCompare} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label={t("remove")}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
