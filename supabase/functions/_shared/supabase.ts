import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";
import { HttpError } from "./http.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Service-role client. Only ever used server-side, after the caller has been validated. */
export const admin: SupabaseClient = createClient(URL, SERVICE, { auth: { persistSession: false } });

/** Client acting as the caller (RLS applies). */
export function asUser(req: Request): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? `Bearer ${ANON}` } },
  });
}

export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth || auth === `Bearer ${ANON}`) return null;
  const { data } = await asUser(req).auth.getUser();
  return data.user?.id ?? null;
}

export async function requireUser(req: Request): Promise<string> {
  const id = await getUserId(req);
  if (!id) throw new HttpError(401, "not_authenticated");
  return id;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-user (or per-IP for anonymous callers) daily quota on paid AI calls.
 * Limit comes from app_settings.ai_daily_limit.
 */
export async function enforceAiQuota(req: Request, userId: string | null, feature: string) {
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "ai_daily_limit").maybeSingle();
  const limit = Number(setting?.value ?? 40);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await sha256(`${ip}:${Deno.env.get("SUPABASE_URL")}`);

  let q = admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("feature", feature).gte("created_at", since);
  q = userId ? q.eq("user_id", userId) : q.eq("ip_hash", ipHash);
  const { count } = await q;
  // Anonymous callers get a smaller allowance
  if ((count ?? 0) >= (userId ? limit : Math.ceil(limit / 4))) throw new HttpError(429, "rate_limited");
  await admin.from("ai_usage").insert({ user_id: userId, ip_hash: userId ? null : ipHash, feature });
}
