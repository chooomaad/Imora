import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Alert, I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { IntlProvider } from "use-intl";
import fr from "@imora/shared/i18n/fr.json";
import ar from "@imora/shared/i18n/ar.json";

/** Same message catalogs as the web app (packages/shared/src/i18n). */
export type Locale = "fr" | "ar";
const MESSAGES = { fr, ar } as const;
const KEY = "imora-locale";

const LocaleCtx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "fr", setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocales()[0]?.languageCode === "ar" ? "ar" : "fr");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => (v === "fr" || v === "ar") && setLocaleState(v));
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    void AsyncStorage.setItem(KEY, l);
    const rtl = l === "ar";
    if (I18nManager.isRTL !== rtl) {
      // React Native applies the layout direction at start-up
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
      Alert.alert(l === "ar" ? "إيمورا" : "Imora", l === "ar" ? "أعد تشغيل التطبيق لتطبيق الاتجاه من اليمين إلى اليسار." : "Redémarrez l'application pour appliquer la mise en page.");
    }
  };

  return (
    <LocaleCtx.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone="Africa/Nouakchott">
        {children}
      </IntlProvider>
    </LocaleCtx.Provider>
  );
}

export const useLocaleSwitch = () => useContext(LocaleCtx);
