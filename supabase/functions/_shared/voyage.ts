import { HttpError } from "./http.ts";

/**
 * Voyage AI multimodal embeddings (text + images in one 1024-d space).
 * Used for semantic search, "search with a photo" and recommendations (pgvector).
 */
export const EMBEDDING_MODEL = "voyage-multimodal-3";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: string } | { type: "image_base64"; image_base64: string };

export async function embedMultimodal(inputs: Part[][], inputType: "query" | "document"): Promise<number[][]> {
  const key = Deno.env.get("VOYAGE_API_KEY");
  if (!key) throw new HttpError(503, "embeddings_not_configured");
  const res = await fetch("https://api.voyageai.com/v1/multimodalembeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input_type: inputType,
      inputs: inputs.map((content) => ({ content })),
    }),
  });
  if (!res.ok) {
    console.error("voyage error", res.status, await res.text());
    throw new HttpError(502, "embedding_failed");
  }
  const body = await res.json() as { data: { embedding: number[] }[] };
  return body.data.map((d) => d.embedding);
}

export const toPgVector = (v: number[]) => `[${v.join(",")}]`;
