"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight, ArrowUpDown, Bath, BedDouble, Camera, Car, Compass, DraftingCompass, Info, Map as MapIcon, Maximize, MessageSquareText,
  Minimize, Navigation, Ruler, Smartphone, Sofa, Utensils, UtensilsCrossed, Waves, CalendarDays, Box, Home,
} from "lucide-react";
import type { Hotspot, Room, Scene, Tour } from "@imora/shared";
import { ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Icon3D, Icon360 } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useTheme } from "@/providers/ThemeProvider";
import { PanoramaEngine, prefetchPanorama } from "./engine/PanoramaEngine";
import type { DollhouseEngine } from "./engine/DollhouseEngine";
import { FloorPlan2D, type FloorPlan2DHandle } from "./FloorPlan2D";

type Mode = "free3d" | "pano" | "plan" | "measures";

const HOTSPOT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pool: Waves, kitchen: UtensilsCrossed, dining: Utensils, bedroom: BedDouble, bath: Bath, garage: Car,
  living: Sofa, stairs: ArrowUpDown, info: Info,
};

export interface TourExperienceProps {
  tour: Tour;
  property: { slug: string; title: string; agencyWhatsapp?: boolean };
}

export function TourExperience({ tour, property }: TourExperienceProps) {
  const t = useTranslations("tour");
  const tp = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { resolved } = useTheme();

  const viewerBox = useRef<HTMLDivElement>(null);
  const panoHost = useRef<HTMLDivElement>(null);
  const dollHost = useRef<HTMLDivElement>(null);
  const dollLabels = useRef<HTMLDivElement>(null);
  const hotspotEls = useRef(new Map<string, HTMLButtonElement>());
  const pano = useRef<PanoramaEngine | null>(null);
  const doll = useRef<DollhouseEngine | null>(null);
  const plan = useRef<FloorPlan2DHandle>(null);
  const compass = useRef<HTMLSpanElement>(null);

  const scenesById = useMemo(() => new Map(tour.scenes.map((s) => [s.id, s])), [tour.scenes]);
  const roomsById = useMemo(() => new Map(tour.rooms.map((r) => [r.id, r])), [tour.rooms]);
  const sceneByRoom = useMemo(() => new Map(tour.scenes.filter((s) => s.room_id).map((s) => [s.room_id!, s])), [tour.scenes]);
  const roomsWithScene = useMemo(() => new Set(sceneByRoom.keys()), [sceneByRoom]);
  const has3d = Boolean(tour.model_url) || tour.rooms.filter((r) => r.plan_rect && r.floor_plan_id).length >= 2;

  const initialScene = (() => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("scene");
      if (fromUrl && scenesById.has(fromUrl)) return scenesById.get(fromUrl)!;
    }
    return (tour.start_scene_id && scenesById.get(tour.start_scene_id)) || tour.scenes[0];
  })();

  const [scene, setScene] = useState<Scene>(initialScene);
  const [mode, setMode] = useState<Mode>(tour.scenes.length ? "pano" : "free3d");
  const [progress, setProgress] = useState<number | null>(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [gyro, setGyro] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [showMiniPlan, setShowMiniPlan] = useState(false);
  const [interior, setInterior] = useState(false);

  const room: Room | null = scene?.room_id ? roomsById.get(scene.room_id) ?? null : null;
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(room?.id ?? null);
  const selectedRoom = selectedRoomId ? roomsById.get(selectedRoomId) ?? null : room;
  const floorOf = useCallback((r: Room | null) => tour.floor_plans.find((f) => f.id === r?.floor_plan_id) ?? tour.floor_plans[0], [tour.floor_plans]);
  const [floorId, setFloorId] = useState<string | undefined>(floorOf(room)?.id);
  const floor = tour.floor_plans.find((f) => f.id === floorId) ?? tour.floor_plans[0];

  const roomLabel = useCallback((r: Room) => (locale === "ar" && r.name_ar ? r.name_ar : r.name), [locale]);
  const hotspotLabel = (h: Hotspot) => (locale === "ar" && h.label_ar ? h.label_ar : h.label) ?? "";

  /* -------------------------------------------------- Panorama engine */
  useEffect(() => {
    if (!panoHost.current || tour.scenes.length === 0) return;
    const engine = new PanoramaEngine(panoHost.current, {
      onProgress: setProgress,
      onError: () => toast(tp("common.error"), "error"),
      onHotspotActivate: (id) => {
        const h = tour.scenes.flatMap((s) => s.hotspots).find((x) => x.id === id);
        if (h?.target_scene_id) goToSceneRef.current(h.target_scene_id, true);
      },
      onViewChange: (v) => {
        plan.current?.setHeading(v.yaw);
        if (compass.current) compass.current.style.transform = `rotate(${-v.yaw}deg)`;
      },
    });
    pano.current = engine;
    void engine.loadScene(initialScene.panorama_url, { yaw: initialScene.initial_yaw, pitch: initialScene.initial_pitch }, false);
    void PanoramaEngine.isVRSupported().then(setVrSupported);
    return () => {
      engine.dispose();
      pano.current = null;
    };
    // The engine lives for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind hotspots of the current scene and prefetch neighbours
  useEffect(() => {
    const engine = pano.current;
    if (!engine || !scene) return;
    const bindings = scene.hotspots
      .map((h) => ({ h, el: hotspotEls.current.get(h.id) }))
      .filter((x): x is { h: Hotspot; el: HTMLButtonElement } => Boolean(x.el))
      .map(({ h, el }) => ({ id: h.id, yaw: h.yaw, pitch: h.pitch, el, navigable: h.kind === "navigation" }));
    engine.setHotspots(bindings);
    scene.hotspots.forEach((h) => {
      const target = h.target_scene_id ? scenesById.get(h.target_scene_id) : null;
      if (target) prefetchPanorama(target.panorama_url);
    });
  }, [scene, scenesById]);

  const goToScene = useCallback((sceneId: string, transition = true) => {
    const next = scenesById.get(sceneId);
    if (!next || !pano.current) return;
    setScene(next);
    const r = next.room_id ? roomsById.get(next.room_id) ?? null : null;
    setSelectedRoomId(r?.id ?? null);
    if (r) setFloorId(floorOf(r)?.id);
    void pano.current.loadScene(next.panorama_url, { yaw: next.initial_yaw, pitch: next.initial_pitch }, transition);
    const url = new URL(window.location.href);
    url.searchParams.set("scene", sceneId);
    window.history.replaceState(null, "", url);
  }, [scenesById, roomsById, floorOf]);

  // Engines are created once; their callbacks read the latest handlers through refs.
  const goToSceneRef = useRef(goToScene);
  goToSceneRef.current = goToScene;

  /* -------------------------------------------------- Dollhouse engine (lazy) */
  useEffect(() => {
    if (mode !== "free3d" || doll.current || !dollHost.current || !dollLabels.current) return;
    let cancelled = false;
    (async () => {
      const { DollhouseEngine } = await import("./engine/DollhouseEngine");
      if (cancelled || !dollHost.current || !dollLabels.current) return;
      const engine = new DollhouseEngine(dollHost.current, dollLabels.current, {
        dark: resolved === "dark",
        onRoomSelect: (id) => selectRoomRef.current(roomsById.get(id)!),
      });
      doll.current = engine;
      if (tour.model_url) await engine.loadModel(tour.model_url);
      else engine.buildFromPlan(tour.floor_plans, tour.rooms, (r) => roomLabel(r));
      engine.setVisibleLevel(floor?.level ?? 0);
      engine.selectRoom(selectedRoom?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => () => doll.current?.dispose(), []);
  useEffect(() => doll.current?.setVisibleLevel(floor?.level ?? 0), [floor?.level]);
  useEffect(() => doll.current?.selectRoom(selectedRoom?.id ?? null), [selectedRoom?.id]);

  /* -------------------------------------------------- Interactions */
  const selectRoom = useCallback((r: Room) => {
    setSelectedRoomId(r.id);
    setFloorId(floorOf(r)?.id);
    const s = sceneByRoom.get(r.id);
    if (s && s.id !== scene?.id) {
      goToScene(s.id);
    } else if (!s && mode === "pano") {
      toast(t("noRoomScene"), "error");
    }
    if (doll.current) {
      if (interior) doll.current.interiorView(r.id);
      else doll.current.focusRoom(r.id);
    }
  }, [floorOf, sceneByRoom, scene?.id, goToScene, mode, toast, t, interior]);

  const selectRoomRef = useRef(selectRoom);
  selectRoomRef.current = selectRoom;

  const toggleFullscreen = async () => {
    const el = viewerBox.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
  };
  useEffect(() => {
    const onFs = () => {
      setFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => pano.current?.resize(), 50);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleGyro = async () => {
    const engine = pano.current;
    if (!engine) return;
    if (engine.gyroEnabled) {
      engine.disableGyro();
      setGyro(false);
    } else if (await engine.enableGyro()) {
      setGyro(true);
    } else {
      toast(t("gyroDenied"), "error");
    }
  };

  const enterVR = async () => {
    if (!(await pano.current?.enterVR())) toast(t("vrUnsupported"), "error");
  };

  const screenshot = () => {
    const data = mode === "free3d" ? doll.current?.screenshot() : pano.current?.screenshot();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = `imora-${property.slug}-${(selectedRoom?.name ?? "vue").toLowerCase().replace(/\s+/g, "-")}.jpg`;
    a.click();
  };

  const floorRooms = tour.rooms.filter((r) => r.floor_plan_id === floor?.id);
  const floorArea = floorRooms.reduce((sum, r) => sum + (r.area_m2 ?? 0), 0);

  const modes: { id: Mode; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: "free3d", label: t("modes.free3d"), icon: <Icon3D size={18} />, enabled: has3d },
    { id: "pano", label: t("modes.pano"), icon: <Icon360 size={18} />, enabled: tour.scenes.length > 0 },
    { id: "plan", label: t("modes.plan"), icon: <DraftingCompass className="size-[18px]" />, enabled: tour.floor_plans.length > 0 },
    { id: "measures", label: t("modes.measures"), icon: <Ruler className="size-[18px]" />, enabled: tour.rooms.some((r) => r.length_m) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* ================================================= Viewer */}
      <div ref={viewerBox} className={cn("relative overflow-hidden bg-[#0d0c0a] text-white", fullscreen ? "h-dvh" : "h-[62dvh] min-h-[420px] sm:rounded-b-[28px] lg:h-[68dvh]")}>
        {/* Panorama layer */}
        <div className={cn("absolute inset-0", mode !== "pano" && mode !== "measures" && "invisible")}>
          <div ref={panoHost} className="absolute inset-0" />
          {/* DOM hotspots, positioned by the engine every frame */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {scene?.hotspots.map((h) => {
              const Icon = HOTSPOT_ICONS[h.icon ?? ""] ?? (h.kind === "info" ? Info : Navigation);
              const nav = h.kind === "navigation";
              const featured = nav && scene.hotspots.filter((x) => x.kind === "navigation")[0]?.id === h.id;
              return (
                <button
                  key={h.id}
                  ref={(el) => {
                    if (el) hotspotEls.current.set(h.id, el);
                    else hotspotEls.current.delete(h.id);
                  }}
                  type="button"
                  onClick={() => (nav && h.target_scene_id ? goToScene(h.target_scene_id) : toast(hotspotLabel(h)))}
                  className="pointer-events-auto absolute start-0 top-0 flex items-center gap-2"
                  style={{ visibility: "hidden" }}
                  aria-label={hotspotLabel(h)}
                  title={hotspotLabel(h)}
                >
                  <span className={cn("grid size-12 place-items-center rounded-full shadow-lg ring-2 ring-white/20 transition hover:scale-110",
                    featured ? "bg-gold text-white animate-pulse-ring" : "bg-black/70 text-white backdrop-blur")}>
                    <Icon className="size-5" />
                  </span>
                  {featured && (
                    <span className="flex items-center gap-1.5 rounded-full bg-black/75 px-3.5 py-1.5 text-[13px] font-semibold backdrop-blur">
                      {hotspotLabel(h)} <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {progress != null && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[2px]">
              <div className="w-56 text-center">
                <p className="text-sm font-medium text-white/85">{t("loadingPano")}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-gold-bright transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3D dollhouse layer */}
        <div className={cn("absolute inset-0 bg-gradient-to-b from-[#1a1713] to-[#0d0c0a]", mode !== "free3d" && "invisible")}>
          <div ref={dollHost} className="absolute inset-0" />
          <div ref={dollLabels} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {mode === "free3d" && (
            <div className="absolute start-4 top-[84px] z-10 flex gap-2">
              <button type="button" onClick={() => { setInterior(false); doll.current?.exteriorView(); }}
                className={cn("rounded-full px-3.5 py-2 text-[12.5px] font-semibold backdrop-blur", !interior ? "bg-white text-[#111]" : "bg-black/60 text-white")}>
                <Home className="me-1.5 inline size-3.5" />{t("exterior")}
              </button>
              <button type="button" onClick={() => { setInterior(true); if (selectedRoom) doll.current?.interiorView(selectedRoom.id); }}
                className={cn("rounded-full px-3.5 py-2 text-[12.5px] font-semibold backdrop-blur", interior ? "bg-white text-[#111]" : "bg-black/60 text-white")}>
                <Box className="me-1.5 inline size-3.5" />{t("interior")}
              </button>
            </div>
          )}
        </div>

        {/* Plan / measures layer */}
        {(mode === "plan" || (mode === "measures" && !scene)) && floor && (
          <div className="absolute inset-0 overflow-auto bg-[#f4efe7] p-4 pt-20 dark:bg-[#171512]">
            <FloorPlan2D plan={floor} rooms={tour.rooms} activeRoomId={selectedRoom?.id ?? null} roomsWithScene={roomsWithScene}
              onSelect={(r) => { selectRoom(r); if (sceneByRoom.has(r.id)) setMode("pano"); }} labelFor={roomLabel} activeLabel={t("activeView")} />
          </div>
        )}
        {mode === "measures" && floor && (
          <div className="absolute inset-x-3 top-20 max-h-[45%] overflow-auto rounded-2xl bg-black/70 p-3 backdrop-blur">
            <table className="w-full text-[13px]">
              <thead className="text-white/50"><tr><th className="py-1 text-start font-medium">{floor.name}</th><th className="text-end font-medium">{t("area")}</th><th className="text-end font-medium">L × l</th></tr></thead>
              <tbody>
                {floorRooms.map((r) => (
                  <tr key={r.id} className={cn("border-t border-white/10", r.id === selectedRoom?.id && "text-[#e8c66d]")}>
                    <td className="py-1.5">{roomLabel(r)}</td>
                    <td className="text-end ltr-nums">{r.area_m2 ? `${r.area_m2} m²` : "—"}</td>
                    <td className="text-end ltr-nums">{r.length_m && r.width_m ? `${r.length_m} × ${r.width_m} m` : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/25 font-semibold"><td className="py-1.5">Total</td><td className="text-end ltr-nums">{Math.round(floorArea)} m²</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Top-left: property / room chip */}
        <div className="pointer-events-none absolute start-4 top-4 z-10 flex items-center gap-2.5 rounded-2xl bg-black/65 py-2 ps-3 pe-4 backdrop-blur">
          <span className="size-2.5 rounded-full bg-gold-bright" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">{property.title}</p>
            <p className="text-[12.5px] text-white/75 ltr-nums">
              {selectedRoom ? roomLabel(selectedRoom) : scene?.name}{selectedRoom?.area_m2 ? ` · ${selectedRoom.area_m2} m²` : ""}
            </p>
          </div>
        </div>

        {/* Top-right controls */}
        <div className="absolute end-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/65 p-1.5 backdrop-blur">
          <button type="button" onClick={toggleGyro} aria-pressed={gyro} aria-label={t("gyro")} title={t("gyro")}
            className={cn("grid size-10 place-items-center rounded-full transition", gyro ? "bg-white text-[#111]" : "hover:bg-white/10")}>
            <Smartphone className="size-5" />
          </button>
          <button type="button" onClick={() => pano.current?.animateTo(0, 0)} aria-label={tp("map.north")} title={tp("map.north")}
            className="grid size-10 place-items-center rounded-full bg-white/10 text-[13px] font-bold text-[#e8c66d]">
            <span ref={compass} className="inline-block transition-none">{t("north")}</span>
          </button>
          <button type="button" onClick={enterVR} disabled={!vrSupported} aria-label={t("vr")} title={vrSupported ? t("vr") : t("vrUnsupported")}
            className="flex h-10 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[14px] font-bold text-white disabled:opacity-60">
            <Icon3D size={18} /> {t("vr")}
          </button>
        </div>

        {/* Room info card */}
        {selectedRoom && mode !== "plan" && (
          <div className="absolute inset-x-3 bottom-[76px] z-10 flex items-center justify-between gap-3 rounded-2xl bg-black/75 p-4 backdrop-blur sm:inset-x-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <DraftingCompass className="size-5 text-[#e8c66d]" />
                <p className="truncate text-[20px] font-semibold">{roomLabel(selectedRoom)}</p>
                {selectedRoom.area_m2 && <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[13px] font-semibold ltr-nums">{selectedRoom.area_m2} m²</span>}
              </div>
              <p className="mt-1 truncate text-[13.5px] text-white/75 ltr-nums">
                {[
                  selectedRoom.length_m && selectedRoom.width_m ? t("dimensions", { length: selectedRoom.length_m, width: selectedRoom.width_m }) : null,
                  selectedRoom.ceiling_height_m ? t("ceiling", { height: selectedRoom.ceiling_height_m }) : null,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button type="button" onClick={() => setShowMiniPlan((v) => !v)} aria-pressed={showMiniPlan} aria-label={t("modes.plan")}
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/12 hover:bg-white/20">
              <MapIcon className="size-5" />
            </button>
          </div>
        )}
        {showMiniPlan && floor && mode !== "plan" && (
          <div className="absolute end-4 top-20 z-20 w-[min(340px,70%)] animate-fade-up">
            <FloorPlan2D plan={floor} rooms={tour.rooms} activeRoomId={selectedRoom?.id ?? null} roomsWithScene={roomsWithScene}
              onSelect={selectRoom} labelFor={roomLabel} activeLabel="" className="bg-white/90 shadow-lift dark:bg-[#171512]/90" />
          </div>
        )}

        {/* Mode bar */}
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 p-1.5 backdrop-blur sm:inset-x-4">
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
            {modes.filter((m) => m.enabled).map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
                className={cn("flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold leading-[1.1] transition sm:flex-none sm:px-4 sm:text-[13.5px]",
                  mode === m.id ? "bg-gold text-white" : "text-white/85 hover:bg-white/10")}>
                <span className="shrink-0">{m.icon}</span> <span className="max-w-[4.5rem] text-start sm:max-w-none">{m.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={screenshot} aria-label={t("screenshot")} title={t("screenshot")} className="hidden size-11 shrink-0 sm:grid place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <Camera className="size-5" />
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
        </div>

        {mode === "pano" && progress == null && (
          <p className="pointer-events-none absolute inset-x-0 top-24 text-center text-[12px] text-white/60 sm:hidden">{t("dragHint")}</p>
        )}
      </div>

      {/* ================================================= Below the viewer */}
      <div className="space-y-4 px-4 pt-4 pb-28 sm:px-6 lg:pb-10">
        {tour.floor_plans.length > 1 && (
          <div role="tablist" className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1">
            {tour.floor_plans.map((f) => (
              <button key={f.id} role="tab" type="button" aria-selected={f.id === floor?.id} onClick={() => setFloorId(f.id)}
                className={cn("min-h-12 rounded-xl px-2 text-[13.5px] font-semibold leading-tight transition", f.id === floor?.id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")}>
                {locale === "ar" && f.name_ar ? f.name_ar : f.name}
              </button>
            ))}
          </div>
        )}

        {floor && (
          <section className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-[19px] font-semibold leading-tight text-ink sm:text-[22px]">
                <Compass className="size-5 shrink-0 text-gold" /> {t("planTitle")}
              </h2>
              {floor.scale_label && <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-[12.5px] font-semibold text-gold">{t("scale", { scale: floor.scale_label })}</span>}
            </div>
            <div className="relative">
              <FloorPlan2D ref={plan} plan={floor} rooms={tour.rooms} activeRoomId={selectedRoom?.id ?? null} roomsWithScene={roomsWithScene}
                onSelect={selectRoom} labelFor={roomLabel} activeLabel={t("activeView")} />
              {selectedRoom && sceneByRoom.has(selectedRoom.id) && (
                <span className="absolute end-3 bottom-3 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-on-ink">{t("syncedCamera")}</span>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href={`/property/${property.slug}#contact`} variant="secondary" size="lg">
            <MessageSquareText className="size-5" /> {tp("contact.whatsappAgent")}
          </ButtonLink>
          <ButtonLink href={`/property/${property.slug}#visit`} size="lg">
            <CalendarDays className="size-5" /> {tp("visit.physical")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
