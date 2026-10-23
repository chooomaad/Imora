import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { EmptyState } from "@/components/ui/primitives";
import { AdminConsole } from "@/features/admin/AdminConsole";
import { getSession } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("admin");
  const { userId, profile } = await getSession();
  if (!userId) redirect(`${locale === "ar" ? "/ar" : ""}/login?next=/admin`);
  if (profile?.role !== "admin") {
    return <div className="mx-auto max-w-lg px-4 py-10"><EmptyState title={t("forbidden")} /></div>;
  }
  const supabase = await getSupabaseServer();
  // admin_kpis() re-checks is_admin() server-side
  const { data: kpis } = await supabase.rpc("admin_kpis", { p_days: 30 });

  return (
    <div className="space-y-5 px-4 pt-6 sm:px-6">
      <h1 className="font-display text-[30px]">{t("title")}</h1>
      <AdminConsole kpis={(kpis ?? {}) as Record<string, number>} />
    </div>
  );
}
