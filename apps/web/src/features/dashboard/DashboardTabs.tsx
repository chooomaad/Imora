"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function DashboardTabs({ isAgencyAdmin }: { isAgencyAdmin: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard", label: t("dashboard.overview") },
    { href: "/dashboard/listings", label: t("dashboard.listings") },
    { href: "/dashboard/leads", label: t("dashboard.leads") },
    { href: "/dashboard/visits", label: t("dashboard.visits") },
    ...(isAgencyAdmin ? [{ href: "/dashboard/agents", label: t("agency.agents") }] : []),
  ];
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href}
            className={cn("shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition", active ? "bg-ink text-on-ink" : "bg-surface text-ink border border-line hover:bg-surface-2")}>
            {tab.label}
          </Link>
        );
      })}
      <Link href="/dashboard/listings/new" className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-[13.5px] font-semibold text-white">
        <Plus className="size-4" /> {t("dashboard.newListing")}
      </Link>
    </div>
  );
}
