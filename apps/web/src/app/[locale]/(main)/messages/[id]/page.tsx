import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Conversation } from "@/features/messaging/Conversation";
import { getSession } from "@/services/auth.server";
import { getSupabaseServer } from "@/lib/supabase/server";

type Row = {
  id: string;
  client_id: string;
  property: { slug: string; title: string; price: number; price_period: "total" | "month" | "year"; media: { url: string | null; is_cover: boolean }[] } | null;
  client: { full_name: string | null } | null;
  counterpart: { full_name: string | null } | null;
};

export default async function ConversationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale as AppLocale);
  const { userId } = await getSession();
  if (!userId) redirect(`${locale === "ar" ? "/ar" : ""}/login`);
  const supabase = await getSupabaseServer();
  // RLS: only participants can read the conversation
  const { data } = await supabase
    .from("conversations")
    .select(`id, client_id,
      property:properties(slug, title, price, price_period, media:property_media(url, is_cover)),
      client:profiles!conversations_client_id_fkey(full_name),
      counterpart:profiles!conversations_counterpart_id_fkey(full_name)`)
    .eq("id", id)
    .maybeSingle();
  const conv = data as unknown as Row | null;
  if (!conv?.property) notFound();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, attachment_path, read_at, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <div className="-mb-28 lg:-mb-16">
      <Conversation
        userId={userId}
        initial={messages ?? []}
        conversation={{
          id: conv.id,
          counterpartName: (conv.client_id === userId ? conv.counterpart?.full_name : conv.client?.full_name) ?? "",
          property: {
            slug: conv.property.slug,
            title: conv.property.title,
            price: conv.property.price,
            price_period: conv.property.price_period,
            cover_url: conv.property.media.find((m) => m.is_cover)?.url ?? conv.property.media[0]?.url ?? null,
          },
        }}
      />
    </div>
  );
}
