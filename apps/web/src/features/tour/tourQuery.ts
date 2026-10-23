import type { Room, Tour } from "@imora/shared";

/** PostgREST projection of a full tour graph (floors, rooms, scenes, hotspots). */
export const TOUR_SELECT = `
  id, property_id, title, status, source, model_url, start_scene_id, is_verified,
  floor_plans:property_floor_plans(id, level, name, name_ar, image_url, scale_label, width_m, depth_m),
  rooms:property_rooms(id, floor_plan_id, name, name_ar, room_type, area_m2, length_m, width_m, ceiling_height_m, plan_rect, material, position),
  scenes:property_360_scenes!property_360_scenes_tour_id_fkey(id, room_id, name, panorama_url, preview_url, initial_yaw, initial_pitch, position,
    hotspots:property_hotspots!property_hotspots_scene_id_fkey(id, scene_id, kind, target_scene_id, yaw, pitch, label, label_ar, icon))
`;

const n = (v: unknown) => (v == null ? null : Number(v));

/** Numeric columns come back as strings from PostgREST: normalize and sort. */
export function normalizeTour(data: unknown): Tour {
  const tour = data as Tour;
  return {
    ...tour,
    floor_plans: tour.floor_plans
      .map((f) => ({ ...f, width_m: n(f.width_m), depth_m: n(f.depth_m) }))
      .sort((a, b) => a.level - b.level),
    rooms: tour.rooms
      .map((r) => ({
        ...r,
        area_m2: n(r.area_m2), length_m: n(r.length_m), width_m: n(r.width_m), ceiling_height_m: n(r.ceiling_height_m),
        plan_rect: r.plan_rect ? (r.plan_rect.map(Number) as Room["plan_rect"]) : null,
      }))
      .sort((a, b) => ((a as { position?: number }).position ?? 0) - ((b as { position?: number }).position ?? 0)),
    scenes: tour.scenes
      .map((s) => ({
        ...s,
        initial_yaw: Number(s.initial_yaw), initial_pitch: Number(s.initial_pitch),
        hotspots: s.hotspots.map((h) => ({ ...h, yaw: Number(h.yaw), pitch: Number(h.pitch) })),
      }))
      .sort((a, b) => a.position - b.position),
  };
}
