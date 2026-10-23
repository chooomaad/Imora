import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/Nav";
import { CompareBar } from "@/features/compare/CompareBar";
import { SetupNotice } from "@/components/layout/SetupNotice";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AppHeader />
      </Suspense>
      <SetupNotice />
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl pb-28 lg:pb-16">{children}</main>
      <CompareBar />
      <BottomNav />
    </>
  );
}
