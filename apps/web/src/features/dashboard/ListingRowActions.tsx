"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, BadgeCheck, Pencil } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon3D } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";

export function ListingRowActions({ id, status, verified }: { id: string; status: string; verified: boolean }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { userId } = useSession();
  const [busy, setBusy] = useState(false);

  const requestVerification = async () => {
    setBusy(true);
    const { error } = await getSupabaseBrowser().from("verifications").insert({ subject_type: "property", subject_id: id, requested_by: userId });
    setBusy(false);
    toast(error ? t("common.error") : t("tourBuilder.requestVerification") + " ✓", error ? "error" : "success");
  };

  const archive = async () => {
    setBusy(true);
    await getSupabaseBrowser().from("properties").update({ status: "archived" }).eq("id", id);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ButtonLink href={`/dashboard/listings/${id}`} variant="outline" size="sm"><Pencil className="size-3.5" />{t("common.edit")}</ButtonLink>
      <ButtonLink href={`/dashboard/listings/${id}/tour`} variant="outline" size="sm"><Icon3D size={15} />{t("dashboard.createTour")}</ButtonLink>
      {!verified && status === "published" && (
        <Button variant="ghost" size="sm" onClick={requestVerification} loading={busy}><BadgeCheck className="size-4" /></Button>
      )}
      {status !== "archived" && (
        <Button variant="ghost" size="sm" onClick={archive} loading={busy} aria-label="Archiver"><Archive className="size-4" /></Button>
      )}
    </div>
  );
}
