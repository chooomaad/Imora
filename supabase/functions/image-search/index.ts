// Imora AI — "Rechercher avec une photo".
// 1. Claude vision extracts visible characteristics (shown to the user, never stored as listing data)
// 2. Voyage multimodal embedding of the photo
// 3. pgvector similarity against embedded listing photos (match_properties_by_embedding)
import { HttpError, handle, json } from "../_shared/http.ts";
import { admin, enforceAiQuota, getUserId } from "../_shared/supabase.ts";
import { claudeJson } from "../_shared/anthropic.ts";
import { embedMultimodal, toPgVector } from "../_shared/voyage.ts";
import { propertyFiltersSchema } from "../_shared/generated/filters.ts";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64 = 4_000_000; // ~3 MB image

const VISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_property", "description"],
  properties: {
    is_property: { type: "boolean" },
    description: { type: "string" },
  },
};

Deno.serve(handle(async (req) => {
  const body = await req.json().catch(() => ({}));
  const image: string = body.image_base64 ?? "";
  const mediaType: string = body.media_type ?? "image/jpeg";
  if (!image || image.length > MAX_BASE64 || !ALLOWED.includes(mediaType)) throw new HttpError(400, "invalid_image");
  const filters = propertyFiltersSchema.safeParse(body.filters ?? {});

  const userId = await getUserId(req);
  await enforceAiQuota(req, userId, "image_search");

  const locale = body.locale === "ar" ? "Arabic" : "French";
  const [vision, [embedding]] = await Promise.all([
    claudeJson<{ is_property: boolean; description: string }>({
      system: `You describe photos of buildings for a Mauritanian real-estate search. In ${locale}, one sentence (max 25 words) listing the visible architectural style, building type, number of floors, and notable features (pool, terrace, garden, sea view). If the photo is not a building or interior, set is_property=false and explain briefly.`,
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: image } },
        { type: "text", text: "Describe this property photo." },
      ],
      schema: VISION_SCHEMA,
      maxTokens: 1000,
    }),
    embedMultimodal([[{ type: "image_base64", image_base64: `data:${mediaType};base64,${image}` }]], "query"),
  ]);

  if (!vision.is_property) return json(req, { matches: [], description: vision.description });

  const { data, error } = await admin.rpc("match_properties_by_embedding", {
    p_embedding: toPgVector(embedding),
    p_limit: 8,
    p_filters: filters.success ? filters.data : {},
  });
  if (error) throw error;

  // Keep only meaningful matches
  const matches = (data ?? []).filter((m: { similarity: number }) => m.similarity >= 0.35);
  return json(req, { matches, description: vision.description });
}));
