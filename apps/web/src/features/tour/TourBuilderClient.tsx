"use client";

import dynamic from "next/dynamic";

/** Loads Three.js only in the builder. */
const TourBuilder = dynamic(() => import("./TourBuilder").then((m) => m.TourBuilder), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-card bg-surface-2" />,
});

export function TourBuilderClient(props: { propertyId: string; propertyTitle: string; tourId: string | null }) {
  return <TourBuilder {...props} />;
}
