"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { updateVisitStatus } from "@/services/engagement";

/** Visit status + actions. `side` decides which transitions are offered (enforced again in SQL). */
export function VisitActions({ id, status, side }: { id: string; status: string; side: "visitor" | "owner" }) {
  const t = useTranslations("visit");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (next: string) => {
    setBusy(next);
    try {
      await updateVisitStatus(id, next);
      router.refresh();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  };

  const open = status === "requested" || status === "confirmed";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={status === "confirmed" ? "green" : status === "requested" ? "soft" : "outline"}>{t(`status.${status}` as never)}</Badge>
      {side === "owner" && status === "requested" && (
        <Button size="sm" onClick={() => act("confirmed")} loading={busy === "confirmed"}>{t("accept")}</Button>
      )}
      {side === "owner" && status === "confirmed" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => act("completed")} loading={busy === "completed"}>{t("markDone")}</Button>
          <Button size="sm" variant="ghost" onClick={() => act("no_show")} loading={busy === "no_show"}>{t("markNoShow")}</Button>
        </>
      )}
      {open && (
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => act("cancelled")} loading={busy === "cancelled"}>
          {side === "owner" ? t("decline") : t("cancel")}
        </Button>
      )}
    </div>
  );
}
