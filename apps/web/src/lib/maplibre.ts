"use client";

let loader: Promise<typeof import("maplibre-gl")> | null = null;

/** Lazy-loads MapLibre once and points it at the statically served worker (see scripts/copy-maplibre-worker.mjs). */
export function loadMaplibre() {
  loader ??= import("maplibre-gl").then((ml) => {
    ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    return ml;
  });
  return loader;
}
