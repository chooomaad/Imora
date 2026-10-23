"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { PropertyFilters } from "@imora/shared";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import { describeFilters } from "./describeFilters";

/** Saves the current filters; the DB notifies the user when a matching listing is published. */
export function SaveSearchButton({ filters }: { filters: PropertyFilters }) {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { userId, requireAuth } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const start = () => {
    if (!requireAuth()) return;
    setName(describeFilters(filters, t as never, locale).map((c) => c.label).slice(0, 3).join(" · ") || t("search.saveSearch"));
    setOpen(true);
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const criteria: PropertyFilters = { ...filters };
    delete criteria.sort;
    const { error } = await getSupabaseBrowser().from("saved_searches").insert({ user_id: userId, name: name.trim().slice(0, 80), filters: criteria });
    setSaving(false);
    if (error) return toast(t("common.error"), "error");
    setOpen(false);
    toast(t("search.searchSaved"));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={start}>
        <BookmarkPlus className="size-4" /> {t("search.saveSearch")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("search.saveSearch")}>
        <Field label={t("search.searchName")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Button className="mt-5 w-full" onClick={save} loading={saving} disabled={!name.trim()}>{t("common.save")}</Button>
      </Dialog>
    </>
  );
}
