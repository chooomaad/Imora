import { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";
import { BedDouble, Box, CalendarCheck, ChevronLeft, Eye, MessageCircle, Phone, Ruler, ShowerHead, Waves } from "lucide-react-native";
import { formatPrice, placeName, whatsappLink, type Locale } from "@imora/shared";
import { Badge, Button, Card } from "@/components/ui";
import { periodLabel } from "@/components/PropertyCard";
import { logContactEvent, recordView, requestVisit, revealContact, visitSlots } from "@/lib/api";
import { useSession } from "@/lib/session";
import { errorCode, supabase } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

interface Detail {
  id: string; slug: string; reference: string; title: string; title_ar: string | null; description: string | null; description_ar: string | null;
  listing_type: string; price: number; price_period: string; city: string; district: string | null; owner_id: string;
  bedrooms: number | null; bathrooms: number | null; area_m2: number | null; has_pool: boolean; has_360: boolean; has_3d: boolean;
  is_verified: boolean; is_demo: boolean; media: { url: string | null; kind: string; is_cover: boolean; position: number }[];
}

const W = Dimensions.get("window").width;

export default function PropertyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = useColors();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [p, setP] = useState<Detail | null>(null);
  const [contact, setContact] = useState<{ contact_name: string | null; phone: string | null; whatsapp: string | null } | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i + 1);
    return d.toISOString().slice(0, 10);
  }), []);

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, slug, reference, title, title_ar, description, description_ar, listing_type, price, price_period, city, district, owner_id, bedrooms, bathrooms, area_m2, has_pool, has_360, has_3d, is_verified, is_demo, media:property_media(url, kind, is_cover, position)")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as Detail | null;
        if (d) {
          d.media = d.media.filter((m) => m.kind === "image" && m.url).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position);
          void recordView(d.id);
        }
        setP(d);
      });
    void visitSlots().then(setSlots).catch(() => setSlots(["10:00", "11:30", "15:00", "17:00"]));
  }, [slug]);

  if (!p) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const title = locale === "ar" && p.title_ar ? p.title_ar : p.title;
  const isOwn = session?.user.id === p.owner_id;

  const reveal = () => {
    if (!session) return router.push("/(tabs)/profile");
    Alert.alert(t("contact.confirmTitle"), t("contact.confirmText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("contact.confirmAction"),
        onPress: async () => {
          try {
            setContact(await revealContact(p.id));
          } catch (e) {
            Alert.alert(errorCode(e) === "reveal_limit_reached" ? t("contact.limitReached") : t("common.error"));
          }
        },
      },
    ]);
  };

  const book = async () => {
    if (!session) return router.push("/(tabs)/profile");
    if (!date || !time) return;
    setBooking(true);
    try {
      await requestVisit(p.id, date, time);
      Alert.alert(t("visit.title"), t("visit.confirmed", { date, time }));
    } catch (e) {
      const code = errorCode(e);
      Alert.alert(t.has(`visit.errors.${code}` as never) ? t(`visit.errors.${code}` as never) : t("common.error"));
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          <FlatList horizontal pagingEnabled data={p.media} keyExtractor={(m, i) => `${m.url}${i}`} showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <Image source={item.url} style={{ width: W, height: W * 0.85 }} contentFit="cover" />} />
          <Pressable onPress={() => router.back()} style={[s.back, { top: insets.top + 8 }]} accessibilityLabel={t("common.back")}>
            <ChevronLeft size={24} color="#111" />
          </Pressable>
          <View style={s.heroText}>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
              {p.is_verified && <Badge label={t("property.verified100")} />}
              {p.is_demo && <Badge variant="demo" label={t("common.demo")} />}
            </View>
            <Text style={s.heroPlace}>{[placeName(p.district, locale), placeName(p.city, locale)].filter(Boolean).join(", ").toUpperCase()}</Text>
            <Text style={s.heroTitle}>{title}</Text>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {(p.has_360 || p.has_3d) && (
            <Pressable onPress={() => router.push(`/tour/${p.slug}`)} style={s.immersive}>
              <Text style={s.immEyebrow}>{t("property.immersionEyebrow").toUpperCase()}</Text>
              <Text style={s.immTitle}>{t("property.immersionTitle")}</Text>
              <View style={s.immBtn}><Box size={18} color="#16130d" /><Text style={s.immBtnText}>{t("property.launchTour")}</Text></View>
            </Pressable>
          )}

          <Card>
            <Text style={[s.label, { color: c.muted }]}>{(p.price_period === "total" ? t("property.acquisitionPrice") : t("property.monthlyRent")).toUpperCase()}</Text>
            <Text style={[s.price, { color: c.ink }]}>{formatPrice(p.price)} <Text style={{ fontSize: 13, color: c.muted }}>MRU {periodLabel(p.price_period, locale)}</Text></Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
              {!!p.bedrooms && <Spec icon={<BedDouble size={16} color={c.gold} />} label={t("property.bedrooms", { count: p.bedrooms })} />}
              {!!p.bathrooms && <Spec icon={<ShowerHead size={16} color={c.gold} />} label={t("property.bathrooms", { count: p.bathrooms })} />}
              {!!p.area_m2 && <Spec icon={<Ruler size={16} color={c.gold} />} label={`${Math.round(Number(p.area_m2))} m²`} />}
              {p.has_pool && <Spec icon={<Waves size={16} color={c.gold} />} label={t("property.privatePool")} />}
            </View>
          </Card>

          {!!(locale === "ar" ? p.description_ar ?? p.description : p.description) && (
            <Card><Text style={{ color: c.ink2, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 }}>{locale === "ar" ? p.description_ar ?? p.description : p.description}</Text></Card>
          )}

          {!isOwn && (
            <Card style={{ gap: 12 }}>
              <Text style={[s.section, { color: c.ink }]}>{t("visit.title")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {days.map((d) => (
                  <Pressable key={d} onPress={() => setDate(d)} style={[s.day, { backgroundColor: date === d ? c.ink : c.surface2 }]}>
                    <Text style={{ color: date === d ? c.onInk : c.ink, fontFamily: fonts.bodyBold, fontSize: 20 }}>{d.slice(8)}</Text>
                    <Text style={{ color: date === d ? c.onInk : c.muted, fontFamily: fonts.body, fontSize: 11 }}>{d.slice(5, 7)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {slots.map((sl) => (
                  <Pressable key={sl} onPress={() => setTime(sl)} style={[s.slot, { backgroundColor: time === sl ? c.ink : c.surface2 }]}>
                    <Text style={{ color: time === sl ? c.onInk : c.ink, fontFamily: fonts.bodySemibold }}>{sl}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title={t("visit.confirm")} icon={<CalendarCheck size={18} color={c.onInk} />} onPress={book} loading={booking} disabled={!date || !time} />
            </Card>
          )}

          {!isOwn && (
            <Card style={{ gap: 10 }}>
              {contact ? (
                <>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, textAlign: "center" }}>{contact.contact_name}</Text>
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 24, textAlign: "center" }}>{contact.phone}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button style={{ flex: 1 }} variant="secondary" title={t("contact.call")} icon={<Phone size={16} color={c.ink} />}
                      onPress={() => { void logContactEvent(p.id, "call_click"); void Linking.openURL(`tel:${contact.phone}`); }} />
                    {contact.whatsapp && (
                      <Button style={{ flex: 1 }} title={t("contact.whatsapp")} icon={<MessageCircle size={16} color={c.onInk} />}
                        onPress={() => { void logContactEvent(p.id, "whatsapp_click"); void Linking.openURL(whatsappLink(contact.whatsapp!, t("contact.whatsappText", { title: p.title, ref: p.reference }))); }} />
                    )}
                  </View>
                </>
              ) : (
                <Button title={t("contact.showPhone")} icon={<Eye size={16} color={c.onInk} />} onPress={reveal} />
              )}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  const c = useColors();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{icon}<Text style={{ color: c.ink2, fontFamily: fonts.body }}>{label}</Text></View>;
}

const s = StyleSheet.create({
  back: { position: "absolute", left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  heroText: { position: "absolute", left: 16, right: 16, bottom: 16 },
  heroPlace: { color: "#f1d58c", fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1 },
  heroTitle: { color: "#fff", fontFamily: fonts.display, fontSize: 30, lineHeight: 34, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 12 },
  immersive: { backgroundColor: "#0f0e0c", borderRadius: 22, padding: 18, gap: 6 },
  immEyebrow: { color: "#e8c66d", fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
  immTitle: { color: "#fff", fontFamily: fonts.display, fontSize: 22 },
  immBtn: { marginTop: 8, height: 48, borderRadius: 14, backgroundColor: "#f6dc98", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  immBtnText: { color: "#16130d", fontFamily: fonts.bodySemibold, fontSize: 14.5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.8 },
  price: { fontFamily: fonts.bodyBold, fontSize: 32, marginTop: 4 },
  section: { fontFamily: fonts.display, fontSize: 22 },
  day: { width: 64, height: 72, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  slot: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
