"use client";

import { loadMaplibre } from "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

/** Small static map centred on the listing's public location (approximate when requested). */
export function NeighborhoodMap({ lng, lat, label, approximate }: { lng: number; lat: number; label: string; approximate: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolved } = useTheme();

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const ml = await loadMaplibre();
      if (cancelled || !ref.current) return;
      map = new ml.Map({
        container: ref.current,
        style: resolved === "dark" ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron",
        center: [lng, lat],
        zoom: approximate ? 14 : 15,
        interactive: false,
        attributionControl: { compact: true },
      });
      map.on("load", () => {
        if (!map) return;
        if (approximate) {
          map.addSource("area", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} } });
          map.addLayer({ id: "area", type: "circle", source: "area", paint: { "circle-radius": 48, "circle-color": "#c9a246", "circle-opacity": 0.18, "circle-stroke-color": "#c9a246", "circle-stroke-width": 1.5 } });
        } else {
          const el = document.createElement("div");
          el.style.cssText = "width:22px;height:22px;border-radius:999px;background:#7d5f14;border:4px solid #fff;box-shadow:0 0 0 8px rgba(201,162,70,.25)";
          new ml.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        }
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lng, lat, approximate, resolved]);

  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border border-line bg-surface-2">
      <div className="absolute inset-0">
        <div ref={ref} className="h-full w-full" />
      </div>
      <span className="absolute start-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft">
        <MapPin className="size-3.5 text-gold" /> {label}
      </span>
    </div>
  );
}
