"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { confirmTransaction } from "@/services/engagement";

/** "Cette transaction a-t-elle été finalisée ?" — the second party's answer completes or disputes it. */
export function TransactionConfirm({ id }: { id: string }) {
  const t = useTranslations("transaction");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<"yes" | "no" | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  const answer = async (confirm: boolean) => {
    setLoading(confirm ? "yes" : "no");
    try {
      await confirmTransaction(id, confirm, confirm ? undefined : reason);
      setDisputeOpen(false);
      router.refresh();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-ink">{t("question")}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => answer(true)} loading={loading === "yes"}>{t("confirmYes")}</Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDisputeOpen(true)}>{t("confirmNo")}</Button>
      </div>
      <Dialog open={disputeOpen} onClose={() => setDisputeOpen(false)} title={t("confirmNo")}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("disputeReason")} maxLength={1000} />
        <Button variant="danger" className="mt-4 w-full" onClick={() => answer(false)} loading={loading === "no"} disabled={!reason.trim()}>{t("confirmNo")}</Button>
      </Dialog>
    </div>
  );
}
