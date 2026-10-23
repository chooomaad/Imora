"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Crosshair, ImagePlus, LayoutGrid, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { FloorPlan, Room, Scene, Tour } from "@imora/shared";
import { TOUR_SELECT, normalizeTour } from "./tourQuery";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { PanoramaEngine } from "./engine/PanoramaEngine";
import { FloorPlan2D } from "./FloorPlan2D";
import { TourExperience } from "./TourExperience";

const STEPS = ["photos", "rooms", "assign", "hotspots", "plan", "measures", "preview", "publish"] as const;
const ROOM_TYPES = ["living", "kitchen", "dining", "bedroom", "bathroom", "garage", "patio", "pool", "terrace", "office", "other"];
const ICON_FOR_TYPE: Record<string, string> = { living: "living", kitchen: "kitchen", dining: "dining", bedroom: "bedroom", bathroom: "bath", garage: "garage", patio: "pool", pool: "pool", terrace: "stairs" };

/** Validate the 2:1 ratio of equirectangular panoramas before upload. */
async function isEquirect(file: File) {
  const bmp = await createImageBitmap(file);
  const ratio = bmp.width / bmp.height;
  bmp.close();
  return ratio > 1.9 && ratio < 2.1;
}

export function TourBuilder({ propertyId, propertyTitle, tourId }: { propertyId: string; propertyTitle: string; tourId: string | null }) {
  const t = useTranslations("tourBuilder");
  const tc = useTranslations("common");
  const toast = useToast();
  const supabase = getSupabaseBrowser();
  const [step, setStep] = useState(0);
  const [tour, setTour] = useState<Tour | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  /** Reload the whole graph after a mutation (simple and always consistent with RLS). */
  const reload = useCallback(async (id: string) => {
    const { data } = await supabase.from("property_3d_tours").select(TOUR_SELECT).eq("id", id).single();
    if (data) setTour(normalizeTour(data));
  }, [supabase]);

  useEffect(() => {
    if (tourId) void reload(tourId);
  }, [tourId, reload]);

  const ensureTour = async (): Promise<string> => {
    if (tour) return tour.id;
    const { data, error } = await supabase.from("property_3d_tours").insert({ property_id: propertyId, title: "Visite 360°" }).select("id").single();
    if (error) throw error;
    await reload(data.id);
    return data.id as string;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------- Step 1 */
  const uploadPanoramas = (files: FileList | null) => run(async () => {
    if (!files?.length) return;
    const tourId = await ensureTour();
    let position = tour?.scenes.length ?? 0;
    for (const file of Array.from(files)) {
      if (!(await isEquirect(file))) {
        toast(`${file.name}: ratio 2:1`, "error");
        continue;
      }
      const path = `${propertyId}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from("property-360").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) throw error;
      const url = supabase.storage.from("property-360").getPublicUrl(path).data.publicUrl;
      await supabase.from("property_360_scenes").insert({ tour_id: tourId, name: file.name.replace(/\.[^.]+$/, "").slice(0, 60), panorama_url: url, position: position++ });
    }
    await reload(tourId);
  });

  const uploadModel = (file: File | undefined) => run(async () => {
    if (!file) return;
    const tourId = await ensureTour();
    const path = `${propertyId}/${crypto.randomUUID()}.glb`;
    const { error } = await supabase.storage.from("property-3d").upload(path, file, { contentType: "model/gltf-binary" });
    if (error) throw error;
    const url = supabase.storage.from("property-3d").getPublicUrl(path).data.publicUrl;
    await supabase.from("property_3d_tours").update({ model_url: url, source: "photogrammetry" }).eq("id", tourId);
    await reload(tourId);
  });

  /* ---------------------------------------------------------- Step 2 */
  const addFloor = () => run(async () => {
    const tourId = await ensureTour();
    const level = tour?.floor_plans.length ?? 0;
    await supabase.from("property_floor_plans").insert({ tour_id: tourId, level, name: level === 0 ? "Rez-de-chaussée" : `Étage ${level}`, scale_label: "1:100", width_m: 20, depth_m: 12 });
    await reload(tourId);
  });

  const addRoom = (floorId: string) => run(async () => {
    const tourId = await ensureTour();
    const pos = tour?.rooms.filter((r) => r.floor_plan_id === floorId).length ?? 0;
    await supabase.from("property_rooms").insert({ tour_id: tourId, floor_plan_id: floorId, name: "Nouvelle pièce", room_type: "living", position: pos });
    await reload(tourId);
  });

  const updateRoom = async (id: string, patch: Partial<Room>) => {
    setTour((tr) => tr && { ...tr, rooms: tr.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    await supabase.from("property_rooms").update(patch).eq("id", id);
  };
  const updateFloor = async (id: string, patch: Partial<FloorPlan>) => {
    setTour((tr) => tr && { ...tr, floor_plans: tr.floor_plans.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    await supabase.from("property_floor_plans").update(patch).eq("id", id);
  };
  const updateScene = async (id: string, patch: Partial<Scene>) => {
    setTour((tr) => tr && { ...tr, scenes: tr.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    await supabase.from("property_360_scenes").update(patch).eq("id", id);
  };
  const removeRow = (table: string, id: string) => run(async () => {
    await supabase.from(table).delete().eq("id", id);
    if (tour) await reload(tour.id);
  });

  /** Simple grid packing so a plan exists even before the owner refines it. */
  const autoLayout = (floor: FloorPlan) => run(async () => {
    const rooms = tour!.rooms.filter((r) => r.floor_plan_id === floor.id);
    const cols = Math.ceil(Math.sqrt(rooms.length));
    const rows = Math.ceil(rooms.length / cols);
    await Promise.all(rooms.map((r, i) => updateRoom(r.id, { plan_rect: [(i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows] })));
  });

  /* ---------------------------------------------------------- Step 4: hotspots */
  const [hsScene, setHsScene] = useState<string | null>(null);
  const [hsTarget, setHsTarget] = useState<string>("");
  const panoHost = useRef<HTMLDivElement>(null);
  const engine = useRef<PanoramaEngine | null>(null);
  const currentHsScene = tour?.scenes.find((s) => s.id === hsScene) ?? tour?.scenes[0];

  useEffect(() => {
    if (STEPS[step] !== "hotspots" || !panoHost.current || !currentHsScene) return;
    const e = new PanoramaEngine(panoHost.current);
    engine.current = e;
    void e.loadScene(currentHsScene.panorama_url, { yaw: currentHsScene.initial_yaw, pitch: 0 }, false);
    return () => {
      e.dispose();
      engine.current = null;
    };
    // Only re-create the viewer when the scene itself changes, not on hotspot edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentHsScene?.id, currentHsScene?.panorama_url, currentHsScene?.initial_yaw]);

  const downPos = useRef({ x: 0, y: 0 });
  const placeHotspot = (e: React.PointerEvent) => {
    if (!engine.current || !currentHsScene || !hsTarget) return;
    if (Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y) > 6) return; // drag, not click
    const { yaw, pitch } = engine.current.pick(e.clientX, e.clientY);
    const target = tour!.scenes.find((s) => s.id === hsTarget)!;
    const room = target.room_id ? tour!.rooms.find((r) => r.id === target.room_id) : null;
    void run(async () => {
      await supabase.from("property_hotspots").insert({
        scene_id: currentHsScene.id, kind: "navigation", target_scene_id: target.id, yaw, pitch,
        label: room?.name ?? target.name, label_ar: room?.name_ar ?? null, icon: ICON_FOR_TYPE[room?.room_type ?? ""] ?? null,
      });
      await reload(tour!.id);
    });
  };

  /* ---------------------------------------------------------- Step 8 */
  const publish = () => run(async () => {
    await supabase.from("property_3d_tours").update({ status: "published", start_scene_id: tour!.start_scene_id ?? tour!.scenes[0]?.id ?? null }).eq("id", tour!.id);
    await reload(tour!.id);
    toast(t("published"));
  });
  const requestVerification = () => run(async () => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("verifications").insert({ subject_type: "tour", subject_id: tour!.id, requested_by: auth.user!.id });
    toast(`${t("requestVerification")} ✓`);
  });

  const roomOptions = useMemo(() => tour?.rooms ?? [], [tour?.rooms]);
  const roomsWithScene = useMemo(() => new Set((tour?.scenes ?? []).map((s) => s.room_id).filter(Boolean) as string[]), [tour?.scenes]);

  return (
    <div className="space-y-5">
      <ol className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)}
              className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold", i === step ? "bg-ink text-on-ink" : i < step ? "bg-gold-soft text-gold" : "bg-surface-2 text-muted")}>
              <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[11px]">{i < step ? <Check className="size-3" /> : i + 1}</span>
              {t(`steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <Card className="space-y-4 p-5">
        {STEPS[step] === "photos" && (
          <>
            <p className="text-sm text-muted">{t("uploadHint")}</p>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void uploadPanoramas(e.target.files)} />
            <input ref={modelInput} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => void uploadModel(e.target.files?.[0])} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tour?.scenes.map((s) => (
                <div key={s.id} className="group relative aspect-[2/1] overflow-hidden rounded-xl bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.panorama_url} alt={s.name} className="size-full object-cover" loading="lazy" />
                  <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/60 px-1.5 text-[11px] text-white">{s.name}</span>
                  <button type="button" onClick={() => removeRow("property_360_scenes", s.id)} className="absolute end-1 top-1 hidden size-7 place-items-center rounded-full bg-white/90 text-danger group-hover:grid" aria-label={tc("delete")}><Trash2 className="size-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-[2/1] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line text-[13px] font-semibold text-muted hover:border-gold-bright">
                {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5 text-gold" />} 360°
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3 text-[13px]">
              <span className="flex-1 text-muted">glTF / GLB — photogrammétrie, LiDAR, reconstruction</span>
              {tour?.model_url && <Badge variant="green">GLB ✓</Badge>}
              <Button size="sm" variant="outline" onClick={() => modelInput.current?.click()}><Upload className="size-4" /> GLB</Button>
            </div>
          </>
        )}

        {STEPS[step] === "rooms" && (
          <>
            {tour?.floor_plans.map((f) => (
              <div key={f.id} className="space-y-3 rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={t("floor")} className="flex-1"><Input defaultValue={f.name} onBlur={(e) => void updateFloor(f.id, { name: e.target.value })} /></Field>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => removeRow("property_floor_plans", f.id)}><Trash2 className="size-4" /></Button>
                </div>
                {tour.rooms.filter((r) => r.floor_plan_id === f.id).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-end gap-2">
                    <Field label={t("roomName")} className="min-w-40 flex-1"><Input defaultValue={r.name} onBlur={(e) => void updateRoom(r.id, { name: e.target.value })} /></Field>
                    <Field label={t("roomType")} className="w-40">
                      <Select value={r.room_type ?? "other"} onChange={(e) => void updateRoom(r.id, { room_type: e.target.value })}>
                        {ROOM_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </Select>
                    </Field>
                    <Button size="icon" variant="ghost" className="text-danger" onClick={() => removeRow("property_rooms", r.id)} aria-label={tc("delete")}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => addRoom(f.id)}><Plus className="size-4" /> {t("addRoom")}</Button>
              </div>
            ))}
            <Button variant="outline" onClick={addFloor} loading={busy}><Plus className="size-4" /> {t("addFloor")}</Button>
          </>
        )}

        {STEPS[step] === "assign" && (
          <div className="space-y-3">
            {tour?.scenes.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.panorama_url} alt="" className="h-14 w-28 rounded-lg object-cover" loading="lazy" />
                <Input className="w-48" defaultValue={s.name} onBlur={(e) => void updateScene(s.id, { name: e.target.value })} />
                <div className="w-56">
                  <Select value={s.room_id ?? ""} onChange={(e) => void updateScene(s.id, { room_id: e.target.value || null })}>
                    <option value="">—</option>
                    {roomOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="radio" name="start" checked={tour.start_scene_id === s.id}
                    onChange={() => { setTour({ ...tour, start_scene_id: s.id }); void supabase.from("property_3d_tours").update({ start_scene_id: s.id }).eq("id", tour.id); }} />
                  Départ
                </label>
              </div>
            ))}
          </div>
        )}

        {STEPS[step] === "hotspots" && tour && tour.scenes.length > 0 && (
          <>
            <p className="flex items-center gap-2 text-sm text-muted"><Crosshair className="size-4 text-gold" />{t("hotspotHint")}</p>
            <div className="flex flex-wrap gap-3">
              <div className="w-56"><Select value={currentHsScene?.id} onChange={(e) => setHsScene(e.target.value)}>{tour.scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
              <div className="w-56">
                <Select value={hsTarget} onChange={(e) => setHsTarget(e.target.value)}>
                  <option value="">→ …</option>
                  {tour.scenes.filter((s) => s.id !== currentHsScene?.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            </div>
            <div ref={panoHost} className="relative h-[380px] overflow-hidden rounded-2xl bg-black"
              onPointerDown={(e) => (downPos.current = { x: e.clientX, y: e.clientY })} onPointerUp={placeHotspot} />
            <ul className="space-y-1.5">
              {currentHsScene?.hotspots.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  <span>→ {h.label} <span className="text-subtle ltr-nums">({h.yaw}°, {h.pitch}°)</span></span>
                  <button type="button" onClick={() => removeRow("property_hotspots", h.id)} className="text-danger" aria-label={tc("delete")}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          </>
        )}

        {STEPS[step] === "plan" && tour?.floor_plans.map((f) => (
          <div key={f.id} className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <p className="flex-1 font-semibold">{f.name}</p>
              <Field label="L (m)" className="w-24"><Input inputMode="decimal" defaultValue={f.width_m ?? ""} onBlur={(e) => void updateFloor(f.id, { width_m: Number(e.target.value) || null })} /></Field>
              <Field label="l (m)" className="w-24"><Input inputMode="decimal" defaultValue={f.depth_m ?? ""} onBlur={(e) => void updateFloor(f.id, { depth_m: Number(e.target.value) || null })} /></Field>
              <Button size="sm" variant="outline" onClick={() => autoLayout(f)}><LayoutGrid className="size-4" /> Auto</Button>
            </div>
            <p className="text-[13px] text-muted">{t("planHint")}</p>
            {tour.rooms.filter((r) => r.floor_plan_id === f.id).map((r) => {
              const rect = r.plan_rect ?? [0, 0, 0.25, 0.25];
              const W = f.width_m ?? 20, D = f.depth_m ?? 12;
              const toM = (v: number, total: number) => Math.round(v * total * 10) / 10;
              const set = (i: number, meters: number, total: number) => {
                const next = [...rect] as [number, number, number, number];
                next[i] = Math.max(0, Math.min(1, meters / total));
                void updateRoom(r.id, { plan_rect: next });
              };
              return (
                <div key={r.id} className="flex flex-wrap items-end gap-2 text-[13px]">
                  <span className="w-36 truncate font-medium">{r.name}</span>
                  {(["x", "y", "w", "h"] as const).map((k, i) => (
                    <Field key={k} label={`${k} (m)`} className="w-20">
                      <Input inputMode="decimal" className="h-10" defaultValue={toM(rect[i], i % 2 === 0 ? W : D)} onBlur={(e) => set(i, Number(e.target.value), i % 2 === 0 ? W : D)} />
                    </Field>
                  ))}
                </div>
              );
            })}
            <FloorPlan2D plan={f} rooms={tour.rooms} activeRoomId={null} roomsWithScene={roomsWithScene} onSelect={() => undefined} labelFor={(r) => r.name} activeLabel="" />
          </div>
        ))}

        {STEPS[step] === "measures" && (
          <div className="space-y-2">
            {tour?.rooms.map((r) => (
              <div key={r.id} className="flex flex-wrap items-end gap-2 text-[13px]">
                <span className="w-36 truncate font-medium">{r.name}</span>
                <Field label="L (m)" className="w-24"><Input className="h-10" inputMode="decimal" defaultValue={r.length_m ?? ""} onBlur={(e) => { const L = Number(e.target.value) || null; void updateRoom(r.id, { length_m: L, area_m2: L && r.width_m ? Math.round(L * r.width_m * 10) / 10 : r.area_m2 }); }} /></Field>
                <Field label="l (m)" className="w-24"><Input className="h-10" inputMode="decimal" defaultValue={r.width_m ?? ""} onBlur={(e) => { const w = Number(e.target.value) || null; void updateRoom(r.id, { width_m: w, area_m2: w && r.length_m ? Math.round(w * r.length_m * 10) / 10 : r.area_m2 }); }} /></Field>
                <Field label="H (m)" className="w-24"><Input className="h-10" inputMode="decimal" defaultValue={r.ceiling_height_m ?? ""} onBlur={(e) => void updateRoom(r.id, { ceiling_height_m: Number(e.target.value) || null })} /></Field>
                <Field label="m²" className="w-24"><Input className="h-10" inputMode="decimal" value={r.area_m2 ?? ""} onChange={(e) => void updateRoom(r.id, { area_m2: Number(e.target.value) || null })} /></Field>
                <Field label="Matériau" className="w-36"><Input className="h-10" defaultValue={r.material ?? ""} onBlur={(e) => void updateRoom(r.id, { material: e.target.value || null })} /></Field>
              </div>
            ))}
          </div>
        )}

        {STEPS[step] === "preview" && tour && (tour.scenes.length > 0 ? (
          <div className="-mx-5 -mb-5 overflow-hidden rounded-b-card">
            <TourExperience key={JSON.stringify(tour).length} tour={tour} property={{ slug: "", title: propertyTitle }} />
          </div>
        ) : <p className="text-sm text-muted">—</p>)}

        {STEPS[step] === "publish" && tour && (
          <div className="space-y-3">
            <p className="text-sm">{tour.scenes.length} scènes · {tour.rooms.length} pièces · {tour.floor_plans.length} étages</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={tour.status === "published" ? "green" : "outline"}>{tour.status}</Badge>
              {tour.is_verified && <Badge variant="soft">✓ Imora</Badge>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="gold" onClick={publish} loading={busy} disabled={tour.scenes.length === 0 && !tour.model_url}>{t("publish")}</Button>
              <Button variant="outline" onClick={requestVerification} loading={busy} disabled={tour.status !== "published"}>{t("requestVerification")}</Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{tc("previous")}</Button>
        <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>{tc("next")}</Button>
      </div>
    </div>
  );
}
