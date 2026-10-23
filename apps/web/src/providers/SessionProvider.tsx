"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/models";

interface SessionValue {
  userId: string | null;
  profile: Profile | null;
  /** Returns true when signed in; otherwise sends the user to the login page and returns false. */
  requireAuth: () => boolean;
}

const SessionContext = createContext<SessionValue>({ userId: null, profile: null, requireAuth: () => false });

export function SessionProvider({ userId, profile, children }: { userId: string | null; profile: Profile | null; children: ReactNode }) {
  const nextRouter = useNextRouter();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data } = getSupabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") nextRouter.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [nextRouter]);

  const requireAuth = useCallback(() => {
    if (userId) return true;
    router.push({ pathname: "/login", query: { next: pathname } });
    return false;
  }, [userId, router, pathname]);

  return <SessionContext.Provider value={{ userId, profile, requireAuth }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
