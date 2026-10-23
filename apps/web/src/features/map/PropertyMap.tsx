"use client";

import { loadMaplibre } from "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, formatPriceCompact, type MapMarker, type PropertyFilters } from "@imora/shared";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useTheme } from "@/providers/ThemeProvider";

export type Bbox = [number, number, number, number];

export interface PropertyMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
  locate: () => Promise<boolean>;
  toggleStyle: () => void;
  getBearing: () => number;
}

const STYLES = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  detailed: "https://tiles.openfreemap.org/styles/liberty",
};

const ICON_3D = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5L12 7Z"/></svg>`;
const ICON_KEY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 9-9M16 7l3 3M14 9l2 2"/></svg>`;

function markerLabel(m: MapMarker, labels: { perMonth: string; land: string }) {
  const price = `${formatPriceCompact(m.price)}${m.price_period === "total" ? " MRU" : ""}`;
  if (m.price_period === "month") return `${ICON_KEY}<span>${price} ${labels.perMonth}</span>`;
  if (m.property_type === "land") return `<span style="color:var(--gold);font-weight:600">${labels.land}</span><span>${price}</span>`;
  if (m.has_3d) return `<span style="color:var(--gold-bright)">${ICON_3D}</span><span>${price}</span>`;
  return `<span>${price}</span>`;
}

function styleMarker(el: HTMLElement, selected: boolean) {
  el.style.background = selected ? "#111110" : "var(--surface)";
  el.style.color = selected ? "#fff" : "var(--ink)";
  el.style.boxShadow = selected ? "0 0 0 6px color-mix(in srgb, var(--gold-bright) 30%, transparent), 0 6px 16px rgba(0,0,0,.25)" : "var(--shadow-pin)";
  el.style.zIndex = selected ? "3" : "1";
  el.style.transform = selected ? "scale(1.08)" : "";
}

/**
 * Interactive property map: prices from `properties_in_bbox`, GeoJSON clustering,
 * HTML price markers for unclustered listings.
 */
