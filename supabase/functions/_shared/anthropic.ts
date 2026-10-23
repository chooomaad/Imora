import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";
import { HttpError } from "./http.ts";

export const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new HttpError(503, "ai_not_configured");
  client ??= new Anthropic({ apiKey });
  return client;
}

type Content = Anthropic.Messages.ContentBlockParam[] | string;

/**
 * One structured-output call to Claude. Returns the parsed JSON object (validated by the caller).
 * - JSON schema constrained output (output_config.format)
 * - server-side refusal fallback ("default" routing)
 * - low effort: these are extraction/classification tasks
 */
export async function claudeJson<T>(opts: {
  system: string;
  content: Content;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const response = await getClient().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    // deno-lint-ignore no-explicit-any
    ...({ fallbacks: "default" } as any),
    system: opts.system,
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema", schema: opts.schema },
    },
    messages: [{ role: "user", content: opts.content }],
  } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") throw new HttpError(422, "ai_refused");
  if (response.stop_reason === "max_tokens") throw new HttpError(502, "ai_truncated");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new HttpError(502, "ai_empty");
  try {
    return JSON.parse(text.text) as T;
  } catch {
    throw new HttpError(502, "ai_invalid_json");
  }
}

/** Utility for JSON schemas: a nullable field (structured outputs need every property listed in `required`). */
export const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

/** Drop null values returned for "not mentioned" fields. */
export function stripNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))) as Partial<T>;
}
