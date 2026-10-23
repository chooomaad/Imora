"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Field, Input, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { errorCode } from "@/services/engagement";

type Agent = { id: string; title: string | null; is_active: boolean; is_agency_admin: boolean; profile: { full_name: string | null; avatar_url: string | null } | null };

export function AgentsManager({ agencyId, agents }: { agencyId: string; agents: Agent[] }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("Agent");
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowser();

  const add = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("add_agency_agent", { p_agency_id: agencyId, p_email: email.trim(), p_title: title });
    setLoading(false);
    if (error) return toast(`${t("common.error")} (${errorCode(error)})`, "error");
    setEmail("");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-5 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label={t("auth.email")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Button onClick={add} loading={loading} disabled={!email.includes("@")}><UserPlus className="size-4" /> {t("common.confirm")}</Button>
      </Card>
      <Card className="divide-y divide-line">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.profile?.full_name}</p>
              <p className="text-[12.5px] text-muted">{a.title}</p>
            </div>
            {a.is_agency_admin ? <Badge variant="soft">Admin</Badge> : (
              <Switch id={`ag-${a.id}`} label="" checked={a.is_active}
                onChange={async (v) => { await supabase.from("agents").update({ is_active: v }).eq("id", a.id); router.refresh(); }} />
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
