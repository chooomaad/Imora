"use client";

import { useEffect, useState } from "react";
import type { PropertyFilters } from "@imora/shared";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Debounced count of published listings matching `filters` (count_properties RPC). */
export function useLiveCount(filters: PropertyFilters, initial: number | null = null) {
  const [count, setCount] = useState<number | null>(initial);
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      const { data, error } = await getSupabaseBrowser().rpc("count_properties", { p_filters: JSON.parse(key) });
      if (!cancelled && !error) setCount(Number(data ?? 0));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [key]);

  return count;
}
