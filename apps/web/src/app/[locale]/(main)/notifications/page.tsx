import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { SectionTitle } from "@/components/ui/primitives";
import { NotificationList } from "@/features/messaging/NotificationList";
import { getMyNotifications } from "@/services/user.server";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("notifications");
  const items = await getMyNotifications();
  const ids = [...new Set(items.map((n) => n.data?.property_id).filter(Boolean))] as string[];
  const slugs: Record<string, string> = {};
  if (ids.length) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from("properties").select("id, slug").in("id", ids);
    for (const p of data ?? []) slugs[p.id] = p.slug;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
      <SectionTitle>{t("title")}</SectionTitle>
      <NotificationList items={items} slugs={slugs} />
    </div>
  );
}
