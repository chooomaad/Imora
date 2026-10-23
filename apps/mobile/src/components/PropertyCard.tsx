import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import { BadgeCheck, BedDouble, Box, CalendarDays, Heart, Ruler, ShowerHead } from "lucide-react-native";
import { formatPrice, placeName, type Locale, type PropertyCard as Card } from "@imora/shared";
import { fonts, useColors } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { Badge, Button } from "./ui";

export function periodLabel(period: string, locale: string) {
  if (period === "month") return locale === "ar" ? "/ شهر" : "/ mois";
  if (period === "year") return locale === "ar" ? "/ سنة" : "/ an";
  return "";
}

/** Mobile listing card (same information hierarchy as the web card). */
export function PropertyCard({ p, width }: { p: Card; width?: number }) {
  const c = useColors();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { session, favorites, toggleFavorite } = useSession();
  const title = locale === "ar" && p.title_ar ? p.title_ar : p.title;
  const fav = favorites.has(p.id);
  const open = () => router.push(`/property/${p.slug}`);

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line, width }]}>
      <Pressable onPress={open}>
        <Image source={p.cover_url} style={s.image} contentFit="cover" transition={250} />
        <View style={s.topRow}>
          <View style={s.badges}>
            {p.is_verified && <Badge label={t("property.verified")} icon={<BadgeCheck size={13} color="#1d4a37" />} />}
            {p.has_3d ? <Badge variant="dark" label={t("property.tour3d")} icon={<Box size={13} color="#e8c66d" />} /> : p.listing_type === "rent" ? <Badge variant="gold" label={t("property.location")} /> : null}
            {p.is_demo && <Badge variant="demo" label={t("common.demo")} />}
          </View>
          <Pressable
            onPress={() => (session ? void toggleFavorite(p.id) : router.push("/(tabs)/profile"))}
            accessibilityLabel={fav ? t("favorites.remove") : t("favorites.add")}
            style={s.heart}
          >
            <Heart size={20} color={fav ? "#b4321f" : "#111"} fill={fav ? "#b4321f" : "transparent"} />
          </Pressable>
        </View>
      </Pressable>
      <View style={s.body}>
        <Text style={[s.price, { color: c.ink }]}>
          {formatPrice(p.price)} <Text style={[s.currency, { color: c.muted }]}>MRU {periodLabel(p.price_period, locale)}</Text>
        </Text>
        <Text style={[s.title, { color: c.ink }]} numberOfLines={1} onPress={open}>{title}</Text>
        <Text style={[s.place, { color: c.muted }]} numberOfLines={1}>{[placeName(p.district, locale), placeName(p.city, locale)].filter(Boolean).join(", ")}</Text>
        <View style={s.specs}>
          {!!p.bedrooms && <Spec icon={<BedDouble size={15} color={c.gold} />} label={t("property.beds", { count: p.bedrooms })} />}
          {!!p.bathrooms && <Spec icon={<ShowerHead size={15} color={c.gold} />} label={t("property.baths", { count: p.bathrooms })} />}
          {!!p.area_m2 && <Spec icon={<Ruler size={15} color={c.gold} />} label={`${Math.round(Number(p.area_m2))} m²`} />}
        </View>
        <View style={s.actions}>
          <Button title={t("property.planVisit")} variant="secondary" style={{ flex: 1 }} icon={<CalendarDays size={16} color={c.ink} />} onPress={open} />
          {(p.has_360 || p.has_3d) && (
            <Button title={t("property.launch3d")} style={{ flex: 1 }} icon={<Box size={16} color={c.goldBright} />} onPress={() => router.push(`/tour/${p.slug}`)} />
          )}
        </View>
      </View>
    </View>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  const c = useColors();
  return (
    <View style={s.spec}>
      {icon}
      <Text style={[s.specText, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 4 / 3 },
  topRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  heart: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 6 },
  price: { fontFamily: fonts.bodyBold, fontSize: 25 },
  currency: { fontFamily: fonts.bodyBold, fontSize: 12 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 18 },
  place: { fontFamily: fonts.body, fontSize: 13 },
  specs: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  spec: { flexDirection: "row", alignItems: "center", gap: 5 },
  specText: { fontFamily: fonts.body, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
});
