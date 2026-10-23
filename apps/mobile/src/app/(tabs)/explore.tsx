import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { Search } from "lucide-react-native";
import { filtersFromSearchParams, type PropertyCard as Card, type PropertyFilters } from "@imora/shared";
import { Header } from "@/components/Header";
import { PropertyCard } from "@/components/PropertyCard";
import { Chip } from "@/components/ui";
import { searchProperties } from "@/lib/api";
import { isConfigured } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

const PAGE = 12;

export default function Explore() {
  const c = useColors();
  const t = useTranslations();
  const params = useLocalSearchParams<{ q?: string }>();
  const [filters, setFilters] = useState<PropertyFilters>(() => filtersFromSearchParams(new URLSearchParams(params.q ?? "")));
  const [items, setItems] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");

  useEffect(() => {
    if (params.q != null) setFilters(filtersFromSearchParams(new URLSearchParams(params.q)));
  }, [params.q]);

  const load = useCallback(async (p: number, f: PropertyFilters) => {
    if (!isConfigured) return;
    setLoading(true);
    const r = await searchProperties(f, p, PAGE).catch(() => ({ items: [] as Card[], total: 0 }));
    setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items.filter((x) => !prev.some((y) => y.id === x.id))]));
    setTotal(r.total);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => void load(0, filters), [filters, load]);
  const toggle = (k: "has_3d" | "has_360" | "verified" | "pool") => setFilters((f) => ({ ...f, [k]: f[k] ? undefined : true }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        renderItem={({ item }) => <PropertyCard p={item} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => items.length < total && !loading && void load(page + 1, filters)}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={[s.search, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Search size={20} color={c.gold} />
              <TextInput value={q} onChangeText={setQ} placeholder={t("search.placeholder")} placeholderTextColor={c.subtle}
                returnKeyType="search" onSubmitEditing={() => setFilters((f) => ({ ...f, q: q.trim() || undefined }))}
                style={[s.input, { color: c.ink }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(["sale", "rent", "investment"] as const).map((lt) => (
                <Chip key={lt} label={t(`search.tabs.${lt}`)} active={(filters.listing_type ?? "sale") === lt} onPress={() => setFilters((f) => ({ ...f, listing_type: lt }))} />
              ))}
              <Chip label={t("filters.has_3d")} active={!!filters.has_3d} onPress={() => toggle("has_3d")} />
              <Chip label={t("filters.has_360")} active={!!filters.has_360} onPress={() => toggle("has_360")} />
              <Chip label={t("filters.verified")} active={!!filters.verified} onPress={() => toggle("verified")} />
              <Chip label={t("filters.pool")} active={!!filters.pool} onPress={() => toggle("pool")} />
            </ScrollView>
            <Text style={{ fontFamily: fonts.bodySemibold, color: c.ink, fontSize: 15 }}>{t("search.results", { count: total })}</Text>
          </View>
        }
        ListEmptyComponent={loading ? null : <Text style={{ color: c.muted, fontFamily: fonts.body, textAlign: "center", marginTop: 40 }}>{t("search.noResults")}</Text>}
        ListFooterComponent={loading ? <ActivityIndicator color={c.gold} /> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, height: 52 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
});
