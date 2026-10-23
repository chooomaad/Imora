"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, HardHat, KeyRound, Search } from "lucide-react";
import type { SelfAssignableRole } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const ROLES: { role: SelfAssignableRole; icon: React.ReactNode }[] = [
  { role: "client", icon: <Search className="size-6" /> },
  { role: "proprietaire", icon: <KeyRound className="size-6" /> },
  { role: "agency_admin", icon: <Building2 className="size-6" /> },
  { role: "developer", icon: <HardHat className="size-6" /> },
];

/**
 * Role selection after sign-up. The role is applied by the choose_role() SQL function,
 * which only accepts self-assignable roles — the client cannot grant itself agent/admin.
 */
export function RoleOnboarding({ next }: { next: string }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [role, setRole] = useState<SelfAssignableRole>("client");
  const [org, setOrg] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const needsOrg = role === "agency_admin" || role === "developer";

  const submit = async () => {
    setLoading(true);
    const { error } = await getSupabaseBrowser().rpc("choose_role", {
      p_role: role,
      p_organization_name: needsOrg ? org : null,
      p_phone: phone || null,
    });
    setLoading(false);
    if (error) return toast(tc("error"), "error");
    router.replace(role === "client" ? next : "/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="font-display text-[32px] leading-tight text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {ROLES.map(({ role: r, icon }) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
            className={cn("flex items-start gap-4 rounded-card border p-5 text-start transition",
              role === r ? "border-gold bg-gold-soft shadow-soft" : "border-line bg-surface hover:bg-surface-2")}>
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", role === r ? "bg-gold text-white" : "bg-surface-2 text-gold")}>{icon}</span>
            <span>
              <span className="block text-[16px] font-semibold text-ink">{t(`roles.${r}.title`)}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{t(`roles.${r}.text`)}</span>
            </span>
          </button>
        ))}
      </div>
      {needsOrg && (
        <div className="grid animate-fade-up gap-4 sm:grid-cols-2">
          <Field label={t("organizationName")}><Input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={120} required /></Field>
          <Field label={t("phone")}><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+222 …" /></Field>
        </div>
      )}
      {role === "proprietaire" && (
        <Field label={t("phone")}><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+222 …" /></Field>
      )}
      <Button size="lg" className="w-full" onClick={submit} loading={loading} disabled={needsOrg && !org.trim()}>{t("continue")}</Button>
    </div>
  );
}
