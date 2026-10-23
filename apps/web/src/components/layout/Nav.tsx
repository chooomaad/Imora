"use client";

import { Compass, House, LayoutGrid, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon3D } from "@/components/icons";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", key: "home", Icon: House },
  { href: "/explore", key: "explore", Icon: LayoutGrid },
  { href: "/tours", key: "tours", Icon: Icon3D },
  { href: "/map", key: "map", Icon: Compass },
  { href: "/profile", key: "profile", Icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile tab bar — Accueil / Explorer / 3D Visite / Carte / Profil. */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 pb-safe backdrop-blur-xl lg:hidden" aria-label="Navigation principale">
      <ul className="mx-auto grid h-[68px] max-w-lg grid-cols-5">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11.5px] font-semibold transition", active ? "text-ink" : "text-muted hover:text-ink")}>
                <Icon size={22} className={cn("size-[22px]", active && "text-gold-bright")} strokeWidth={active ? 2.1 : 1.8} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop navigation rendered inside the header from `lg` up. */
export function DesktopNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = [...ITEMS.slice(0, 4), { href: "/invest", key: "invest" as const }, { href: "/projects", key: "projects" as const }];
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
      {items.map(({ href, key }) => (
        <Link key={href} href={href}
          className={cn("rounded-full px-3.5 py-2 text-sm font-semibold transition", isActive(pathname, href) ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}>
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
