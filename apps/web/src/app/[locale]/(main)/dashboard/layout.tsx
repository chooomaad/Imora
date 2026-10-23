import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/primitives";
import { DashboardTabs } from "@/features/dashboard/DashboardTabs";
import { getSession, isPro } from "@/services/auth.server";
import { getMyAgency } from "@/services/dashboard.server";

/** Pro space. Access is also enforced by RLS on every query. */
export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { userId, profile } = await getSession();
  if (!userId) redirect(`${locale === "ar" ? "/ar" : ""}/login?next=/dashboard`);
  const t = await getTranslations("dashboard");
  if (!isPro(profile)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState title={t("proOnly")} />
      </div>
    );
  }
  const agency = await getMyAgency();
  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight">{t("title")}</h1>
          {agency && <p className="text-sm text-muted">{agency.name}</p>}
        </div>
      </div>
      <DashboardTabs isAgencyAdmin={Boolean(agency?.isAdmin)} />
      {children}
    </div>
  );
}
