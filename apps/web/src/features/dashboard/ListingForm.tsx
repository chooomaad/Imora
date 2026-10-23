"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Check, ImagePlus, Loader2, Sparkles, Star, Trash2, X } from "lucide-react";
import {
  CITIES, LISTING_TYPES, NOUAKCHOTT_DISTRICTS, PRICE_PERIODS, PROPERTY_TYPES, placeName, slugify,
  type ListingType, type Locale, type PricePeriod, type PropertyType,
} from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { analyzeListingPhotos, type VisionSuggestion } from "@/services/ai";
import { LocationPicker } from "./LocationPicker";

export interface ListingDraft {
  id?: string;
  title: string;
  title_ar: string;
  description: string;
  listing_type: ListingType;
  property_type: PropertyType;
  price: string;
  price_period: PricePeriod;
  price_negotiable: boolean;
  city: string;
  district: string;
  address: string;
  bedrooms: string;
  bathrooms: string;
  area_m2: string;
  land_area_m2: string;
  parking_spaces: string;
  has_pool: boolean;
  has_garden: boolean;
  has_generator: boolean;
  furnished: boolean;
  water_tank_liters: string;
  estimated_yield: string;
  status?: string;
  location: [number, number] | null;
  is_approximate: boolean;
}

export const EMPTY_DRAFT: ListingDraft = {
  title: "", title_ar: "", description: "", listing_type: "sale", property_type: "villa", price: "", price_period: "total",
  price_negotiable: false, city: "Nouakchott", district: "", address: "", bedrooms: "", bathrooms: "", area_m2: "",
  land_area_m2: "", parking_spaces: "0", has_pool: false, has_garden: false, has_generator: false, furnished: false,
  water_tank_liters: "", estimated_yield: "", location: null, is_approximate: true,
};

interface Photo { id: string; url: string; is_cover: boolean; position: number; storage_path: string | null }

const STEPS = ["basics", "details", "location", "media", "review"] as const;
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/** Downscale photos before upload (bandwidth in Mauritania, storage cost). */
async function compress(file: File, maxSide = 2400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/webp", 0.85));
}

