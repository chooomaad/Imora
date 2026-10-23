"use client";

import { useState } from "react";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function SavedSearchActions({ id, notify }: { id: string; notify: boolean }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [on, setOn] = useState(notify);
  const supabase = getSupabaseBrowser();
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-pressed={on} aria-label="Notifications" className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
        onClick={async () => { setOn(!on); await supabase.from("saved_searches").update({ notify: !on }).eq("id", id); }}>
        {on ? <Bell className="size-4 text-gold" /> : <BellOff className="size-4 text-subtle" />}
      </button>
      <button type="button" aria-label={t("delete")} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
        onClick={async () => { await supabase.from("saved_searches").delete().eq("id", id); router.refresh(); }}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
