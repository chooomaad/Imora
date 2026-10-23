import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Bell, UserRound } from "lucide-react-native";
import { useLocaleSwitch } from "@/lib/i18n";
import { fonts, useColors } from "@/lib/theme";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width={48} height={48} rx={12} fill="#111110" />
      <Path d="M12 22.5 24 12l12 10.5V35a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 12 35V22.5Z" fill="none" stroke="#D9B45E" strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M19.5 36.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" fill="none" stroke="#D9B45E" strokeWidth={2.2} />
      <Circle cx={24} cy={21} r={2.6} fill="none" stroke="#D9B45E" strokeWidth={2} />
    </Svg>
  );
}

/** Logo · FR|AR · notifications · avatar — as in the design references. */
export function Header() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocaleSwitch();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8, backgroundColor: c.bg, borderBottomColor: c.line }]}>
      <View style={s.logo}>
        <LogoMark />
        <Text style={[s.brand, { color: c.ink }]}>Imora</Text>
        <Text style={[s.brandAr, { color: c.gold }]}>إيمورا</Text>
      </View>
      <View style={s.right}>
        <View style={[s.lang, { backgroundColor: c.surface2 }]}>
          {(["fr", "ar"] as const).map((l) => (
            <Pressable key={l} onPress={() => setLocale(l)} hitSlop={6}>
              <Text style={[s.langText, { color: locale === l ? c.ink : c.subtle }]}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => router.push("/(tabs)/profile")} hitSlop={6}><Bell size={22} color={c.ink} /></Pressable>
        <Pressable onPress={() => router.push("/(tabs)/profile")} style={[s.avatar, { backgroundColor: c.goldSoft }]}>
          <UserRound size={18} color={c.gold} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontFamily: fonts.bodySemibold, fontSize: 21 },
  brandAr: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  right: { flexDirection: "row", alignItems: "center", gap: 14 },
  lang: { flexDirection: "row", gap: 10, borderRadius: 999, paddingHorizontal: 12, height: 36, alignItems: "center" },
  langText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
