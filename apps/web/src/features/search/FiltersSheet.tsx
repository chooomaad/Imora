"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CITIES, NOUAKCHOTT_DISTRICTS, PROPERTY_TYPES, placeName, type Locale, type PropertyFilters, type PropertyType } from "@imora/shared";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Chip, Input, Segmented, Select, Switch } from "@/components/ui/primitives";
import { Icon3D, Icon360 } from "@/components/icons";
import { useLiveCount } from "./useLiveCount";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line py-5 last:border-0">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

function NumberPair({ min, max, onMin, onMax, labels }: { min?: number; max?: number; onMin: (v?: number) => void; onMax: (v?: number) => void; labels: [string, string] }) {
  const parse = (v: string) => (v === "" ? undefined : Math.max(0, Number(v.replace(/\D/g, ""))));
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input inputMode="numeric" placeholder={labels[0]} value={min ?? ""} onChange={(e) => onMin(parse(e.target.value))} aria-label={labels[0]} />
      <Input inputMode="numeric" placeholder={labels[1]} value={max ?? ""} onChange={(e) => onMax(parse(e.target.value))} aria-label={labels[1]} />
    </div>
  );
}

/** Full filter editor shared by Explorer and Map. Shows a live result count. */
export function FiltersSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: PropertyFilters; onApply: (f: PropertyFilters) => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [draft, setDraft] = useState<PropertyFilters>(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const count = useLiveCount(open ? draft : {}, null);

  const set = <K extends keyof PropertyFilters>(k: K, v: PropertyFilters[K]) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      if (v === undefined || v === false || v === "") delete next[k];
      return next;
    });

  const toggleType = (ty: PropertyType) => {
    const cur = new Set(draft.property_types ?? []);
    if (cur.has(ty)) cur.delete(ty);
    else cur.add(ty);
    set("property_types", cur.size ? [...cur] : undefined);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("filters.title")}
      className="sm:max-w-xl"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setDraft({ sort: draft.sort })}>{t("filters.reset")}</Button>
          <Button className="flex-1" onClick={() => onApply(draft)}>
            {count == null ? t("filters.applyNoCount") : t("filters.apply", { count })}
          </Button>
        </div>
      }
    >
      <Section title={t("filters.listingType")}>
        <Segmented
          value={draft.listing_type ?? "sale"}
          onChange={(v) => set("listing_type", v)}
          options={(["sale", "rent", "investment"] as const).map((v) => ({ value: v, label: t(`search.tabs.${v}`) }))}
        />
      </Section>

      <Section title={t("filters.types")}>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((ty) => (
            <Chip key={ty} active={draft.property_types?.includes(ty)} onClick={() => toggleType(ty)}>{t(`propertyTypes.${ty}`)}</Chip>
          ))}
        </div>
      </Section>

      <Section title={`${t("filters.city")} & ${t("filters.district")}`}>
        <div className="grid grid-cols-2 gap-3">
          <Select value={draft.city ?? ""} onChange={(e) => setDraft((d) => {
            const next = { ...d, city: e.target.value || undefined };
            delete next.district;
            if (!next.city) delete next.city;
            return next;
          })} aria-label={t("filters.city")}>
            <option value="">{t("filters.allCities")}</option>
            {CITIES.map((c) => <option key={c} value={c}>{placeName(c, locale)}</option>)}
          </Select>
          <Select value={draft.district ?? ""} onChange={(e) => set("district", e.target.value || undefined)} disabled={draft.city !== "Nouakchott"} aria-label={t("filters.district")}>
            <option value="">{t("filters.allDistricts")}</option>
            {NOUAKCHOTT_DISTRICTS.map((d) => <option key={d} value={d}>{placeName(d, locale)}</option>)}
          </Select>
        </div>
      </Section>

      <Section title={t("filters.price")}>
        <NumberPair min={draft.price_min} max={draft.price_max} onMin={(v) => set("price_min", v)} onMax={(v) => set("price_max", v)} labels={[t("filters.min"), t("filters.max")]} />
      </Section>

      <Section title={t("filters.area")}>
        <NumberPair min={draft.area_min} max={draft.area_max} onMin={(v) => set("area_min", v)} onMax={(v) => set("area_max", v)} labels={[t("filters.min"), t("filters.max")]} />
      </Section>

      <Section title={t("filters.bedrooms")}>
        <div className="flex flex-wrap gap-2">
          <Chip active={!draft.bedrooms_min} onClick={() => set("bedrooms_min", undefined)}>{t("filters.any")}</Chip>
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} active={draft.bedrooms_min === n} onClick={() => set("bedrooms_min", n)}>{n}+</Chip>
          ))}
        </div>
      </Section>

      <Section title={t("filters.bathrooms")}>
        <div className="flex flex-wrap gap-2">
          <Chip active={!draft.bathrooms_min} onClick={() => set("bathrooms_min", undefined)}>{t("filters.any")}</Chip>
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} active={draft.bathrooms_min === n} onClick={() => set("bathrooms_min", n)}>{n}+</Chip>
          ))}
        </div>
      </Section>

      <Section title={t("filters.amenities")}>
        <Switch id="f-parking" label={t("filters.parking")} checked={!!draft.parking} onChange={(v) => set("parking", v || undefined)} />
        <Switch id="f-pool" label={t("filters.pool")} checked={!!draft.pool} onChange={(v) => set("pool", v || undefined)} />
        <Switch id="f-garden" label={t("filters.garden")} checked={!!draft.garden} onChange={(v) => set("garden", v || undefined)} />
        <Switch id="f-furnished" label={t("filters.furnished")} checked={!!draft.furnished} onChange={(v) => set("furnished", v || undefined)} />
      </Section>

      <Section title={t("filters.experience")}>
        <div className="flex flex-wrap gap-2">
          <Chip active={!!draft.has_3d} onClick={() => set("has_3d", draft.has_3d ? undefined : true)}><Icon3D size={16} />{t("filters.has_3d")}</Chip>
          <Chip active={!!draft.has_360} onClick={() => set("has_360", draft.has_360 ? undefined : true)}><Icon360 size={16} />{t("filters.has_360")}</Chip>
          <Chip active={!!draft.verified} onClick={() => set("verified", draft.verified ? undefined : true)}>{t("filters.verified")}</Chip>
        </div>
      </Section>
    </Dialog>
  );
}
