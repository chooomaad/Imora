import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslations } from "use-intl";
import { ArrowRight, Building2, KeyRound, LineChart, Search, Sparkles } from "lucide-react-native";
import { LogoMark } from "@/components/Header";
import { Waves } from "@/components/Waves";
import { useLocaleSwitch } from "@/lib/i18n";
import { fonts } from "@/lib/theme";

export const INTRO_DONE_KEY = "imora-intro-done";
const STEPS = 4;
const { width: W } = Dimensions.get("window");

/** Animated first-launch onboarding: interactive waves, 4 steps, swipe navigation. */
export default function Intro() {
  const t = useTranslations("intro");
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocaleSwitch();
  const [step, setStep] = useState(0);
  const [touch, setTouch] = useState({ x: -9999, energy: 0 });
  const [typed, setTyped] = useState(0);
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;

  // Slow 360° pan of a room inside the circle
  useEffect(() => {
    Animated.loop(Animated.timing(panX, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [panX]);

  // Content entrance on every step
  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 650, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [step, appear]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, [pulse]);

  // Self-typing AI query on step 3
  const query = t("aiQuery");
  useEffect(() => {
    if (step !== 2) return;
    setTyped(0);
    const id = setInterval(() => setTyped((n) => Math.min(query.length, n + 1)), 28);
    return () => clearInterval(id);
  }, [step, query]);

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS - 1, n)));
  const finish = async (href: string = "/(tabs)") => {
    await AsyncStorage.setItem(INTRO_DONE_KEY, "1");
    router.replace(href as never);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12,
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setTouch({ x: e.nativeEvent.pageX, energy: 0.8 }),
      onPanResponderMove: (e, g) => setTouch({ x: e.nativeEvent.pageX, energy: Math.min(1.4, Math.abs(g.vx) * 1.5 + 0.4) }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60) setStep((s) => Math.max(0, Math.min(STEPS - 1, s + (g.dx < 0 ? 1 : -1))));
      },
    }),
  ).current;

  const dark = step === 2;
  const fg = dark ? "#ffffff" : "#111110";
  const muted = dark ? "rgba(255,255,255,0.7)" : "#706858";
  const rise = { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] };

  const intents = [
    { key: "buy", icon: Search, href: "/(tabs)/explore" },
    { key: "rent", icon: KeyRound, href: "/(tabs)/explore" },
    { key: "invest", icon: LineChart, href: "/(tabs)/explore" },
    { key: "publish", icon: Building2, href: "/(tabs)/profile" },
  ] as const;

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Waves step={step} total={STEPS} touch={touch} />
      <View style={[s.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.top}>
          <View style={s.brand}><LogoMark size={32} /><Text style={[s.brandText, { color: fg }]}>Imora</Text></View>
          {step < STEPS - 1 && (
            <Pressable onPress={() => void finish()} style={[s.skip, { backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)" }]}>
              <Text style={{ color: fg, fontFamily: fonts.bodySemibold }}>{t("skip")}</Text>
            </Pressable>
          )}
        </View>

        <Animated.View style={[s.content, rise]}>
          {step === 0 && (
            <>
              <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
                <LogoMark size={92} />
              </Animated.View>
              <Text style={[s.title, { color: fg }]}>{t("welcomeTitle")} <Text style={{ fontFamily: fonts.displayItalic, color: "#7d5f14" }}>Imora</Text></Text>
              <Text style={[s.text, { color: muted }]}>{t("welcomeText")}</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {(["fr", "ar"] as const).map((l) => (
                  <Pressable key={l} onPress={() => setLocale(l)} style={[s.lang, locale === l ? { backgroundColor: "#111110" } : { backgroundColor: "rgba(255,255,255,0.75)" }]}>
                    <Text style={{ color: locale === l ? "#fff" : "#111", fontFamily: fonts.bodySemibold, fontSize: 15 }}>{l === "fr" ? "Français" : "العربية"}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {step === 1 && (
            <>
              <View style={s.pano}>
                <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: W * 1.8 * 2, flexDirection: "row",
                  transform: [{ translateX: panX.interpolate({ inputRange: [0, 1], outputRange: [0, -W * 1.8] }) }] }}>
                  {[0, 1].map((k) => (
                    <Image key={k} source="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1400&q=70&auto=format&fit=crop" style={{ width: W * 1.8, height: "100%" }} contentFit="cover" />
                  ))}
                </Animated.View>
                <Text style={s.panoHint}>360° · 3D</Text>
              </View>
              <Text style={[s.title, { color: fg }]}>{t("tourTitle")}</Text>
              <Text style={[s.text, { color: muted }]}>{t("tourText")}</Text>
            </>
          )}
          {step === 2 && (
            <>
              <View style={s.aiCard}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Sparkles size={16} color="#e8c66d" /><Text style={s.aiLabel}>IMORA AI</Text></View>
                <Text style={s.aiQuery}>“{query.slice(0, typed)}{typed >= query.length ? "”" : "▍"}</Text>
                {typed >= query.length && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[t("aiChip1"), t("aiChip2"), t("aiChip3"), t("aiChip4")].map((c) => <Text key={c} style={s.chip}>{c}</Text>)}
                  </View>
                )}
              </View>
              <Text style={[s.title, { color: fg }]}>{t("aiTitle")}</Text>
              <Text style={[s.text, { color: muted }]}>{t("aiText")}</Text>
            </>
          )}
          {step === 3 && (
            <>
              <Text style={[s.title, { color: fg }]}>{t("intentTitle")}</Text>
              <Text style={[s.text, { color: muted }]}>{t("intentText")}</Text>
              <View style={s.grid}>
                {intents.map(({ key, icon: Icon, href }) => (
                  <Pressable key={key} onPress={() => void finish(href)} style={({ pressed }) => [s.intent, pressed && { transform: [{ scale: 0.97 }] }]}>
                    <View style={s.intentIcon}><Icon size={20} color="#7d5f14" /></View>
                    <Text style={s.intentText}>{t(`intent.${key}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Animated.View>

        <View style={s.bottom}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <Pressable key={i} onPress={() => go(i)} style={[s.dot, i === step ? { width: 30, backgroundColor: "#fff" } : { backgroundColor: "rgba(255,255,255,0.55)" }]} />
            ))}
          </View>
          <Pressable onPress={() => (step < STEPS - 1 ? go(step + 1) : void finish())} style={s.next}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: "#111" }}>{step === 0 ? t("start") : step < STEPS - 1 ? t("next") : t("explore")}</Text>
            <ArrowRight size={18} color="#111" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontFamily: fonts.bodySemibold, fontSize: 19 },
  skip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingBottom: "22%" },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, textAlign: "center" },
  text: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23, textAlign: "center", maxWidth: 360 },
  lang: { height: 48, minWidth: 116, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  pano: { width: W * 0.62, height: W * 0.62, borderRadius: W, overflow: "hidden", backgroundColor: "#e9dfcb", borderWidth: 8, borderColor: "rgba(255,255,255,0.75)", alignItems: "center", justifyContent: "flex-end" },
  panoHint: { marginBottom: 18, fontFamily: fonts.bodyBold, color: "#fff", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  aiCard: { width: "100%", maxWidth: 360, borderRadius: 24, padding: 16, gap: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  aiLabel: { color: "#e8c66d", fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  aiQuery: { color: "rgba(255,255,255,0.9)", fontFamily: fonts.body, fontStyle: "italic", fontSize: 15, lineHeight: 22, minHeight: 66 },
  chip: { backgroundColor: "#f6dc98", color: "#16130d", fontFamily: fonts.bodySemibold, fontSize: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden" },
  grid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  intent: { width: "47%", flexGrow: 1, borderRadius: 22, padding: 16, gap: 12, backgroundColor: "rgba(255,255,255,0.85)" },
  intentIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#f8f0dc", alignItems: "center", justifyContent: "center" },
  intentText: { fontFamily: fonts.bodySemibold, fontSize: 15.5, color: "#111" },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { height: 10, width: 10, borderRadius: 5 },
  next: { height: 56, borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 8, elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12 },
});
