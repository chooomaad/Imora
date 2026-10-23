import type fr from "@imora/shared/i18n/fr.json";
import type { routing } from "./routing";

// Type-safe message keys and locales across the app
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof fr;
  }
}