export const PropertyMap = forwardRef<PropertyMapHandle, {
  filters: PropertyFilters;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoved: () => void;
  onLoaded: (markers: MapMarker[]) => void;
  searchToken: number;
  labels: { perMonth: string; land: string };
}>(function PropertyMap({ filters, selectedId, onSelect, onMoved, onLoaded, searchToken, labels }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { marker: MlMarker; el: HTMLElement }>());
  const markerCtor = useRef<typeof MlMarker | null>(null);
  const data = useRef<MapMarker[]>([]);
  const selectedRef = useRef(selectedId);
  const userMoved = useRef(false);
  const firstFit = useRef(true);
  const { resolved } = useTheme();
  const [styleKey, setStyleKey] = useState<"base" | "detailed">("base");
  const filtersKey = JSON.stringify(filters);
  selectedRef.current = selectedId;

  const fetchMarkers = useCallback(async (fit: boolean) => {
    const map = mapRef.current;
    if (!map || !isSupabaseConfigured) return;
    // When fitting to results, search the whole country; otherwise the visible area.
    const b = map.getBounds();
    const bbox: Bbox = fit ? [-17.2, 14.6, -4.7, 27.4] : [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const { data: rows, error } = await getSupabaseBrowser().rpc("properties_in_bbox", {
      p_min_lng: bbox[0], p_min_lat: bbox[1], p_max_lng: bbox[2], p_max_lat: bbox[3],
      p_filters: JSON.parse(filtersKey), p_limit: 1500,
    });
    if (error) return;
    data.current = (rows ?? []) as MapMarker[];
    const source = map.getSource("properties") as GeoJSONSource | undefined;
    await source?.setData({
      type: "FeatureCollection",
      features: data.current.map((m) => ({
        type: "Feature",
        id: m.id,
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: { id: m.id },
      })),
    });
    onLoaded(data.current);
    if (fit && data.current.length > 0) {
      const lngs = data.current.map((m) => m.lng);
      const lats = data.current.map((m) => m.lat);
      userMoved.current = false;
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: { top: 140, bottom: 260, left: 40, right: 90 }, maxZoom: 14, duration: firstFit.current ? 0 : 700,
      });
      firstFit.current = false;
    }
  }, [filtersKey, onLoaded]);

  // Sync HTML markers with unclustered features currently rendered
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const Marker = markerCtor.current;
    if (!map || !Marker || !map.getSource("properties")) return;
    const features = map.querySourceFeatures("properties", { filter: ["!", ["has", "point_count"]] });
    const visible = new Set<string>();
    for (const f of features) {
      const id = String(f.properties?.id);
      if (visible.has(id)) continue;
      visible.add(id);
      if (markers.current.has(id)) continue;
      const m = data.current.find((x) => x.id === id);
      if (!m) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "imora-pin";
      el.setAttribute("aria-label", `${formatPriceCompact(m.price)} MRU`);
      el.style.cssText = "display:flex;align-items:center;gap:6px;height:38px;padding:0 14px;border-radius:999px;font:700 14px var(--font-body),sans-serif;white-space:nowrap;cursor:pointer;transition:transform .15s, box-shadow .15s;border:0";
      el.innerHTML = markerLabel(m, labels);
      styleMarker(el, selectedRef.current === id);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(id);
      });
      const marker = new Marker({ element: el, anchor: "bottom", offset: [0, -4] }).setLngLat([m.lng, m.lat]).addTo(map);
      markers.current.set(id, { marker, el });
    }
    for (const [id, { marker }] of markers.current) {
      if (!visible.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [labels, onSelect]);

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const ml = await loadMaplibre();
      if (cancelled || !container.current) return;
      markerCtor.current = ml.Marker;
      map = new ml.Map({
        container: container.current,
        style: resolved === "dark" ? STYLES.dark : STYLES.light,
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        attributionControl: { compact: true },
        dragRotate: true,
      });
      mapRef.current = map;

      const addLayers = () => {
        if (!map || map.getSource("properties")) return;
        map.addSource("properties", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 48, clusterMaxZoom: 15 });
        map.addLayer({
          id: "clusters", type: "circle", source: "properties", filter: ["has", "point_count"],
          paint: {
            "circle-color": "#111110",
            "circle-radius": ["step", ["get", "point_count"], 20, 10, 25, 30, 32],
            "circle-stroke-width": 5,
            "circle-stroke-color": "rgba(201,162,70,0.35)",
          },
        });
        map.addLayer({
          id: "cluster-count", type: "symbol", source: "properties", filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] },
          paint: { "text-color": "#ffffff" },
        });
        void fetchMarkers(true);
      };

      map.on("load", addLayers);
      map.on("style.load", addLayers);
      map.on("render", syncMarkers);
      map.on("click", "clusters", async (e) => {
        const feature = e.features?.[0];
        const source = map!.getSource("properties") as GeoJSONSource;
        if (!feature) return;
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
        map!.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on("mouseenter", "clusters", () => (map!.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map!.getCanvas().style.cursor = ""));
      map.on("click", () => onSelect(null));
      map.on("dragend", () => {
        userMoved.current = true;
        onMoved();
      });
      map.on("zoomend", (e) => {
        if ((e as { originalEvent?: unknown }).originalEvent) {
          userMoved.current = true;
          onMoved();
        }
      });
    })();
    const markerMap = markers.current;
    return () => {
      cancelled = true;
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      map?.remove();
      mapRef.current = null;
    };
    // The map instance is created once; theme/style changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme / layer switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();
    map.setStyle(styleKey === "detailed" ? STYLES.detailed : resolved === "dark" ? STYLES.dark : STYLES.light);
  }, [resolved, styleKey]);

  // Filters changed => refetch and fit to results
  useEffect(() => {
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();
    if (mapRef.current?.getSource("properties")) void fetchMarkers(true);
  }, [filtersKey, fetchMarkers]);

  // "Rechercher dans cette zone"
  useEffect(() => {
    if (searchToken > 0) void fetchMarkers(false);
  }, [searchToken, fetchMarkers]);

  // Selection styling
  useEffect(() => {
    markers.current.forEach(({ el }, id) => styleMarker(el, id === selectedId));
  }, [selectedId]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    resetNorth: () => mapRef.current?.easeTo({ bearing: 0, pitch: 0 }),
    getBearing: () => mapRef.current?.getBearing() ?? 0,
    toggleStyle: () => setStyleKey((s) => (s === "base" ? "detailed" : "base")),
    locate: () =>
      new Promise<boolean>((resolve) => {
        if (!navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
            userMoved.current = true;
            onMoved();
            resolve(true);
          },
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      }),
  }), [onMoved]);

  // maplibre-gl.css sets `.maplibregl-map { position: relative }`, so the container fills a positioned wrapper
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" role="application" aria-label="Carte des biens" />
    </div>
  );
});
