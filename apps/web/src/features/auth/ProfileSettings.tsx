"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Waves } from "lucide-react";
import { resetIntro } from "@/features/onboarding/Onboarding";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Field, Input, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { LocaleSwitch } from "@/components/layout/AppHeader";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";

export function ProfileSettings({ userId, fullName, phone }: { userId: string; fullName: string; phone: string }) {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ full_name: name.trim() }).eq("id", userId),
      supabase.from("profile_contacts").update({ phone: tel.trim() || null, whatsapp: tel.trim() || null }).eq("profile_id", userId),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast(t("common.error"), "error");
    toast(t("profile.updated"));
    router.refresh();
  };

  const signOut = async () => {
    await getSupabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <h2 className="text-[17px] font-semibold">{t("profile.personalInfo")}</h2>
        <Field label={t("auth.fullName")}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label={t("auth.phone")}><Input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+222 …" /></Field>
        <Button onClick={save} loading={saving}>{t("common.save")}</Button>
      </Card>
      <Card className="divide-y divide-line p-5">
        <div className="flex items-center justify-between pb-3">
          <span className="text-[15px]">{t("profile.language")}</span>
          <LocaleSwitch />
        </div>
        <div className="pt-2">
          <Switch id="dark" label={t("profile.darkMode")} checked={resolved === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </Card>
      <Button variant="secondary" className="w-full" onClick={() => { resetIntro(); window.location.reload(); }}>
        <Waves className="size-4" /> {t("profile.replayIntro")}
      </Button>
      <Button variant="outline" className="w-full text-danger" onClick={signOut}>
        <LogOut className="size-4" /> {t("auth.signOut")}
      </Button>
    </div>
  );
}
