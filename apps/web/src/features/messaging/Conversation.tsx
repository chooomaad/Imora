"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CheckCheck, Paperclip, SendHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { priceParts } from "@/features/properties/format";

interface Message {
  id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ConversationHeader {
  id: string;
  property: { slug: string; title: string; price: number; price_period: "total" | "month" | "year"; cover_url: string | null };
  counterpartName: string;
}

/** Real-time conversation (Supabase Realtime on `messages`), with read receipts. */
export function Conversation({ conversation, userId, initial }: { conversation: ConversationHeader; userId: string; initial: Message[] }) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseBrowser();
  const price = priceParts(conversation.property.price, conversation.property.price_period, locale);

  useEffect(() => {
    void supabase.rpc("mark_conversation_read", { p_conversation_id: conversation.id });
    const channel = supabase
      .channel(`conv-${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== userId) void supabase.rpc("mark_conversation_read", { p_conversation_id: conversation.id });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, supabase, userId]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  const send = async (body: string | null, attachment: string | null = null) => {
    if (!body?.trim() && !attachment) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: userId, body: body?.trim() || null, attachment_path: attachment })
      .select()
      .single();
    setSending(false);
    if (error) return toast(t("send"), "error");
    setText("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  };

  const attach = async (f: File | undefined) => {
    if (!f) return;
    // Private bucket, folder = conversation id (participants only, see storage policies)
    const path = `${conversation.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("message-attachments").upload(path, f, { upsert: false });
    if (error) return toast(t("send"), "error");
    await send(null, path);
  };

  const openAttachment = async (path: string) => {
    const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="flex h-[calc(100dvh-4rem-68px)] flex-col lg:h-[calc(100dvh-4rem)]">
      <Link href={`/property/${conversation.property.slug}`} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {conversation.property.cover_url && <Image src={conversation.property.cover_url} alt="" fill sizes="56px" className="object-cover" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{conversation.property.title}</span>
          <span className="block text-[13px] font-semibold text-gold ltr-nums">{price.amount} {price.currency} {price.period}</span>
          <span className="block truncate text-[12px] text-muted">{conversation.counterpartName}</span>
        </span>
      </Link>

      <div className="flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-[14.5px] shadow-soft", mine ? "rounded-ee-md bg-ink text-on-ink" : "rounded-es-md bg-surface text-ink")}>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.attachment_path && (
                  <button type="button" onClick={() => void openAttachment(m.attachment_path!)} className="mt-1 inline-flex items-center gap-1.5 underline">
                    <Paperclip className="size-3.5" /> {m.attachment_path.split("/").pop()?.replace(/^\d+-/, "")}
                  </button>
                )}
                <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10.5px]", mine ? "text-on-ink/60" : "text-subtle")}>
                  {format.dateTime(new Date(m.created_at), { hour: "2-digit", minute: "2-digit" })}
                  {mine && m.read_at && <CheckCheck className="size-3.5 text-gold-bright" aria-label={t("read")} />}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-end gap-2 border-t border-line bg-surface p-3">
        <input ref={file} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => void attach(e.target.files?.[0])} />
        <button type="button" onClick={() => file.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Pièce jointe">
          <Paperclip className="size-5" />
        </button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder={t("placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2.5 text-[15px] outline-none" />
        <button type="submit" disabled={sending || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-on-ink disabled:opacity-40" aria-label={t("send")}>
          <SendHorizontal className="size-5 rtl:rotate-180" />
        </button>
      </form>
    </div>
  );
}
