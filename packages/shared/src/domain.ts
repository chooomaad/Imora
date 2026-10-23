// Domain types mirroring the PostgreSQL enums in supabase/migrations.
// Keep these lists in sync with 0001_extensions_enums.sql.

export const APP_ROLES = [
  "client",
  "proprietaire",
  "agent",
  "agency_admin",
  "developer",
  "admin",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Roles a user may pick for themselves after sign-up (admin/agent are granted, never chosen). */
export const SELF_ASSIGNABLE_ROLES = ["client", "proprietaire", "agency_admin", "developer"] as const;
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

export const LISTING_TYPES = ["sale", "rent", "investment"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "house",
  "land",
  "office",
  "retail",
  "building",
  "project",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived",
  "sold",
  "rented",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PRICE_PERIODS = ["total", "month", "year"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];

export const CONTACT_EVENT_TYPES = [
  "phone_reveal",
  "whatsapp_click",
  "call_click",
  "message_sent",
  "visit_requested",
] as const;
export type ContactEventType = (typeof CONTACT_EVENT_TYPES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "negotiation",
  "converted",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const VISIT_STATUSES = ["requested", "confirmed", "cancelled", "completed", "no_show"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const TRANSACTION_TYPES = ["sale", "rent"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["pending", "confirmed", "completed", "cancelled", "disputed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const SORT_OPTIONS = ["relevance", "newest", "price_asc", "price_desc", "area_desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Row returned by the `search_properties` RPC. */
export interface PropertyCard {
  id: string;
  slug: string;
  reference: string;
  title: string;
  title_ar: string | null;
  listing_type: ListingType;
  property_type: PropertyType;
  price: number;
  price_period: PricePeriod;
  city: string;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  parking_spaces: number | null;
  has_pool: boolean;
  has_360: boolean;
  has_3d: boolean;
  is_verified: boolean;
  is_demo: boolean;
  estimated_yield: number | null;
  cover_url: string | null;
  agency_name: string | null;
  agency_verified: boolean | null;
  lat: number | null;
  lng: number | null;
  published_at: string | null;
  total_count?: number;
}

/** Row returned by the `properties_in_bbox` RPC (map markers). */
export interface MapMarker {
  id: string;
  slug: string;
  lat: number;
  lng: number;
  price: number;
  price_period: PricePeriod;
  listing_type: ListingType;
  property_type: PropertyType;
  has_3d: boolean;
  has_360: boolean;
}

export interface Room {
  id: string;
  floor_plan_id: string | null;
  name: string;
  name_ar: string | null;
  room_type: string | null;
  area_m2: number | null;
  length_m: number | null;
  width_m: number | null;
  ceiling_height_m: number | null;
  /** Rectangle on the floor plan, normalized 0..1: [x, y, w, h]. */
  plan_rect: [number, number, number, number] | null;
  material: string | null;
}

export interface Hotspot {
  id: string;
  scene_id: string;
  kind: "navigation" | "info" | "measure";
  target_scene_id: string | null;
  yaw: number;
  pitch: number;
  label: string | null;
  label_ar: string | null;
  icon: string | null;
}

export interface Scene {
  id: string;
  room_id: string | null;
  name: string;
  panorama_url: string;
  preview_url: string | null;
  initial_yaw: number;
  initial_pitch: number;
  position: number;
  hotspots: Hotspot[];
}

export interface FloorPlan {
  id: string;
  level: number;
  name: string;
  name_ar: string | null;
  image_url: string | null;
  scale_label: string | null;
  /** Real-world footprint of the plan, used to scale rooms in 2D and 3D. */
  width_m: number | null;
  depth_m: number | null;
}

export interface Tour {
  id: string;
  property_id: string;
  title: string;
  status: "draft" | "published";
  source: "manual_360" | "photogrammetry" | "lidar" | "generated";
  model_url: string | null;
  start_scene_id: string | null;
  is_verified: boolean;
  floor_plans: FloorPlan[];
  rooms: Room[];
  scenes: Scene[];
}
