"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/providers/SessionProvider";
import { cn } from "@/lib/cn";

/** Top bar for focused screens: back, logo + title, actions, avatar. */
export function BackHeader({ title, actions, dark, className }: { title: string; actions?: React.ReactNode; dark?: boolean; className?: string }) {
  const router = useRouter();
  const { profile, userId } = useSession();
  return (
    <header className={cn("sticky top-0 z-40 backdrop-blur-xl", dark ? "bg-[#0d0c0a]/80 text-white" : "border-b border-line/60 bg-bg/90 text-ink", className)}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
        <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2/20" aria-label="Retour">
          <ChevronLeft className="size-6 rtl:rotate-180" />
        </button>
        <Link href="/" className="shrink-0" aria-label="Imora"><LogoMark size={32} /></Link>
        <h1 className="min-w-0 flex-1 truncate ps-1 text-[19px] font-semibold">{title}</h1>
        {actions}
        <Link href={userId ? "/profile" : "/login"} className="shrink-0">
          <Avatar name={profile?.full_name} src={profile?.avatar_url} size={36} />
        </Link>
      </div>
    </header>
  );
}
