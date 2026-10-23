import type {
  AppRole, ListingType, PricePeriod, PropertyStatus, PropertyType, Tour,
} from "@imora/shared";

export type { PropertyCard, MapMarker, Tour, Scene, Hotspot, Room, FloorPlan } from "@imora/shared";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  role_selected: boolean;
  preferred_locale: "fr" | "ar" | "en";
  is_verified: boolean;
  is_demo: boolean;
}

export interface AgencySummary {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  logo_url: string | null;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  avg_response_minutes: number | null;
  is_demo: boolean;
}

export interface MediaItem {
  id: string;
  kind: "image" | "video" | "panorama" | "model" | "floor_plan";
  url: string | null;
  caption: string | null;
  position: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
}

export interface NearbyPlace {
  id: string;
  category: string;
  name: string;
  travel_minutes: number | null;
  travel_mode: "car" | "walk";
}

export interface PropertyDetail {
  id: string;
  slug: string;
  reference: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  listing_type: ListingType;
  property_type: PropertyType;
  status: PropertyStatus;
  price: number;
  price_period: PricePeriod;
  price_negotiable: boolean;
  notary_fees_estimate: number | null;
  owner_id: string;
  agency_id: string | null;
  agent_id: string | null;
  city: string;
  district: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  land_area_m2: number | null;
  parking_spaces: number;
  has_pool: boolean;
  has_garden: boolean;
  has_generator: boolean;
  water_tank_liters: number | null;
  furnished: boolean;
  available_from: string | null;
  estimated_yield: number | null;
  occupancy_rate: number | null;
  is_verified: boolean;
  documents_verified: boolean;
  has_360: boolean;
  has_3d: boolean;
  views_count: number;
  is_demo: boolean;
  published_at: string | null;
  media: MediaItem[];
  features: { feature_key: string; value: string | null }[];
  nearby: NearbyPlace[];
  agency: AgencySummary | null;
  owner: Pick<Profile, "id" | "full_name" | "avatar_url" | "is_verified"> | null;
  agent: { id: string; title: string | null; profile: Pick<Profile, "full_name" | "avatar_url"> | null } | null;
  location: { lng: number; lat: number; is_approximate: boolean } | null;
  tour: Pick<Tour, "id" | "title" | "is_verified"> | null;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}
