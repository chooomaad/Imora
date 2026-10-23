import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Fraunces, IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isRtl } from "@/i18n/routing";
import { ThemeProvider, themeInitScript } from "@/providers/ThemeProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { CollectionsProvider } from "@/providers/CollectionsProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { getSession } from "@/services/auth.server";
import { getMyFavoriteIds } from "@/services/user.server";
import "../globals.css";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal", "italic"], axes: ["opsz"] });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "fr", namespace: "home" });
  const title = locale === "ar" ? "إيمورا — المنصة العقارية المرجعية في موريتانيا" : "Imora — La plateforme immobilière de référence en Mauritanie";
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: title, template: "%s · Imora" },
    description: t("heroSubtitle"),
    applicationName: "Imora",
    alternates: { languages: { fr: "/", ar: "/ar" } },
    openGraph: { siteName: "Imora", type: "website", locale: locale === "ar" ? "ar_MR" : "fr_MR" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const session = await getSession();
  const favorites = session.userId ? await getMyFavoriteIds() : [];

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={`${body.variable} ${serif.variable} ${arabic.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <ThemeProvider>
            <ToastProvider>
              <SessionProvider userId={session.userId} profile={session.profile}>
                <CollectionsProvider initialFavorites={favorites}>
                  {children}
                  <Onboarding />
                </CollectionsProvider>
              </SessionProvider>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
