"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Clock, Eye, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { whatsappLink } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/providers/SessionProvider";
import { errorCode, logContactEvent, revealContact, startConversation, type RevealedContact } from "@/services/engagement";
import type { PropertyDetail } from "@/types/models";

/**
 * Owner / agency contact. The phone number is never in the page payload: it is
 * fetched through reveal_contact() after explicit confirmation, which records a lead.
 */
export function ContactCard({ property }: { property: PropertyDetail }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { userId, requireAuth } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<RevealedContact | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const agency = property.agency;
  const isOwn = userId === property.owner_id;
  const name = agency?.name ?? property.owner?.full_name ?? t("contact.privateSeller");
  const waText = t("contact.whatsappText", { title: property.title, ref: property.reference });

  const reveal = async () => {
    setLoading(true);
    try {
      setContact(await revealContact(property.id));
      setConfirming(false);
    } catch (e) {
      const code = errorCode(e);
      toast(code === "reveal_limit_reached" ? t("contact.limitReached") : t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const conv = await startConversation(property.id, message || t("contact.messagePlaceholder"));
      toast(t("contact.messageSent"));
      router.push(`/messages/${conv.id}`);
    } catch {
      toast(t("common.error"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card id="contact" className="scroll-mt-24 p-5">
      <div className="flex items-center gap-3.5">
        {agency?.logo_url ? (
          <Avatar name={agency.name} src={agency.logo_url} size={56} />
        ) : (
          <Avatar name={name} src={property.owner?.avatar_url} size={56} />
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[18px] font-semibold text-ink">
            <span className="truncate">{name}</span>
            {(agency?.is_verified || property.owner?.is_verified) && <BadgeCheck className="size-5 shrink-0 text-gold" aria-label={t("property.agencyVerified")} />}
          </p>
          {agency ? (
            <>
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                <Star className="size-3.5 fill-gold-bright text-gold-bright" />
                <span className="ltr-nums">{Number(agency.rating_avg).toFixed(1)}</span>
                <span>({t("contact.reviews", { count: agency.rating_count })})</span>
                <span aria-hidden>·</span>
                <span>{t("contact.agencyApproved")}</span>
              </p>
              {agency.avg_response_minutes && (
                <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-gold">
                  <Clock className="size-3.5" /> {t("contact.respondsIn", { minutes: agency.avg_response_minutes })}
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">{t("contact.privateSeller")}</p>
          )}
        </div>
      </div>

      {isOwn ? (
        <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">{t("contact.own")}</p>
      ) : contact ? (
        <div className="mt-5 animate-fade-up space-y-3">
          <div className="rounded-2xl border border-gold/20 bg-gold-soft px-4 py-3 text-center">
            <p className="text-[12px] font-semibold text-muted">{contact.contact_name}</p>
            <a href={`tel:${contact.phone}`} className="ltr-nums text-[24px] font-bold tracking-wide text-ink">{contact.phone}</a>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <a href={`tel:${contact.phone}`} onClick={() => logContactEvent(property.id, "call_click")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 text-sm font-semibold text-ink hover:bg-surface-3">
              <Phone className="size-4" /> {t("contact.call")}
            </a>
            {contact.whatsapp && (
              <a href={whatsappLink(contact.whatsapp, waText)} target="_blank" rel="noopener noreferrer" onClick={() => logContactEvent(property.id, "whatsapp_click")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-on-ink hover:bg-ink-2">
                <MessageCircle className="size-4" /> {t("contact.whatsappDirect")}
              </a>
            )}
          </div>
        </div>
      ) : (
        <Button className="mt-5 h-12 w-full" onClick={() => requireAuth() && setConfirming(true)}>
          <Eye className="size-4" /> {agency ? t("contact.showPhoneAgency") : t("contact.showPhone")}
        </Button>
      )}

      {!isOwn && (
        <Button variant="secondary" className="mt-2.5 h-11 w-full" onClick={() => requireAuth() && setMessageOpen(true)}>
          <Mail className="size-4" /> {t("contact.sendMessage")}
        </Button>
      )}
      {agency && (
        <ButtonLink href={`/agencies/${agency.slug}`} variant="ghost" size="sm" className="mt-2 w-full">{agency.name} →</ButtonLink>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={reveal}
        loading={loading}
        title={t("contact.confirmTitle")}
        text={t("contact.confirmText")}
        confirmLabel={t("contact.confirmAction")}
      />

      <Dialog open={messageOpen} onClose={() => setMessageOpen(false)} title={t("contact.sendMessage")}>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("contact.messagePlaceholder")} maxLength={2000} rows={5} />
        <Button className="mt-4 w-full" onClick={send} loading={sending}>{t("messages.send")}</Button>
      </Dialog>
    </Card>
  );
}
