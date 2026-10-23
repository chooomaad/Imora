"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Handshake } from "lucide-react";
import { LEAD_STATUSES, type LeadStatus } from "@imora/shared";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { declareTransaction, errorCode } from "@/services/engagement";
import type { LeadRow } from "@/services/dashboard.server";

export function LeadItem({ lead }: { lead: LeadRow }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const [status, setStatus] = useState(lead.status as LeadStatus);
  const [txOpen, setTxOpen] = useState(false);
  const [amount, setAmount] = useState(String(lead.property?.price ?? ""));
  const [loading, setLoading] = useState(false);

  const changeStatus = async (s: LeadStatus) => {
    const prev = status;
    setStatus(s);
    const { error } = await getSupabaseBrowser().rpc("update_lead_status", { p_lead_id: lead.id, p_status: s, p_notes: null });
    if (error) {
      setStatus(prev);
      toast(t("common.error"), "error");
    }
  };

  const declare = async () => {
    if (!lead.property) return;
    setLoading(true);
    try {
      await declareTransaction(lead.property.id, lead.property.listing_type === "rent" ? "rent" : "sale", Number(amount.replace(/\D/g, "")), lead.buyer_id);
      setTxOpen(false);
      toast(t("transaction.declared"));
    } catch (e) {
      toast(`${t("common.error")} (${errorCode(e)})`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <Avatar name={lead.buyer?.full_name} src={lead.buyer?.avatar_url} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{lead.buyer?.full_name ?? "—"}</p>
        <p className="truncate text-[12.5px] text-muted">
          <Link href={`/property/${lead.property?.slug}`} className="hover:underline">{lead.property?.title}</Link>
          {" · "}{t(`dashboard.leadSource.${lead.source}` as never)} · {lead.interactions_count}× · {format.relativeTime(new Date(lead.last_activity_at))}
        </p>
      </div>
      <div className="w-44">
        <Select value={status} onChange={(e) => void changeStatus(e.target.value as LeadStatus)} className="h-10 text-[13px]" aria-label="Statut">
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{t(`dashboard.leadStatus.${s}`)}</option>)}
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={() => setTxOpen(true)} title={t("dashboard.declareTransaction")}>
        <Handshake className="size-4" />
      </Button>
      <Dialog open={txOpen} onClose={() => setTxOpen(false)} title={t("dashboard.declareTransaction")}>
        <p className="text-sm text-muted">{t("transaction.declareText")}</p>
        <p className="mt-3 text-sm"><strong>{t("transaction.buyer")} :</strong> {lead.buyer?.full_name}</p>
        <Field label={lead.property?.listing_type === "rent" ? t("transaction.monthlyRent") : t("transaction.amount")} className="mt-3">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Button className="mt-5 w-full" onClick={declare} loading={loading}>{t("transaction.declare")}</Button>
      </Dialog>
    </div>
  );
}
