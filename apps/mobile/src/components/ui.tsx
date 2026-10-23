import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, radius, useColors } from "@/lib/theme";

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, style }: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "gold" | "goldLight" | "outline"; icon?: ReactNode;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.ink, secondary: c.surface2, gold: c.gold, goldLight: c.goldLight, outline: c.surface }[variant];
  const fg = { primary: c.onInk, secondary: c.ink, gold: "#fff", goldLight: c.ink, outline: c.ink }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: variant === "outline" ? 1 : 0, borderColor: c.line },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[s.btnText, { color: fg }]} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: ReactNode }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: active }}
      style={[s.chip, active ? { backgroundColor: c.ink } : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }]}>
      {icon}
      <Text style={[s.chipText, { color: active ? c.onInk : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, variant = "light", icon }: { label: string; variant?: "light" | "dark" | "gold" | "demo"; icon?: ReactNode }) {
  const c = useColors();
  const styles = {
    light: { bg: "rgba(255,255,255,0.95)", fg: "#111110" },
    dark: { bg: "rgba(17,17,16,0.88)", fg: "#fff" },
    gold: { bg: c.gold, fg: "#fff" },
    demo: { bg: "#fff4d6", fg: "#7a5a00" },
  }[variant];
  return (
    <View style={[s.badge, { backgroundColor: styles.bg }]}>
      {icon}
      <Text style={[s.badgeText, { color: styles.fg }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[s.eyebrow, { color: c.gold }]}>{children.toUpperCase()}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[s.h2, { color: c.ink }]}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: { height: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontFamily: fonts.bodySemibold, fontSize: 14.5 },
  chip: { height: 40, borderRadius: radius.pill, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13.5 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, shadowColor: "#3c2d0f", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1 },
  h2: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
});
