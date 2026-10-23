import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // English can be added later: add "en" here and packages/shared/src/i18n/en.json
  locales: ["fr", "ar"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly AppLocale[] = ["ar"];
export const isRtl = (locale: string) => (RTL_LOCALES as readonly string[]).includes(locale);
