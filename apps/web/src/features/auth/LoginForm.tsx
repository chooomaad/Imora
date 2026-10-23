"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Field, Input, Segmented } from "@/components/ui/primitives";
import { LogoMark } from "@/components/Logo";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
const DEMO_ACCOUNTS = ["client", "owner1", "baraka", "agent", "promoteur", "admin"];

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const callbackUrl = (n: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(n)}&locale=${locale}`;

  const afterLogin = async () => {
    const supabase = getSupabaseBrowser();
    const { data: user } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role_selected").eq("id", user.user!.id).maybeSingle();
    router.replace(profile?.role_selected ? next : { pathname: "/onboarding", query: { next } });
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setMessage(null);
    const supabase = getSupabaseBrowser();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ tone: "err", text: t("invalidCredentials") });
      else await afterLogin();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, locale }, emailRedirectTo: callbackUrl("/onboarding") },
      });
      if (error) setMessage({ tone: "err", text: error.message });
      else if (data.session) await afterLogin();
      else setMessage({ tone: "ok", text: t("checkEmail") });
    }
    setLoading(false);
  };

  const magicLink = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(next) } });
    setMessage(error ? { tone: "err", text: error.message } : { tone: "ok", text: t("magicLinkSent") });
    setLoading(false);
  };

  const google = () =>
    getSupabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });

  return (
    <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <LogoMark size={52} />
        <h1 className="mt-4 font-display text-[28px] text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <Segmented className="mt-6" value={mode} onChange={setMode}
        options={[{ value: "signin", label: t("signIn") }, { value: "signup", label: t("signUp") }]} />

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "signup" && (
          <Field label={t("fullName")}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </Field>
        )}
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label={t("password")}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required />
        </Field>
        {message && <p className={message.tone === "ok" ? "text-sm font-medium text-green" : "text-sm font-medium text-danger"} role="status">{message.text}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!isSupabaseConfigured}>
          <KeyRound className="size-4" /> {mode === "signin" ? t("signIn") : t("signUp")}
        </Button>
      </form>

      <div className="mt-4 grid gap-2.5">
        <Button variant="outline" onClick={magicLink} disabled={!email || loading}>
          <Mail className="size-4" /> {t("magicLink")}
        </Button>
        <Button variant="secondary" onClick={google} disabled={!isSupabaseConfigured}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.8 2.4 2.6 6.6 2.6 11.9s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12Z"/></svg>
          {t("google")}
        </Button>
      </div>

      {DEMO && (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{t("demoAccounts")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => { setMode("signin"); setEmail(`${a}@demo.imora.mr`); setPassword("ImoraDemo2026!"); }}
                className="rounded-full bg-surface-2 px-3 py-1 text-[12px] font-semibold text-ink hover:bg-surface-3">{a}</button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-subtle">{t("demoPassword", { password: "ImoraDemo2026!" })}</p>
        </div>
      )}
    </Card>
  );
}
