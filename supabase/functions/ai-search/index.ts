// Imora AI — natural-language search.
// Turns "villa 4 chambres à Tevragh-Zeina avec piscine, max 12 M" into validated
// structured filters. The model never touches the database: it only returns JSON,
// which is validated against the shared Zod schema before the count query runs.
import { HttpError, handle, json } from "../_shared/http.ts";
import { admin, enforceAiQuota, getUserId } from "../_shared/supabase.ts";
import { CLAUDE_MODEL, claudeJson, nullable, stripNulls } from "../_shared/anthropic.ts";
import { propertyFiltersSchema } from "../_shared/generated/filters.ts";
import { LISTING_TYPES, PROPERTY_TYPES } from "../_shared/generated/domain.ts";
import { CITIES, NOUAKCHOTT_DISTRICTS } from "../_shared/generated/geo.ts";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "listing_type", "property_types", "city", "district", "price_min", "price_max", "area_min",
    "bedrooms_min", "bathrooms_min", "parking", "pool", "garden", "furnished", "has_360", "has_3d",
    "verified", "keywords", "interpretation",
  ],
  properties: {
    listing_type: nullable({ type: "string", enum: [...LISTING_TYPES] }),
    property_types: { type: "array", items: { type: "string", enum: [...PROPERTY_TYPES] } },
    city: nullable({ type: "string", enum: [...CITIES] }),
    district: nullable({ type: "string", enum: [...NOUAKCHOTT_DISTRICTS] }),
    price_min: nullable({ type: "integer" }),
    price_max: nullable({ type: "integer" }),
    area_min: nullable({ type: "number" }),
    bedrooms_min: nullable({ type: "integer" }),
    bathrooms_min: nullable({ type: "integer" }),
    parking: nullable({ type: "boolean" }),
    pool: nullable({ type: "boolean" }),
    garden: nullable({ type: "boolean" }),
    furnished: nullable({ type: "boolean" }),
    has_360: nullable({ type: "boolean" }),
    has_3d: nullable({ type: "boolean" }),
    verified: nullable({ type: "boolean" }),
    keywords: nullable({ type: "string" }),
    interpretation: { type: "string" },
  },
};

const SYSTEM = `You convert real-estate search requests for Mauritania (French, Arabic or Hassaniya, sometimes mixed) into search filters for the Imora marketplace.

Rules:
- Only set a field when the user expressed it; otherwise null (or [] for property_types). Never invent criteria.
- listing_type: "sale" (acheter/vendre/شراء), "rent" (louer/location/إيجار), "investment" (investir/rendement/استثمار).
- property_types: apartment, villa, house (maison), land (terrain), office (bureau), retail (commerce/boutique), building (immeuble), project (projet neuf).
- Geography: districts ${NOUAKCHOTT_DISTRICTS.join(", ")} are in Nouakchott — when a district is named, set city to "Nouakchott" too. Map spelling variants (Tevragh Zeina, TZ, تفرغ زينة → Tevragh-Zeina; Ksar/لكصر → Ksar; Teyarett/Tayaret → Teyarett). Cities: ${CITIES.join(", ")}.
- Prices are in MRU (new ouguiya). "12 millions" = 12000000. "35k"/"35 mille" = 35000. If the user explicitly says old ouguiyas (MRO / ancienne ouguiya), divide by 10. "budget max"/"moins de" → price_max; "au moins"/"à partir de" → price_min. For a rental, prices are monthly.
- "4 chambres" → bedrooms_min 4. "garage"/"parking" → parking true. "piscine" → pool true. "visite 3D" → has_3d true; "360" → has_360 true. "vérifié" → verified true.
- keywords: short distinctive words that are not covered by the fields (e.g. "vue mer", "contemporaine"), else null. Keep it under 5 words.
- interpretation: one short sentence, in the user's language, restating what you understood.`;

Deno.serve(handle(async (req) => {
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 3 || query.length > 500) throw new HttpError(400, "invalid_query");

  const userId = await getUserId(req);
  await enforceAiQuota(req, userId, "ai_search");

  const raw = await claudeJson<Record<string, unknown>>({
    system: SYSTEM,
    content: query,
    schema: SCHEMA,
    maxTokens: 2000,
  });

  const { interpretation, keywords, ...rest } = raw as Record<string, unknown> & { interpretation: string; keywords: string | null };
  const candidate = stripNulls(rest);

  // Validate field by field so a single odd value never breaks the search.
  const filters: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(candidate)) {
    const field = propertyFiltersSchema.shape[k as keyof typeof propertyFiltersSchema.shape];
    const parsed = field?.safeParse(v);
    if (parsed?.success) filters[k] = parsed.data;
  }

  const { data: count, error } = await admin.rpc("count_properties", { p_filters: filters });
  if (error) throw error;

  // Keywords only narrow the search when they still leave results
  if (keywords && Number(count) > 0) {
    const { data: kwCount } = await admin.rpc("count_properties", { p_filters: { ...filters, q: keywords } });
    if (Number(kwCount) > 0) {
      filters.q = keywords;
    }
  }
  const finalCount = filters.q
    ? Number((await admin.rpc("count_properties", { p_filters: filters })).data ?? 0)
    : Number(count ?? 0);

  await admin.from("ai_searches").insert({
    user_id: userId,
    query,
    extracted_filters: filters,
    interpretation,
    result_count: finalCount,
    model: CLAUDE_MODEL,
  });

  return json(req, { filters, interpretation, count: finalCount });
}));
