import { useEffect } from "react";
import { Stack, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useFonts, Fraunces_400Regular_Italic, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { useColors } from "@/lib/theme";

export default function RootLayout() {
  const [loaded] = useFonts({ Fraunces_400Regular_Italic, Fraunces_600SemiBold, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  const c = useColors();

  // First launch: show the animated onboarding
  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.getItem("imora-intro-done").then((done) => {
      if (!done) router.replace("/intro");
    });
  }, [loaded]);

  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="intro" options={{ animation: "fade", gestureEnabled: false }} />
            <Stack.Screen name="property/[slug]" />
            <Stack.Screen name="tour/[slug]" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
