import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/Nav";

/** Full-bleed layout for the map (no max-width container). */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AppHeader />
      </Suspense>
      <main>{children}</main>
      <BottomNav />
    </>
  );
}
