"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Handshake, Scale, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useCollections } from "@/providers/CollectionsProvider";
import { useSession } from "@/providers/SessionProvider";
import { declareTransaction, errorCode, recordView, reportListing } from "@/services/engagement";

export function ViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    recordView(propertyId, document.referrer ? "referral" : "direct");
  }, [propertyId]);
  return null;
}

export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("common");
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={t("share")}
      className={cn("grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2", className)}
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
        } else {
          await navigator.clipboard.writeText(url);
          toast(t("linkCopied"));
        }
      }}
    >
      <Share2 className="size-5" />
    </button>
  );
}

export function CompareToggle({ propertyId }: { propertyId: string }) {
  const t = useTranslations("property");
  const { compare, toggleCompare } = useCollections();
  const active = compare.includes(propertyId);
  return (
    <Button variant={active ? "goldLight" : "outline"} size="sm" onClick={() => toggleCompare(propertyId)} aria-pressed={active}>
      <Scale className="size-4" /> {active ? t("inCompare") : t("addToCompare")}
    </Button>
  );
}

const REASONS = ["fraud", "wrong_price", "already_sold", "fake_photos", "wrong_location", "duplicate", "offensive", "other"] as const;

export function ReportButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const toast = useToast();
  const { userId, requireAuth } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("fraud");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await reportListing(userId, propertyId, reason, details);
      setOpen(false);
      toast(t("sent"));
    } catch {
      toast(tc("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => requireAuth() && setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-danger">
        <Flag className="size-4" /> {t("title")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("title")}>
        <div className="space-y-4">
          <Field label={t("reason")}>
            <Select value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
              {REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("details")}>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
          </Field>
          <Button className="w-full" variant="danger" onClick={send} loading={loading}>{t("send")}</Button>
        </div>
      </Dialog>
    </>
  );
}

/** Buyer/tenant side of the transaction workflow (the owner confirms from their space). */
export function DeclareTransactionButton({ propertyId, listingType, defaultAmount }: { propertyId: string; listingType: "sale" | "rent" | "investment"; defaultAmount: number }) {
  const t = useTranslations("transaction");
  const tc = useTranslations("common");
  const toast = useToast();
  const { requireAuth } = useSession();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [loading, setLoading] = useState(false);
  const type = listingType === "rent" ? "rent" : "sale";

  const submit = async () => {
    setLoading(true);
    try {
      await declareTransaction(propertyId, type, Number(amount.replace(/\D/g, "")));
      setOpen(false);
      toast(t("declared"));
    } catch (e) {
      toast(errorCode(e) === "not_authenticated" ? tc("loginRequired") : tc("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => requireAuth() && setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <Handshake className="size-4" /> {t("declare")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("declare")}>
        <p className="text-sm text-muted">{t("declareText")}</p>
        <Field label={type === "rent" ? t("monthlyRent") : t("amount")} className="mt-4">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Button className="mt-5 w-full" onClick={submit} loading={loading} disabled={!Number(amount.replace(/\D/g, ""))}>{t("declare")}</Button>
      </Dialog>
    </>
  );
}