export function ListingForm({ initial, photos: initialPhotos, agencyId, agentId }: { initial: ListingDraft; photos: Photo[]; agencyId: string | null; agentId: string | null }) {
  const t = useTranslations();
  const tf = useTranslations("listingForm");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [d, setD] = useState<ListingDraft>(initial);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(0);
  const [suggestions, setSuggestions] = useState<VisionSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!d.id) return;
    supabase.from("ai_suggestions").select("id, kind, suggestion, status").eq("property_id", d.id).eq("status", "pending")
      .then(({ data }) => setSuggestions((data ?? []) as VisionSuggestion[]));
  }, [d.id, supabase]);

  /** Insert or update the row; returns the id. Status changes are moderated by the DB trigger. */
  const save = async (status?: "draft" | "published"): Promise<string | null> => {
    if (!d.title.trim() || !num(d.price)) {
      toast(t("common.error"), "error");
      setStep(0);
      return null;
    }
    setSaving(true);
    const row = {
      title: d.title.trim(), title_ar: d.title_ar.trim() || null, description: d.description.trim() || null,
      listing_type: d.listing_type, property_type: d.property_type, price: Math.round(num(d.price)!),
      price_period: d.listing_type === "rent" ? (d.price_period === "total" ? "month" : d.price_period) : "total",
      price_negotiable: d.price_negotiable, city: d.city, district: d.city === "Nouakchott" ? d.district || null : null,
      address: d.address.trim() || null, bedrooms: num(d.bedrooms), bathrooms: num(d.bathrooms), area_m2: num(d.area_m2),
      land_area_m2: num(d.land_area_m2), parking_spaces: num(d.parking_spaces) ?? 0, has_pool: d.has_pool, has_garden: d.has_garden,
      has_generator: d.has_generator, furnished: d.furnished, water_tank_liters: num(d.water_tank_liters),
      estimated_yield: num(d.estimated_yield),
      ...(status ? { status } : {}),
    };
    let id = d.id;
    if (!id) {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("properties")
        .insert({ ...row, slug: `${slugify(d.title)}-${crypto.randomUUID().slice(0, 6)}`, owner_id: auth.user!.id, agency_id: agencyId, agent_id: agentId, status: status ?? "draft" })
        .select("id, status")
        .single();
      if (error) {
        setSaving(false);
        toast(t("common.error"), "error");
        return null;
      }
      id = data.id as string;
      setD((x) => ({ ...x, id, status: data.status }));
    } else {
      const { data, error } = await supabase.from("properties").update(row).eq("id", id).select("status").single();
      if (error) {
        setSaving(false);
        toast(t("common.error"), "error");
        return null;
      }
      setD((x) => ({ ...x, status: data.status }));
    }
    if (d.location) {
      await supabase.rpc("set_property_location", { p_property_id: id, p_lng: d.location[0], p_lat: d.location[1], p_is_approximate: d.is_approximate });
    }
    setSaving(false);
    return id ?? null;
  };

  const next = async () => {
    // Persist at every step: photos need an existing row (storage path = property id)
    if (!(await save())) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const upload = async (files: FileList | null) => {
    const id = d.id ?? (await save());
    if (!id || !files?.length) return;
    setUploading(files.length);
    for (const file of Array.from(files)) {
      try {
        const blob = await compress(file);
        const path = `${id}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("property-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw error;
        const url = supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;
        const isCover = photos.length === 0;
        const { data, error: e2 } = await supabase
          .from("property_media")
          .insert({ property_id: id, kind: "image", url, storage_bucket: "property-images", storage_path: path, position: photos.length, is_cover: isCover })
          .select("id, url, is_cover, position, storage_path")
          .single();
        if (e2) throw e2;
        setPhotos((p) => [...p, data as Photo]);
      } catch {
        toast(t("common.error"), "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removePhoto = async (p: Photo) => {
    await supabase.from("property_media").delete().eq("id", p.id);
    if (p.storage_path) await supabase.storage.from("property-images").remove([p.storage_path]);
    setPhotos((ps) => ps.filter((x) => x.id !== p.id));
  };

  const setCover = async (p: Photo) => {
    await supabase.from("property_media").update({ is_cover: false }).eq("property_id", d.id!).eq("is_cover", true);
    await supabase.from("property_media").update({ is_cover: true }).eq("id", p.id);
    setPhotos((ps) => ps.map((x) => ({ ...x, is_cover: x.id === p.id })));
  };

  const runAi = async () => {
    if (!d.id) return;
    setAiLoading(true);
    try {
      const res = await analyzeListingPhotos(d.id, locale);
      setSuggestions(res.suggestions);
    } catch {
      toast(t("ai.unavailable"), "error");
    } finally {
      setAiLoading(false);
    }
  };

  /** The owner stays in control: nothing from the AI is applied without an explicit action. */
  const reviewSuggestion = async (s: VisionSuggestion, decision: "accepted" | "rejected" | "edited", finalValue?: string) => {
    if (decision !== "rejected" && s.kind === "description") {
      set("description", finalValue ?? String(s.suggestion.text ?? ""));
    }
    if (decision !== "rejected" && s.kind === "features") {
      const f = s.suggestion as { has_pool?: boolean; has_garden?: boolean; parking?: boolean; furnished?: boolean };
      setD((x) => ({
        ...x,
        has_pool: f.has_pool ?? x.has_pool,
        has_garden: f.has_garden ?? x.has_garden,
        furnished: f.furnished ?? x.furnished,
        parking_spaces: f.parking && x.parking_spaces === "0" ? "1" : x.parking_spaces,
      }));
    }
    await supabase.from("ai_suggestions").update({ status: decision, final_value: finalValue ? { text: finalValue } : null, reviewed_at: new Date().toISOString() }).eq("id", s.id);
    setSuggestions((xs) => xs.filter((x) => x.id !== s.id));
  };

  const submit = async (status: "draft" | "published") => {
    const id = await save(status);
    if (!id) return;
    toast(status === "published" ? tf("submitted") : tf("saved"));
    router.push("/dashboard/listings");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <ol className="flex gap-2 overflow-x-auto scrollbar-none">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => (d.id || i === 0) && setStep(i)}
              className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold",
                i === step ? "bg-ink text-on-ink" : i < step ? "bg-gold-soft text-gold" : "bg-surface-2 text-muted")}>
              <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[11px]">{i < step ? <Check className="size-3" /> : i + 1}</span>
              {tf(`steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <Card className="space-y-5 p-5 sm:p-6">
        {step === 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf("fields.listingType")}>
                <Select value={d.listing_type} onChange={(e) => set("listing_type", e.target.value as ListingType)}>
                  {LISTING_TYPES.map((l) => <option key={l} value={l}>{t(`listingTypes.${l}`)}</option>)}
                </Select>
              </Field>
              <Field label={tf("fields.propertyType")}>
                <Select value={d.property_type} onChange={(e) => set("property_type", e.target.value as PropertyType)}>
                  {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{t(`propertyTypes.${p}`)}</option>)}
                </Select>
              </Field>
            </div>
            <Field label={tf("fields.title")}><Input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required /></Field>
            <Field label={tf("fields.titleAr")}><Input dir="rtl" value={d.title_ar} onChange={(e) => set("title_ar", e.target.value)} maxLength={120} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tf("fields.price")}><Input inputMode="numeric" value={d.price} onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))} required /></Field>
              {d.listing_type === "rent" && (
                <Field label={tf("fields.pricePeriod")}>
                  <Select value={d.price_period} onChange={(e) => set("price_period", e.target.value as PricePeriod)}>
                    {PRICE_PERIODS.filter((p) => p !== "total").map((p) => <option key={p} value={p}>{tf(`periods.${p}`)}</option>)}
                  </Select>
                </Field>
              )}
              <div className="flex items-end"><Switch id="neg" label={tf("fields.negotiable")} checked={d.price_negotiable} onChange={(v) => set("price_negotiable", v)} /></div>
            </div>
            <Field label={tf("fields.description")}><Textarea rows={6} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} /></Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={tf("fields.bedrooms")}><Input inputMode="numeric" value={d.bedrooms} onChange={(e) => set("bedrooms", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label={tf("fields.bathrooms")}><Input inputMode="numeric" value={d.bathrooms} onChange={(e) => set("bathrooms", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label={tf("fields.parking")}><Input inputMode="numeric" value={d.parking_spaces} onChange={(e) => set("parking_spaces", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label={tf("fields.area")}><Input inputMode="decimal" value={d.area_m2} onChange={(e) => set("area_m2", e.target.value)} /></Field>
              <Field label={tf("fields.landArea")}><Input inputMode="decimal" value={d.land_area_m2} onChange={(e) => set("land_area_m2", e.target.value)} /></Field>
              <Field label={tf("fields.waterTank")}><Input inputMode="numeric" value={d.water_tank_liters} onChange={(e) => set("water_tank_liters", e.target.value.replace(/\D/g, ""))} /></Field>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Switch id="pool" label={tf("fields.pool")} checked={d.has_pool} onChange={(v) => set("has_pool", v)} />
              <Switch id="garden" label={tf("fields.garden")} checked={d.has_garden} onChange={(v) => set("has_garden", v)} />
              <Switch id="gen" label={tf("fields.generator")} checked={d.has_generator} onChange={(v) => set("has_generator", v)} />
              <Switch id="furn" label={tf("fields.furnished")} checked={d.furnished} onChange={(v) => set("furnished", v)} />
            </div>
            {d.listing_type !== "rent" && (
              <Field label={tf("fields.yield")} hint={t("invest.disclaimer")}>
                <Input inputMode="decimal" value={d.estimated_yield} onChange={(e) => set("estimated_yield", e.target.value)} />
              </Field>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tf("fields.city")}>
                <Select value={d.city} onChange={(e) => set("city", e.target.value)}>
                  {CITIES.map((c) => <option key={c} value={c}>{placeName(c, locale)}</option>)}
                </Select>
              </Field>
              <Field label={tf("fields.district")}>
                <Select value={d.district} onChange={(e) => set("district", e.target.value)} disabled={d.city !== "Nouakchott"}>
                  <option value="">—</option>
                  {NOUAKCHOTT_DISTRICTS.map((x) => <option key={x} value={x}>{placeName(x, locale)}</option>)}
                </Select>
              </Field>
              <Field label={tf("fields.address")}><Input value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
            </div>
            <p className="text-sm text-muted">{tf("fields.pickOnMap")}</p>
            <LocationPicker value={d.location} onChange={(v) => set("location", v)} />
            <Switch id="approx" label={tf("fields.approximate")} checked={d.is_approximate} onChange={(v) => set("is_approximate", v)} />
          </>
        )}

        {step === 3 && (
          <>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                  <Image src={p.url} alt="" fill sizes="200px" className="object-cover" />
                  {p.is_cover && <span className="absolute start-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-white">{tf("cover")}</span>}
                  <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 transition group-hover:opacity-100">
                    {!p.is_cover && <button type="button" onClick={() => void setCover(p)} className="grid size-8 place-items-center rounded-full bg-white/90 text-ink" aria-label={tf("setCover")}><Star className="size-4" /></button>}
                    <button type="button" onClick={() => void removePhoto(p)} className="ms-auto grid size-8 place-items-center rounded-full bg-white/90 text-danger" aria-label={t("common.delete")}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-muted hover:border-gold-bright">
                {uploading > 0 ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6 text-gold" />}
                {tf("addPhotos")}
              </button>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-gold-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-gold" />{tf("aiSuggest")}</p>
                <Button size="sm" variant="gold" onClick={runAi} loading={aiLoading} disabled={photos.length === 0}>{aiLoading ? tf("aiGenerating") : tf("aiSuggest")}</Button>
              </div>
              <p className="mt-1 text-[13px] text-muted">{tf("aiSuggestHint")}</p>
              {suggestions.map((s) => <SuggestionCard key={s.id} s={s} onReview={reviewSuggestion} />)}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="space-y-3 text-[14.5px]">
            <p className="text-[20px] font-semibold">{d.title}</p>
            <p className="text-muted">{t(`listingTypes.${d.listing_type}`)} · {t(`propertyTypes.${d.property_type}`)} · <span className="ltr-nums">{d.price} MRU</span></p>
            <p className="text-muted">{[d.district, d.city].filter(Boolean).join(", ")} · {photos.length} 📷</p>
            {d.status && <p className="text-[13px]">{t(`dashboard.status.${d.status}` as never)}</p>}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{t("common.previous")}</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => submit("draft")} loading={saving}>{tf("saveDraft")}</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} loading={saving}>{t("common.next")}</Button>
          ) : (
            <Button variant="gold" onClick={() => submit("published")} loading={saving}>{tf("submit")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ s, onReview }: { s: VisionSuggestion; onReview: (s: VisionSuggestion, d: "accepted" | "rejected" | "edited", v?: string) => void }) {
  const tf = useTranslations("listingForm");
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(s.suggestion.text ?? ""));
  const features = s.kind === "features" ? (s.suggestion as Record<string, boolean>) : null;
  const rooms = s.kind === "room_detection" ? (s.suggestion.rooms as string[] | undefined) : null;

  return (
    <div className="mt-3 rounded-xl bg-surface p-3.5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-gold">{s.kind}</p>
      {s.kind === "description" && (editing ? <Textarea className="mt-2" rows={5} value={text} onChange={(e) => setText(e.target.value)} /> : <p className="mt-1 text-[14px] text-ink-2">{text}</p>)}
      {features && <p className="mt-1 text-[14px]">{Object.entries(features).filter(([, v]) => v === true).map(([k]) => t.has(`filters.${k}` as never) ? t(`filters.${k}` as never) : k).join(" · ") || "—"}</p>}
      {rooms && <p className="mt-1 text-[14px]">{rooms.join(" · ")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onReview(s, editing ? "edited" : "accepted", s.kind === "description" ? text : undefined)}><Check className="size-3.5" />{tf("aiAccept")}</Button>
        {s.kind === "description" && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{tf("aiEdit")}</Button>}
        <Button size="sm" variant="ghost" onClick={() => onReview(s, "rejected")}><X className="size-3.5" />{tf("aiReject")}</Button>
      </div>
    </div>
  );
}
