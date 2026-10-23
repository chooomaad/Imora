"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { countActiveFilters, filtersToSearchParams, PROPERTY_TYPES, SORT_OPTIONS, type PropertyCard as Card, type PropertyFilters, type SortOption } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Chip, EmptyState, Select } from "@/components/ui/primitives";
import { Icon3D, Icon360 } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PropertyCard, PropertyCardSkeleton } from "@/features/properties/PropertyCard";
import { PhotoSearchButton } from "@/features/ai/PhotoSearch";
import { FiltersSheet } from "./FiltersSheet";
import { SaveSearchButton } from "./SaveSearchButton";
import { describeFilters } from "./describeFilters";

const PAGE = 12;

export function ExplorerView({ filters, initial, total }: { filters: PropertyFilters; initial: Card[]; total: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const [pending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  // Reset when the server sends a new result set (filters changed)
  useEffect(() => {
    setItems(initial);
    setPage(0);
    setQ(filters.q ?? "");
  }, [initial, filters.q]);

  const apply = useCallback(
    (next: PropertyFilters) => {
      setSheet(false);
      startTransition(() => router.replace(`/explore?${filtersToSearchParams(next).toString()}`, { scroll: false }));
    },
    [router],
  );

  const hasMore = items.length < total;
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data } = await getSupabaseBrowser().rpc("search_properties", { p_filters: filters, p_limit: PAGE, p_offset: (page + 1) * PAGE });
    setItems((prev) => [...prev, ...((data ?? []) as Card[]).filter((p) => !prev.some((x) => x.id === p.id))]);
    setPage((p) => p + 1);
    setLoadingMore(false);
  }, [filters, page, hasMore, loadingMore]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const quick = (k: "has_3d" | "has_360" | "verified" | "pool") => apply({ ...filters, [k]: filters[k] ? undefined : true });
  const chips = describeFilters(filters, t as never, locale);
  const active = countActiveFilters(filters);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ ...filters, q: q.trim() || undefined });
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 ps-4 shadow-soft"
      >
        <Search className="size-5 shrink-0 text-gold" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
          aria-label={t("search.placeholder")}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); apply({ ...filters, q: undefined }); }} className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted" aria-label={t("search.clear")}>
            <X className="size-4" />
          </button>
        )}
        <Button type="button" onClick={() => setSheet(true)} className="rounded-full">
          <SlidersHorizontal className="size-4" /> {t("search.filter")}
          {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-gold-bright text-[11px] text-ink">{active}</span>}
        </Button>
      </form>

      {/* Quick chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {(["sale", "rent", "investment"] as const).map((lt) => (
          <Chip key={lt} active={(filters.listing_type ?? "sale") === lt} onClick={() => apply({ ...filters, listing_type: lt })}>{t(`search.tabs.${lt}`)}</Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        <Chip active={!!filters.has_3d} onClick={() => quick("has_3d")} className={filters.has_3d ? "bg-gold text-white" : ""}><Icon3D size={16} />{t("filters.has_3d")}</Chip>
        <Chip active={!!filters.has_360} onClick={() => quick("has_360")}><Icon360 size={16} />{t("filters.has_360")}</Chip>
        <Chip active={!!filters.verified} onClick={() => quick("verified")}>{t("filters.verified")}</Chip>
        <Chip active={!!filters.pool} onClick={() => quick("pool")}>{t("filters.pool")}</Chip>
        {PROPERTY_TYPES.slice(0, 4).map((ty) => (
          <Chip key={ty} active={filters.property_types?.length === 1 && filters.property_types[0] === ty}
            onClick={() => apply({ ...filters, property_types: filters.property_types?.[0] === ty ? undefined : [ty] })}>
            {t(`propertyTypes.${ty}`)}
          </Chip>
        ))}
      </div>

      {/* Result header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink" aria-live="polite">{t("search.results", { count: total })}</p>
          {chips.length > 0 && <p className="text-[12.5px] text-muted">{chips.map((c) => c.label).join(" · ")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PhotoSearchButton />
          <SaveSearchButton filters={filters} />
          <div className="w-44">
            <Select value={filters.sort ?? "relevance"} onChange={(e) => apply({ ...filters, sort: e.target.value as SortOption })} aria-label={t("search.sort.label")} className="h-9 rounded-full text-[13px]">
              {SORT_OPTIONS.map((s) => <option key={s} value={s}>{t(`search.sort.${s}`)}</option>)}
            </Select>
          </div>
          <ButtonLink href={`/map?${filtersToSearchParams(filters).toString()}`} variant="outline" size="sm">
            <MapIcon className="size-4" /> {t("search.view.map")}
          </ButtonLink>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 && !pending ? (
        <EmptyState icon={<Search className="size-5" />} title={t("search.noResults")} text={t("search.noResultsHint")}
          action={<Button variant="secondary" onClick={() => apply({ listing_type: filters.listing_type })}>{t("filters.reset")}</Button>} />
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${pending ? "opacity-60 transition" : ""}`}>
          {items.map((p, i) => <PropertyCard key={p.id} p={p} priority={i < 3} />)}
          {loadingMore && Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={`s${i}`} />)}
        </div>
      )}
      <div ref={sentinel} aria-hidden className="h-4" />
      {hasMore && !loadingMore && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()}>{t("search.loadMore")}</Button>
        </div>
      )}

      <FiltersSheet open={sheet} onClose={() => setSheet(false)} value={filters} onApply={apply} />
    </div>
  );
}
