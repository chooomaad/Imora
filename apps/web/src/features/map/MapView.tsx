"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Compass, Layers, LocateFixed, Minus, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { countActiveFilters, filtersToSearchParams, type MapMarker, type PropertyCard, type PropertyFilters } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { Icon3D } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { PropertyCardCompact } from "@/features/properties/PropertyCard";
import { FiltersSheet } from "@/features/search/FiltersSheet";
import { PropertyMap, type PropertyMapHandle } from "./PropertyMap";

function CtrlButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("grid size-12 place-items-center rounded-full bg-surface text-ink shadow-lift transition hover:bg-surface-2 active:scale-95", className)}>
      {children}
    </button>
  );
}

export function MapView({ filters }: { filters: PropertyFilters }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const mapRef = useRef<PropertyMapHandle>(null);
  const [selected, setSelected] = useState<PropertyCard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [searchToken, setSearchToken] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");

  const apply = useCallback((next: PropertyFilters) => {
    setSheet(false);
    setSelectedId(null);
    router.replace(`/map?${filtersToSearchParams(next).toString()}`, { scroll: false });
  }, [router]);

  // Load the card for the selected marker
  useEffect(() => {
    if (!selectedId) return setSelected(null);
    let cancelled = false;
    getSupabaseBrowser()
      .rpc("search_properties", { p_filters: {}, p_limit: 1, p_offset: 0, p_ids: [selectedId] })
      .then(({ data }) => {
        if (!cancelled) setSelected(((data ?? []) as PropertyCard[])[0] ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const onLoaded = useCallback((markers: MapMarker[]) => {
    setCount(markers.length);
    setMoved(false);
  }, []);
  const onMoved = useCallback(() => setMoved(true), []);
  const [stableLabels] = useState(() => ({ perMonth: t("common.perMonth").replace("/ ", "/"), land: t("map.terrain") }));

  const toggle = (k: "has_3d") => apply({ ...filters, [k]: filters[k] ? undefined : true });
  const tab = (lt: "sale" | "rent" | "investment") => apply({ ...filters, listing_type: filters.listing_type === lt ? undefined : lt });
  const active = countActiveFilters(filters);

  return (
    <div className="relative h-[calc(100dvh-4rem-68px)] overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <PropertyMap
        ref={mapRef}
        filters={filters}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMoved={onMoved}
        onLoaded={onLoaded}
        searchToken={searchToken}
        labels={stableLabels}
      />

      {/* Top overlay: search + chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-3 bg-gradient-to-b from-bg via-bg/85 to-transparent px-4 pt-3 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply({ ...filters, q: q.trim() || undefined });
          }}
          className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-surface p-1.5 ps-4 shadow-lift"
        >
          <Search className="size-5 shrink-0 text-gold" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle" />
          {q && (
            <button type="button" onClick={() => { setQ(""); apply({ ...filters, q: undefined }); }} className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted" aria-label={t("search.clear")}>
              <X className="size-4" />
            </button>
          )}
          <Button type="submit" className="rounded-full"><SlidersHorizontal className="size-4" />{t("search.filter")}</Button>
        </form>
        <div className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:justify-center">
          <Chip onClick={() => setSheet(true)} className="bg-surface-2">
            <SlidersHorizontal className="size-4" />{t("map.filters")}
            {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-gold-bright text-[11px] text-ink">{active}</span>}
          </Chip>
          <Chip active={!!filters.has_3d} onClick={() => toggle("has_3d")} className={filters.has_3d ? "!bg-gold !text-white" : ""}>
            <Icon3D size={16} />{filters.has_3d ? `✓ ${t("map.only3d")}` : t("map.only3d")}
          </Chip>
          <Chip active={filters.listing_type === "sale"} onClick={() => tab("sale")}>{t("map.buy")}</Chip>
          <Chip active={filters.listing_type === "rent"} onClick={() => tab("rent")}>{t("map.rent")}</Chip>
          <Chip active={filters.listing_type === "investment"} onClick={() => tab("investment")}>{t("map.invest")}</Chip>
        </div>
        <div className="flex justify-center">
          {moved ? (
            <button type="button" onClick={() => setSearchToken((n) => n + 1)}
              className="pointer-events-auto flex animate-fade-up items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-[13.5px] font-semibold text-ink shadow-lift">
              <RefreshCw className="size-4 text-gold" /> {t("search.searchThisArea")}
            </button>
          ) : count != null ? (
            <span className="pointer-events-auto rounded-full bg-surface/90 px-4 py-1.5 text-[12.5px] font-semibold text-muted shadow-soft" aria-live="polite">
              {t("map.inArea", { count })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Right controls */}
      <div className="absolute end-4 top-44 z-10 flex flex-col gap-3">
        <CtrlButton label={t("map.north")} onClick={() => mapRef.current?.resetNorth()}><Compass className="size-6 text-gold-bright" /></CtrlButton>
        <CtrlButton label={t("map.locate")} onClick={async () => { if (!(await mapRef.current?.locate())) toast(t("map.locationDenied"), "error"); }}>
          <LocateFixed className="size-6" />
        </CtrlButton>
        <CtrlButton label={t("map.layers")} onClick={() => mapRef.current?.toggleStyle()}><Layers className="size-6" /></CtrlButton>
        <div className="overflow-hidden rounded-full bg-surface shadow-lift">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t("map.zoomIn")} className="grid h-14 w-12 place-items-center hover:bg-surface-2"><Plus className="size-6" /></button>
          <div className="mx-3 h-px bg-line" />
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t("map.zoomOut")} className="grid h-14 w-12 place-items-center hover:bg-surface-2"><Minus className="size-6" /></button>
        </div>
      </div>

      {/* Bottom sheet */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 animate-sheet-up px-3 pb-3 lg:inset-x-auto lg:start-4 lg:bottom-4 lg:w-[460px]">
          <div className="rounded-[26px] bg-surface/95 p-2 pt-3 shadow-lift backdrop-blur">
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-line" />
            <PropertyCardCompact p={selected} className="border-0 shadow-none" />
            <div className="grid grid-cols-2 gap-2 p-1.5">
              <ButtonLink href={`/property/${selected.slug}#visit`} variant="secondary" className="h-11">
                <CalendarDays className="size-4" />{t("property.planVisit")}
              </ButtonLink>
              <ButtonLink href={selected.has_360 ? `/property/${selected.slug}/tour` : `/property/${selected.slug}`} className="h-11">
                {selected.has_360 ? <><Icon3D size={16} className="text-gold-bright" />{t("property.launch3d")}</> : t("property.viewProperty")}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}

      <FiltersSheet open={sheet} onClose={() => setSheet(false)} value={filters} onApply={apply} />
    </div>
  );
}
