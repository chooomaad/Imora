import Image from "next/image";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { MessageSquare } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { getSession } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

type ConvRow = {
  id: string;
  client_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  property: { title: string; media: { url: string | null; is_cover: boolean }[] } | null;
  client: { full_name: string | null } | null;
  counterpart: { full_name: string | null } | null;
};

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("messages");
  const format = await getFormatter();
  const { userId } = await getSession();
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("conversations")
    .select(`id, client_id, last_message_at, last_message_preview,
      property:properties(title, media:property_media(url, is_cover)),
      client:profiles!conversations_client_id_fkey(full_name),
      counterpart:profiles!conversations_counterpart_id_fkey(full_name)`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const rows = (data ?? []) as unknown as ConvRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
      <SectionTitle>{t("title")}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-5" />} title={t("empty")} />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map((c) => {
            const other = c.client_id === userId ? c.counterpart?.full_name : c.client?.full_name;
            const cover = c.property?.media?.find((m) => m.is_cover)?.url ?? c.property?.media?.[0]?.url;
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {cover && <Image src={cover} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{other ?? "—"}</span>
                    {c.last_message_at && <span className="shrink-0 text-[11.5px] text-subtle">{format.relativeTime(new Date(c.last_message_at))}</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-gold">{c.property?.title}</span>
                  <span className="block truncate text-[13px] text-muted">{c.last_message_preview}</span>
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
