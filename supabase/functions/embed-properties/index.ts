// Imora AI — embedding backfill / refresh.
// Computes multimodal embeddings for published listings (text summary + cover photos)
// so that semantic recommendations and photo search work. Call from a cron
// (Supabase scheduled function) or manually by an admin.
import { HttpError, handle, json } from "../_shared/http.ts";
import { admin, asUser, requireUser } from "../_shared/supabase.ts";
import { EMBEDDING_MODEL, embedMultimodal, toPgVector } from "../_shared/voyage.ts";

const BATCH = 16;

function summary(p: Record<string, unknown>) {
  return [
    `${p.property_type} ${p.listing_type}`, p.title, p.district, p.city,
    p.bedrooms ? `${p.bedrooms} chambres` : null, p.area_m2 ? `${p.area_m2} m²` : null,
    p.has_pool ? "piscine" : null, p.has_garden ? "jardin" : null, (p.description as string | null)?.slice(0, 600),
  ].filter(Boolean).join(" · ");
}

Deno.serve(handle(async (req) => {
  // Either the cron secret or an admin user
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!(cronSecret && req.headers.get("x-cron-secret") === cronSecret)) {
    await requireUser(req);
    const { data: isAdmin } = await asUser(req).rpc("is_admin");
    if (!isAdmin) throw new HttpError(403, "forbidden");
  }

  const { data: existing } = await admin.from("ai_embeddings").select("property_id, content_hash").eq("entity_type", "property_text");
  const known = new Map((existing ?? []).map((e) => [e.property_id as string, e.content_hash as string]));

  const { data: props } = await admin
    .from("properties")
    .select("id, title, description, listing_type, property_type, city, district, bedrooms, area_m2, has_pool, has_garden, media:property_media(id, url, is_cover, kind)")
    .eq("status", "published")
    .limit(500);

  const todo = (props ?? []).filter((p) => known.get(p.id) !== summary(p).slice(0, 200));
  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    // Text + cover image together give a richer listing vector
    const inputs = chunk.map((p) => {
      const cover = (p.media as { url: string | null; is_cover: boolean; kind: string }[]).find((m) => m.is_cover && m.kind === "image")?.url;
      return [{ type: "text" as const, text: summary(p) }, ...(cover ? [{ type: "image_url" as const, image_url: cover }] : [])];
    });
    const vectors = await embedMultimodal(inputs, "document");
    await admin.from("ai_embeddings").upsert(
      chunk.map((p, j) => ({
        entity_type: "property_text", property_id: p.id, media_id: null, model: EMBEDDING_MODEL,
        content_hash: summary(p).slice(0, 200), embedding: toPgVector(vectors[j]),
      })),
      { onConflict: "entity_type,property_id,media_id" },
    );

    // Individual photos for photo search
    const photos = chunk.flatMap((p) => (p.media as { id: string; url: string | null; kind: string }[]).filter((m) => m.kind === "image" && m.url).slice(0, 4).map((m) => ({ p, m })));
    if (photos.length) {
      const pv = await embedMultimodal(photos.map(({ m }) => [{ type: "image_url" as const, image_url: m.url! }]), "document");
      await admin.from("ai_embeddings").upsert(
        photos.map(({ p, m }, k) => ({
          entity_type: "property_image", property_id: p.id, media_id: m.id, model: EMBEDDING_MODEL,
          content_hash: m.url!, embedding: toPgVector(pv[k]),
        })),
        { onConflict: "entity_type,property_id,media_id" },
      );
    }
    done += chunk.length;
  }
  return json(req, { embedded: done, skipped: (props?.length ?? 0) - done });
}));
