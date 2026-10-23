"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Postgres exceptions raised by our functions use the message as a machine code. */
export function errorCode(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  return /^[a-z_]+$/.test(msg) ? msg : "generic";
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseBrowser().rpc(fn, args);
  if (error) throw new Error(errorCode(error));
  return data as T;
}

export interface RevealedContact {
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_agency: boolean;
  agency_name: string | null;
}

export async function revealContact(propertyId: string): Promise<RevealedContact | null> {
  const rows = await rpc<RevealedContact[]>("reveal_contact", { p_property_id: propertyId });
  return rows?.[0] ?? null;
}

export const logContactEvent = (propertyId: string, event: "whatsapp_click" | "call_click") =>
  rpc<void>("log_contact_event", { p_property_id: propertyId, p_event: event }).catch(() => undefined);

export const startConversation = (propertyId: string, message: string) =>
  rpc<{ id: string }>("start_conversation", { p_property_id: propertyId, p_message: message });

export const requestVisit = (propertyId: string, date: string, time: string, notes?: string) =>
  rpc<{ id: string; date: string; time: string }>("request_visit", { p_property_id: propertyId, p_date: date, p_time: time, p_notes: notes ?? null });

export const updateVisitStatus = (visitId: string, status: string, reason?: string) =>
  rpc<unknown>("update_visit_status", { p_visit_id: visitId, p_status: status, p_reason: reason ?? null });

export async function getVisitSlots(): Promise<string[]> {
  return (await rpc<string[]>("visit_slots", {})) ?? [];
}

export async function getTakenSlots(propertyId: string, from: string, to: string) {
  return (await rpc<{ date: string; time: string }[]>("taken_visit_slots", { p_property_id: propertyId, p_from: from, p_to: to })) ?? [];
}

export const declareTransaction = (propertyId: string, type: "sale" | "rent", amount: number, counterpartyId?: string) =>
  rpc<{ id: string }>("declare_transaction", { p_property_id: propertyId, p_type: type, p_amount: amount, p_counterparty_id: counterpartyId ?? null });

export const confirmTransaction = (id: string, confirm: boolean, reason?: string) =>
  rpc<unknown>("confirm_transaction", { p_transaction_id: id, p_confirm: confirm, p_reason: reason ?? null });

export async function reportListing(reporterId: string, propertyId: string, reason: string, details: string) {
  const { error } = await getSupabaseBrowser().from("reports").insert({ reporter_id: reporterId, property_id: propertyId, reason, details: details || null });
  if (error) throw new Error(errorCode(error));
}

/** Anonymous per-tab session id used to de-duplicate view counts. */
export function recordView(propertyId: string, source?: string) {
  let sid = "";
  try {
    sid = sessionStorage.getItem("imora-sid") ?? crypto.randomUUID();
    sessionStorage.setItem("imora-sid", sid);
  } catch {
    sid = crypto.randomUUID();
  }
  void getSupabaseBrowser().rpc("record_property_view", { p_property_id: propertyId, p_session_id: sid, p_source: source ?? null });
}
