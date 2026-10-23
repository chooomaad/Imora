"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PropertyCard } from "@imora/shared";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fileToResizedBase64, imageSearch } from "@/services/ai";
import { PropertyCardCompact } from "@/features/properties/PropertyCard";

/** "Rechercher avec une photo": image → multimodal embedding → pgvector similarity. */
export function PhotoSearchButton() {
  const t = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [results, setResults] = useState<(PropertyCard & { similarity: number })[] | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResults(null);
    setError(null);
    if (!isSupabaseConfigured) return setError(t("ai.unavailable"));
    setLoading(true);
    try {
      const { data, mediaType } = await fileToResizedBase64(file);
      const res = await imageSearch(data, mediaType);
      setDescription(res.description);
      const ids = res.matches.map((m) => m.property_id);
      if (ids.length === 0) return setResults([]);
      const { data: cards } = await getSupabaseBrowser().rpc("search_properties", { p_filters: {}, p_limit: ids.length, p_offset: 0, p_ids: ids });
      const byId = new Map(((cards ?? []) as PropertyCard[]).map((c) => [c.id, c]));
      setResults(res.matches.filter((m) => byId.has(m.property_id)).map((m) => ({ ...byId.get(m.property_id)!, similarity: m.similarity })));
    } catch (e) {
      setError((e as Error).message === "rate_limited" ? t("ai.rateLimited") : t("ai.unavailable"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Camera className="size-4" /> {t("search.photoSearch")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("ai.photoTitle")} className="sm:max-w-2xl">
        <p className="text-sm text-muted">{t("ai.photoSubtitle")}</p>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button type="button" onClick={() => input.current?.click()}
          className="mt-4 flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-surface-2 text-muted hover:border-gold-bright">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImageUp className="size-7 text-gold" />{t("ai.photoPick")}</span>
          )}
        </button>
        {loading && <p className="mt-4 animate-pulse text-sm font-medium text-gold">{t("ai.photoAnalyzing")}</p>}
        {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}
        {description && <p className="mt-4 rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-ink-2">{description}</p>}
        {results && (
          <div className="mt-5 space-y-3">
            <h3 className="font-semibold">{t("ai.similarTitle")}</h3>
            {results.length === 0 ? (
              <EmptyState title={t("ai.photoNone")} />
            ) : (
              results.map((r) => (
                <div key={r.id} className="relative">
                  <PropertyCardCompact p={r} className="shadow-soft" />
                  <Badge variant="soft" className="absolute end-3 bottom-3">{t("ai.similarity", { value: Math.round(r.similarity * 100) })}</Badge>
                </div>
              ))
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
