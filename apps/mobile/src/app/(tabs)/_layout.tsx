import { Tabs } from "expo-router";
import { useTranslations } from "use-intl";
import { Box, Compass, House, LayoutGrid, UserRound } from "lucide-react-native";
import { fonts, useColors } from "@/lib/theme";

/** Accueil / Explorer / 3D Visite / Carte / Profil */
export default function TabLayout() {
  const t = useTranslations("nav");
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 76, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 11.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("home"), tabBarIcon: ({ color, focused }) => <House size={22} color={focused ? c.goldBright : color} /> }} />
      <Tabs.Screen name="explore" options={{ title: t("explore"), tabBarIcon: ({ color, focused }) => <LayoutGrid size={22} color={focused ? c.goldBright : color} /> }} />
      <Tabs.Screen name="tours" options={{ title: t("tours"), tabBarIcon: ({ color, focused }) => <Box size={22} color={focused ? c.goldBright : color} /> }} />
      <Tabs.Screen name="map" options={{ title: t("map"), tabBarIcon: ({ color, focused }) => <Compass size={22} color={focused ? c.goldBright : color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"), tabBarIcon: ({ color, focused }) => <UserRound size={22} color={focused ? c.goldBright : color} /> }} />
    </Tabs>
  );
}
