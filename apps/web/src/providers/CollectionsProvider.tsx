"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "./SessionProvider";

const COMPARE_KEY = "imora-compare";
const MAX_COMPARE = 4;

interface CollectionsValue {
  favorites: Set<string>;
  toggleFavorite: (propertyId: string) => Promise<void>;
  compare: string[];
  toggleCompare: (propertyId: string) => void;
  clearCompare: () => void;
}

const CollectionsContext = createContext<CollectionsValue>({
  favorites: new Set(),
  toggleFavorite: async () => {},
  compare: [],
  toggleCompare: () => {},
  clearCompare: () => {},
});

/**
 * Favorites live in the `favorites` table (RLS: own rows). The comparison basket is kept
 * locally until the user saves it (it is useful before signing in).
 */
export function CollectionsProvider({ initialFavorites, children }: { initialFavorites: string[]; children: ReactNode }) {
  const { userId, requireAuth } = useSession();
  const toast = useToast();
  const t = useTranslations();
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => setFavorites(new Set(initialFavorites)), [initialFavorites]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMPARE_KEY);
      if (raw) setCompare((JSON.parse(raw) as string[]).slice(0, MAX_COMPARE));
    } catch {
      /* ignore */
    }
  }, []);

  const persistCompare = (ids: string[]) => {
    setCompare(ids);
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  const toggleFavorite = useCallback(
    async (propertyId: string) => {
      if (!requireAuth() || !userId) return;
      const supabase = getSupabaseBrowser();
      const isFav = favorites.has(propertyId);
      // Optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(propertyId);
        else next.add(propertyId);
        return next;
      });
      const { error } = isFav
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("property_id", propertyId)
        : await supabase.from("favorites").insert({ user_id: userId, property_id: propertyId });
      if (error) {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(propertyId);
          else next.delete(propertyId);
          return next;
        });
        toast(t("common.error"), "error");
      }
    },
    [favorites, requireAuth, userId, toast, t],
  );

  const toggleCompare = useCallback(
    (propertyId: string) => {
      if (compare.includes(propertyId)) {
        persistCompare(compare.filter((id) => id !== propertyId));
      } else if (compare.length >= MAX_COMPARE) {
        toast(t("compare.max"), "error");
      } else {
        persistCompare([...compare, propertyId]);
      }
    },
    [compare, toast, t],
  );

  return (
    <CollectionsContext.Provider value={{ favorites, toggleFavorite, compare, toggleCompare, clearCompare: () => persistCompare([]) }}>
      {children}
    </CollectionsContext.Provider>
  );
}

export const useCollections = () => useContext(CollectionsContext);
