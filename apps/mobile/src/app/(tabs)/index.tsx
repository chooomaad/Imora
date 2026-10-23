import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import { ArrowRight, Box, Search, ShieldCheck, Sparkles } from "lucide-react-native";
import { filtersToSearchParams, NOUAKCHOTT_DISTRICTS, placeName, type ListingType, type Locale, type PropertyCard as Card, type PropertyFilters } from "@imora/shared";
import { Header } from "@/components/Header";
import { PropertyCard } from "@/components/PropertyCard";
import { Button, Card as Box_, Chip, Eyebrow, H2 } from "@/components/ui";
import { aiSearch, countProperties, searchProperties } from "@/lib/api";
import { isConfigured } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

export default function Home() {
  const c = useColors();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState<ListingType>("sale");
  const [district, setDistrict] = useState<string | undefined>();
  const [count, setCount] = useState<number | null>(null);
  const [featured, setFeatured] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [ai, setAi] = useState<{ filters: PropertyFilters; count: number; interpretation: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const filters: PropertyFilters = { listing_type: tab, ...(district ? { city: "Nouakchott", district } : {}) };

  useEffect(() => {
    if (!isConfigured) return;
    void countProperties(filters).then(setCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, district]);
  useEffect(() => {
    if (isConfigured) void searchProperties({ verified: true }, 0, 6).then((r) => setFeatured(r.items));
  }, []);

  const openExplore = (f: PropertyFilters) => router.push({ pathname: "/(tabs)/explore", params: { q: filtersToSearchParams(f).toString() } });

  const runAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      setAi(await aiSearch(query.trim() || t("ai.placeholder"), locale));
    } catch (e) {
      setAiError((e as Error).message === "rate_limited" ? t("ai.rateLimited") : t("ai.unavailable"));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        <View style={[s.verified, { backgroundColor: c.goldSoft }]}>
          <ShieldCheck size={15} color={c.gold} />
          <Text style={[s.verifiedText, { color: c.gold }]}>{t("home.verifiedBadge").toUpperCase()}</Text>
        </View>
        <Text style={[s.hero, { color: c.ink }]}>
          {t("home.heroTitleStart")} <Text style={{ fontFamily: fonts.displayItalic, color: c.gold }}>{t("home.heroTitleAccent")}</Text> {t("home.heroTitleEnd")}
        </Text>
        <Text style={[s.sub, { color: c.muted }]}>{t("home.heroSubtitle")}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {NOUAKCHOTT_DISTRICTS.slice(0, 5).map((d) => (
            <Chip key={d} label={placeName(d, locale)} active={district === d} onPress={() => setDistrict(district === d ? undefined : d)} />
          ))}
        </ScrollView>

        <Box_ style={{ gap: 12 }}>
          <View style={[s.segment, { backgroundColor: c.surface2 }]}>
            {(["sale", "rent", "investment"] as const).map((v) => (
              <Pressable key={v} onPress={() => setTab(v)} style={[s.segmentItem, tab === v && { backgroundColor: c.surface }]}>
                <Text style={[s.segmentText, { color: tab === v ? c.ink : c.muted }]}>{t(`search.tabs.${v}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Button title={count == null ? t("search.exploreNoCount") : t("search.explore", { count })} icon={<Search size={18} color={c.onInk} />} onPress={() => openExplore(filters)} />
        </Box_>

        <Box_ style={{ gap: 12, backgroundColor: c.surface2 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Sparkles size={22} color={c.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: c.ink }]}>{t("ai.title")}</Text>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12.5 }}>{t("ai.subtitle")}</Text>
            </View>
          </View>
          <TextInput
            value={query}
            onChangeText={(v) => { setQuery(v); setAi(null); }}
            placeholder={`“${t("ai.placeholder")}”`}
            placeholderTextColor={c.ink2}
            multiline
            style={[s.aiInput, { backgroundColor: c.surface, borderColor: c.line, color: c.ink }]}
          />
          {ai && <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{ai.interpretation}</Text>}
          {aiError && <Text style={{ color: c.danger, fontFamily: fonts.body }}>{aiError}</Text>}
          {ai ? (
            <Button variant="gold" title={t("search.explore", { count: ai.count })} icon={<ArrowRight size={16} color="#fff" />} onPress={() => openExplore(ai.filters)} />
          ) : (
            <Button variant="gold" title={aiLoading ? t("ai.analyzing") : t("ai.launch")} loading={aiLoading} onPress={runAi} />
          )}
        </Box_>

        <Pressable onPress={() => router.push("/(tabs)/tours")} style={s.promo}>
          <Text style={s.promoBadge}>{t("home.tourBadge")}</Text>
          <Text style={s.promoTitle}>{t("home.tourTitle")}</Text>
          <Text style={s.promoText}>{t("home.tourSubtitle")}</Text>
          <View style={s.promoBtn}><Box size={18} color="#111" /><Text style={s.promoBtnText}>{t("home.exploreTours")}</Text></View>
        </Pressable>

        <View>
          <Eyebrow>{t("home.selectionEyebrow")}</Eyebrow>
          <H2>{t("home.selectionTitle")}</H2>
        </View>
        <FlatList
          horizontal
          data={featured}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PropertyCard p={item} width={320} />}
          ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
          showsHorizontalScrollIndicator={false}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  verified: { flexDirection: "row", gap: 6, alignSelf: "flex-start", alignItems: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  verifiedText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8 },
  hero: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42 },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  segment: { flexDirection: "row", borderRadius: 16, padding: 4 },
  segmentItem: { flex: 1, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  aiInput: { borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 90, fontFamily: fonts.body, fontSize: 14.5, fontStyle: "italic", textAlignVertical: "top" },
  promo: { backgroundColor: "#0f0e0c", borderRadius: 26, padding: 22, gap: 10 },
  promoBadge: { color: "#e8c66d", fontFamily: fonts.bodySemibold, fontSize: 12 },
  promoTitle: { color: "#fff", fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  promoText: { color: "rgba(255,255,255,0.6)", fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  promoBtn: { marginTop: 8, height: 48, borderRadius: 14, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  promoBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: "#111" },
});
