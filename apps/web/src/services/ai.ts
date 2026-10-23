"use client";

import type { PropertyFilters } from "@imora/shared";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Edge function errors carry a machine code in the JSON body ({ error: "rate_limited" }). */
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseBrowser().functions.invoke(name, { body });
  if (error) {
    let code = "generic";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) code = ((await ctx.json()) as { error?: string }).error ?? code;
    } catch {
      /* not JSON */
    }
    throw new Error(code);
  }
  return data as T;
}

export interface AiSearchResult {
  filters: PropertyFilters;
  interpretation: string;
  count: number;
}

export const aiSearch = (query: string, locale: string) => invoke<AiSearchResult>("ai-search", { query, locale });

export interface ImageSearchResult {
  matches: { property_id: string; similarity: number }[];
  description: string | null;
}

export const imageSearch = (imageBase64: string, mediaType: string, filters: PropertyFilters = {}) =>
  invoke<ImageSearchResult>("image-search", { image_base64: imageBase64, media_type: mediaType, filters });

export interface VisionSuggestion {
  id: string;
  kind: "description" | "room_detection" | "features" | "title";
  suggestion: Record<string, unknown>;
  status: "pending" | "accepted" | "edited" | "rejected";
}

export const analyzeListingPhotos = (propertyId: string, locale: string) =>
  invoke<{ suggestions: VisionSuggestion[] }>("ai-vision", { property_id: propertyId, locale });

/** Downscale an image client-side before sending it to the AI (bandwidth + cost). */
export async function fileToResizedBase64(file: File, maxSide = 1280): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
