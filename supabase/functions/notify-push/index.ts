// Fan-out of in-app notifications to Expo push (mobile).
// Wire it as a Database Webhook on INSERT into public.notifications
// (Supabase Dashboard > Database > Webhooks), with header x-webhook-secret.
import { HttpError, handle, json } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: { id: string; user_id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null };
}

Deno.serve(handle(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) throw new HttpError(401, "unauthorized");
  const payload = (await req.json()) as WebhookPayload;
  if (payload.table !== "notifications" || payload.type !== "INSERT") return json(req, { skipped: true });

  const n = payload.record;
  const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", n.user_id).in("platform", ["ios", "android"]);
  if (!tokens?.length) return json(req, { sent: 0 });

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: n.title, body: n.body ?? undefined, data: { ...n.data, type: n.type, notification_id: n.id }, sound: "default" }))),
  });
  const result = await res.json().catch(() => ({}));

  // Clean up tokens Expo reports as unregistered
  const tickets = (result?.data ?? []) as { status: string; details?: { error?: string } }[];
  const dead = tickets.map((t, i) => (t.details?.error === "DeviceNotRegistered" ? tokens[i].token : null)).filter(Boolean) as string[];
  if (dead.length) await admin.from("push_tokens").delete().in("token", dead);

  return json(req, { sent: tokens.length - dead.length });
}));
