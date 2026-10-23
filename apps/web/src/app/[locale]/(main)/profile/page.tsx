import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, Bell, CalendarDays, ChevronRight, Handshake, Heart, LayoutDashboard, MessageSquare, Search, ShieldCheck } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ProfileSettings } from "@/features/auth/ProfileSettings";
import { getSession, isPro } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const { userId, email, profile } = await getSession();

  if (!userId || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <EmptyState title={t("profile.notLogged")} action={<ButtonLink href="/login">{t("common.login")}</ButtonLink>} />
      </div>
    );
  }
  const supabase = await getSupabaseServer();
  const { data: contact } = await supabase.from("profile_contacts").select("phone").eq("profile_id", userId).maybeSingle();

  const links = [
    { href: "/favorites", icon: <Heart className="size-5" />, label: t("profile.myFavorites") },
    { href: "/favorites#searches", icon: <Search className="size-5" />, label: t("profile.mySearches") },
    { href: "/visits", icon: <CalendarDays className="size-5" />, label: t("profile.myVisits") },
    { href: "/messages", icon: <MessageSquare className="size-5" />, label: t("profile.myMessages") },
    { href: "/notifications", icon: <Bell className="size-5" />, label: t("nav.notifications") },
    { href: "/transactions", icon: <Handshake className="size-5" />, label: t("profile.myTransactions") },
    ...(isPro(profile) ? [{ href: "/dashboard", icon: <LayoutDashboard className="size-5" />, label: t("profile.mySpace") }] : []),
    ...(profile.role === "admin" ? [{ href: "/admin", icon: <ShieldCheck className="size-5" />, label: t("nav.admin") }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6">
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={64} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[20px] font-semibold">
            <span className="truncate">{profile.full_name ?? email}</span>
            {profile.is_verified && <BadgeCheck className="size-5 text-gold" />}
          </p>
          <p className="truncate text-sm text-muted">{email}</p>
          <div className="mt-1.5 flex gap-1.5">
            <Badge variant="soft">{t(`profile.role.${profile.role}`)}</Badge>
            {profile.is_demo && <Badge variant="demo">{t("common.demo")}</Badge>}
          </div>
        </div>
      </Card>
      <Card className="divide-y divide-line overflow-hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3.5 px-5 py-4 hover:bg-surface-2">
            <span className="text-gold">{l.icon}</span>
            <span className="flex-1 text-[15px] font-medium">{l.label}</span>
            <ChevronRight className="size-4 text-subtle rtl:rotate-180" />
          </Link>
        ))}
      </Card>
      <ProfileSettings userId={userId} fullName={profile.full_name ?? ""} phone={contact?.phone ?? ""} />
    </div>
  );
}
