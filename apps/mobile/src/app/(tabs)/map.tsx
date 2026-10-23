import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useTranslations } from "use-intl";
import { RefreshCw } from "lucide-react-native";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, formatPriceCompact, type MapMarker, type PropertyCard as Card, type PropertyFilters } from "@imora/shared";
import { Header } from "@/components/Header";
import { PropertyCard } from "@/components/PropertyCard";
import { Chip } from "@/components/ui";
import { markersInBounds, searchProperties } from "@/lib/api";
import { isConfigured } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

const initialRegion: Region = {
  longitude: DEFAULT_MAP_CENTER[0],
  latitude: DEFAULT_MAP_CENTER[1],
  latitudeDelta: 360 / 2 ** DEFAULT_MAP_ZOOM,
  longitudeDelta: 360 / 2 ** DEFAULT_MAP_ZOOM,
};

const bounds = (r: Region): [number, number, number, number] => [
  r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2,
];

/** Prices come from properties_in_bbox (PostGIS); "Rechercher dans cette zone" reloads the visible area. */
export default function MapScreen() {
  const c = useColors();
  const t = useTranslations();
  const region = useRef(initialRegion);
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setMarkers(await markersInBounds(bounds(region.current), filters));
    setMoved(false);
  }, [filters]);
  useEffect(() => void load(), [load]);

  const select = async (id: string) => {
    const r = await searchProperties({}, 0, 1, [id]);
    setSelected(r.items[0] ?? null);
  };

  const label = (m: MapMarker) =>
    m.price_period === "month" ? `${formatPriceCompact(m.price)} ${t("common.perMonth").replace("/ ", "/")}` : `${formatPriceCompact(m.price)} MRU`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header />
      <View style={{ flex: 1 }}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onRegionChangeComplete={(r, details) => {
            region.current = r;
            if (details?.isGesture) setMoved(true);
          }}
          onPress={() => setSelected(null)}
        >
          {markers.map((m) => (
            <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} onPress={() => void select(m.id)} tracksViewChanges={false}>
              <View style={[s.pin, selected?.id === m.id ? { backgroundColor: "#111110" } : { backgroundColor: c.surface }]}>
                <Text style={[s.pinText, { color: selected?.id === m.id ? "#fff" : c.ink }]}>{m.has_3d ? "◈ " : ""}{label(m)}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <ScrollView horizontal style={s.chips} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} showsHorizontalScrollIndicator={false}>
          <Chip label={t("map.only3d")} active={!!filters.has_3d} onPress={() => setFilters((f) => ({ ...f, has_3d: f.has_3d ? undefined : true }))} />
          {(["sale", "rent", "investment"] as const).map((lt) => (
            <Chip key={lt} label={t(`search.tabs.${lt}`)} active={filters.listing_type === lt} onPress={() => setFilters((f) => ({ ...f, listing_type: f.listing_type === lt ? undefined : lt }))} />
          ))}
        </ScrollView>

        {moved && (
          <Pressable onPress={() => void load()} style={[s.area, { backgroundColor: c.surface }]}>
            <RefreshCw size={16} color={c.gold} />
            <Text style={{ fontFamily: fonts.bodySemibold, color: c.ink }}>{t("search.searchThisArea")}</Text>
          </Pressable>
        )}

        {selected && (
          <View style={s.sheet}>
            <PropertyCard p={selected} />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pin: { paddingHorizontal: 12, height: 34, borderRadius: 999, justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  pinText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  chips: { position: "absolute", top: 12, left: 0, right: 0, flexGrow: 0 },
  area: { position: "absolute", top: 64, alignSelf: "center", flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 18, height: 42, borderRadius: 999, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  sheet: { position: "absolute", left: 12, right: 12, bottom: 12 },
});
