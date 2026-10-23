import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { LoginForm } from "@/features/auth/LoginForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  return (
    <div className="px-4 py-8 sm:py-14">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
