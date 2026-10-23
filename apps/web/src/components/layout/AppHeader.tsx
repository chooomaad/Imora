"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useSession } from "@/providers/SessionProvider";
import { cn } from "@/lib/cn";
import { DesktopNav } from "./Nav";

export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const t = useTranslations("header");

  const go = (next: "fr" | "ar") => {
    if (next === locale) return;
    const query = Object.fromEntries(search.entries());
    router.replace({ pathname, query }, { locale: next, scroll: false });
  };

  return (
    <div className={cn("inline-flex h-10 items-center rounded-full bg-surface-2 px-1 text-[13px] font-bold", className)} role="group" aria-label="Langue">
      <button type="button" onClick={() => go("fr")} aria-pressed={locale === "fr"} aria-label={t("switchToFrench")}
        className={cn("h-8 rounded-full px-2.5 transition", locale === "fr" ? "text-ink" : "text-subtle hover:text-ink")}>
        FR
      </button>
      <span className="h-3.5 w-px bg-line" aria-hidden />
      <button type="button" onClick={() => go("ar")} aria-pressed={locale === "ar"} aria-label={t("switchToArabic")}
        className={cn("h-8 rounded-full px-2.5 transition", locale === "ar" ? "text-ink" : "text-subtle hover:text-ink")}>
        AR
      </button>
    </div>
  );
}

function NotificationBell() {
  const { userId } = useSession();
  const t = useTranslations("header");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const supabase = getSupabaseBrowser();
    const load = () =>
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link href={userId ? "/notifications" : "/login"} className="relative grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2" aria-label={t("notifications")}>
      <Bell className="size-[22px]" strokeWidth={1.8} />
      {unread > 0 && (
        <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold leading-4 text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function AppHeader({ transparent }: { transparent?: boolean }) {
  const { profile, userId } = useSession();
  const t = useTranslations("header");

  return (
    <header className={cn("sticky top-0 z-40 border-b border-line/60 backdrop-blur-xl", transparent ? "bg-bg/70" : "bg-bg/90")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Imora — Accueil">
          <Logo />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <LocaleSwitch />
          <NotificationBell />
          <Link href={userId ? "/profile" : "/login"} aria-label={t("account")} className="rounded-full ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-gold-bright/60">
            <Avatar name={profile?.full_name} src={profile?.avatar_url} size={38} />
          </Link>
        </div>
      </div>
    </header>
  );
}
