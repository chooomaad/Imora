"use client";

import dynamic from "next/dynamic";
import type { TourExperienceProps } from "./TourExperience";

/** Three.js is loaded only on the client and only on tour pages (keeps other pages light). */
const TourExperience = dynamic(() => import("./TourExperience").then((m) => m.TourExperience), {
  ssr: false,
  loading: () => <div className="mx-auto h-[62dvh] min-h-[420px] max-w-5xl animate-pulse bg-[#0d0c0a] sm:rounded-b-[28px]" />,
});

export function TourClient(props: TourExperienceProps) {
  return <TourExperience {...props} />;
}
