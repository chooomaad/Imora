import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { RoleOnboarding } from "@/features/auth/RoleOnboarding";
import { getSession } from "@/services/auth.server";

export default async function OnboardingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const { next } = await searchParams;
  const session = await getSession();
  const prefix = locale === "ar" ? "/ar" : "";
  if (!session.userId) redirect(`${prefix}/login`);
  if (session.profile?.role_selected) redirect(`${prefix}/profile`);
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="px-4 py-8 sm:py-14">
      <RoleOnboarding next={safeNext} />
    </div>
  );
}
