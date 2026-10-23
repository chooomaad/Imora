"use client";

import { loadMaplibre } from "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { DEFAULT_MAP_CENTER } from "@imora/shared";

/** Click / drag to place the listing. Emits [lng, lat]. */
export function LocationPicker({ value, onChange }: { value: [number, number] | null; onChange: (v: [number, number]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const ml = await loadMaplibre();
      if (cancelled || !ref.current) return;
      map = new ml.Map({
        container: ref.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: value ?? DEFAULT_MAP_CENTER,
        zoom: value ? 15 : 12,
        attributionControl: { compact: true },
      });
      const place = (lngLat: [number, number]) => {
        if (!markerRef.current) {
          markerRef.current = new ml.Marker({ color: "#7d5f14", draggable: true }).setLngLat(lngLat).addTo(map!);
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLngLat();
            onChangeRef.current([p.lng, p.lat]);
          });
        } else {
          markerRef.current.setLngLat(lngLat);
        }
      };
      if (value) place(value);
      map.on("click", (e) => {
        const v: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        place(v);
        onChangeRef.current(v);
      });
    })();
    return () => {
      cancelled = true;
      markerRef.current = null;
      map?.remove();
    };
    // Map is created once; the marker is updated imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="h-72 overflow-hidden rounded-2xl border border-line" />;
}
