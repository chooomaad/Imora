// Imora AI — listing photo analysis (Vision).
// Detects rooms / amenities / apparent condition and drafts a description.
// Results are stored as *pending* ai_suggestions: nothing is applied to the
// listing until the owner accepts, edits or rejects each suggestion.
import { HttpError, handle, json } from "../_shared/http.ts";
import { admin, asUser, enforceAiQuota, requireUser } from "../_shared/supabase.ts";
import { CLAUDE_MODEL, claudeJson } from "../_shared/anthropic.ts";
import { EMBEDDING_MODEL, embedMultimodal, toPgVector } from "../_shared/voyage.ts";

const ROOM_TYPES = ["living", "kitchen", "bedroom", "bathroom", "dining", "pool", "parking", "garden", "terrace", "facade", "office", "other"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["photos", "features", "description"],
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "room_type", "furnished", "condition", "highlights"],
        properties: {
          index: { type: "integer" },
          room_type: { type: "string", enum: ROOM_TYPES },
          furnished: { type: "boolean" },
          condition: { type: "string", enum: ["new", "good", "needs_refresh", "needs_work", "unknown"] },
          highlights: { type: "array", items: { type: "string" } },
        },
      },
    },
    features: {
      type: "object",
      additionalProperties: false,
      required: ["has_pool", "has_garden", "parking", "furnished", "terrace", "sea_view"],
      properties: {
        has_pool: { type: "boolean" },
        has_garden: { type: "boolean" },
        parking: { type: "boolean" },
        furnished: { type: "boolean" },
        terrace: { type: "boolean" },
        sea_view: { type: "boolean" },
      },
    },
    description: { type: "string" },
  },
};

Deno.serve(handle(async (req) => {
  const userId = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const propertyId: string = body.property_id ?? "";
  const locale = body.locale === "ar" ? "ar" : "fr";
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) throw new HttpError(400, "invalid_property");

  // Authorization is checked as the caller (RLS / SQL helper), never trusted from the body
  const { data: canManage } = await asUser(req).rpc("can_manage_property", { p_property_id: propertyId });
  if (!canManage) throw new HttpError(403, "forbidden");
  await enforceAiQuota(req, userId, "ai_vision");

  const { data: property } = await admin
    .from("properties")
    .select("id, title, listing_type, property_type, city, district, bedrooms, bathrooms, area_m2")
    .eq("id", propertyId)
    .single();
  const { data: media } = await admin
    .from("property_media")
    .select("id, url")
    .eq("property_id", propertyId)
    .eq("kind", "image")
    .order("position")
    .limit(8);
  const photos = (media ?? []).filter((m) => m.url);
  if (photos.length === 0) throw new HttpError(400, "no_photos");

  const language = locale === "ar" ? "Modern Standard Arabic" : "French";
  const facts = JSON.stringify(property);
  const result = await claudeJson<{
    photos: { index: number; room_type: string; furnished: boolean; condition: string; highlights: string[] }[];
    features: Record<string, boolean>;
    description: string;
  }>({
    system: `You assist property owners in Mauritania who publish listings on Imora.
Analyse the photos. For each photo (index = order given), classify the room and visible condition, and list up to 3 short highlights in ${language}.
Then report amenities that are clearly visible across the photos (false when not visible — do not guess).
Finally draft a factual, elegant listing description in ${language} (90–140 words). Use ONLY facts visible in the photos or present in the listing data provided. Never invent legal status, price, surface, neighbourhood amenities or guarantees. No superlatives about investment returns.`,
    content: [
      ...photos.map((p) => ({ type: "image" as const, source: { type: "url" as const, url: p.url! } })),
      { type: "text", text: `Listing data (trusted, owner-provided): ${facts}` },
    ],
    schema: SCHEMA,
    maxTokens: 6000,
    effort: "medium",
  });

  // Per-photo tags (informational metadata; not shown publicly as listing facts)
  await Promise.all(
    result.photos
      .filter((p) => photos[p.index])
      .map((p) => admin.from("property_media").update({ ai_tags: { room_type: p.room_type, condition: p.condition, highlights: p.highlights, model: CLAUDE_MODEL } }).eq("id", photos[p.index].id)),
  );

  // Replace previous pending suggestions with fresh ones
  await admin.from("ai_suggestions").delete().eq("property_id", propertyId).eq("status", "pending");
  const rooms = [...new Set(result.photos.map((p) => p.room_type).filter((r) => r !== "other"))];
  const { data: suggestions, error } = await admin
    .from("ai_suggestions")
    .insert([
      { property_id: propertyId, kind: "description", suggestion: { text: result.description, locale }, model: CLAUDE_MODEL },
      { property_id: propertyId, kind: "features", suggestion: result.features, model: CLAUDE_MODEL },
      { property_id: propertyId, kind: "room_detection", suggestion: { rooms, photos: result.photos }, model: CLAUDE_MODEL },
    ])
    .select("id, kind, suggestion, status");
  if (error) throw error;

  // Photo embeddings for "search with a photo" and similarity (best effort)
  try {
    const vectors = await embedMultimodal(photos.map((p) => [{ type: "image_url" as const, image_url: p.url! }]), "document");
    await admin.from("ai_embeddings").upsert(
      vectors.map((v, i) => ({
        entity_type: "property_image", property_id: propertyId, media_id: photos[i].id,
        model: EMBEDDING_MODEL, content_hash: photos[i].url!, embedding: toPgVector(v),
      })),
      { onConflict: "entity_type,property_id,media_id" },
    );
  } catch (e) {
    console.warn("embedding skipped", e);
  }

  return json(req, { suggestions });
}));
