"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Bell, CalendarDays, Handshake, Home, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { NotificationRow } from "@/types/models";

function target(n: NotificationRow, slugs: Record<string, string>): string {
  const d = n.data ?? {};
  if (n.type === "new_message" && d.conversation_id) return `/messages/${d.conversation_id}`;
  if (n.type === "new_lead") return "/dashboard/leads";
  if (n.type === "visit_requested") return "/dashboard/visits";
  if (n.type.startsWith("visit_")) return "/visits";
  if (n.type.startsWith("transaction_")) return "/transactions";
  if (n.type.startsWith("listing_")) return "/dashboard/listings";
  if (d.property_id && slugs[d.property_id]) return `/property/${slugs[d.property_id]}`;
  return "/notifications";
}

const ICONS: Record<string, React.ReactNode> = {
  new_message: <MessageSquare className="size-5" />,
  new_lead: <Sparkles className="size-5" />,
  saved_search_match: <Home className="size-5" />,
};

export function NotificationList({ items, slugs }: { items: NotificationRow[]; slugs: Record<string, string> }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const [rows, setRows] = useState(items);

  const markAll = async () => {
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setRows((rs) => rs.map((r) => ({ ...r, read_at: r.read_at ?? now })));
    await getSupabaseBrowser().from("notifications").update({ read_at: now }).in("id", ids);
    router.refresh();
  };

  if (rows.length === 0) return <EmptyState icon={<Bell className="size-5" />} title={t("empty")} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={markAll}>{t("markAllRead")}</Button>
      </div>
      <Card className="divide-y divide-line overflow-hidden">
        {rows.map((n) => {
          const key = `types.${n.type}`;
          const icon =
            ICONS[n.type] ??
            (n.type.startsWith("visit") ? <CalendarDays className="size-5" /> : n.type.startsWith("transaction") ? <Handshake className="size-5" /> : <ShieldCheck className="size-5" />);
          return (
            <Link
              key={n.id}
              href={target(n, slugs)}
              onClick={() => {
                if (!n.read_at) void getSupabaseBrowser().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
              }}
              className={cn("flex items-start gap-3.5 px-5 py-4 hover:bg-surface-2", !n.read_at && "bg-gold-soft/60")}
            >
              <span className="mt-0.5 text-gold">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{t.has(key as never) ? t(key as never) : n.title}</span>
                {n.body && <span className="block truncate text-[13px] text-muted">{n.body}</span>}
                <span className="mt-0.5 block text-[12px] text-subtle">{format.relativeTime(new Date(n.created_at))}</span>
              </span>
              {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-gold" />}
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
