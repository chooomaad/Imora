import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Explicit loaders so the bundler only includes the locales we ship.
const loaders = {
  fr: () => import("@imora/shared/i18n/fr.json"),
  ar: () => import("@imora/shared/i18n/ar.json"),
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: "Africa/Nouakchott",
    messages: (await loaders[locale]()).default,
  };
});
