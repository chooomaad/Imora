"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { APP_ROLES, PROPERTY_TYPES, formatPrice } from "@imora/shared";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Badge, Card, Field, Input, Select, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const TABS = ["moderation", "verifications", "reports", "transactions", "commissionRules", "users", "settings"] as const;
type Tab = (typeof TABS)[number];
type Row = Record<string, unknown> & { id: string };

/** All writes go through admin-only RLS policies or SECURITY DEFINER functions that re-check is_admin(). */
export function AdminConsole({ kpis }: { kpis: Record<string, number> }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const supabase = getSupabaseBrowser();
  const [tab, setTab] = useState<Tab>("moderation");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    const q = {
      moderation: () => supabase.from("properties").select("id, slug, title, reference, city, district, price, created_at, owner:profiles!properties_owner_id_fkey(full_name)").eq("status", "pending_review").order("created_at"),
      verifications: () => supabase.from("verifications").select("id, subject_type, subject_id, status, created_at, requester:profiles!verifications_requested_by_fkey(full_name)").eq("status", "pending").order("created_at"),
      reports: () => supabase.from("reports").select("id, reason, details, status, created_at, property:properties(slug, title)").in("status", ["open", "reviewing"]).order("created_at"),
      transactions: () => supabase.from("transactions").select("id, transaction_type, amount, status, commission_rate, commission_amount, created_at, property:properties(slug, title), payment:commission_payments(id, status, amount)").order("created_at", { ascending: false }).limit(100),
      commissionRules: () => supabase.from("commission_rules").select("*").order("created_at", { ascending: false }),
      users: () => supabase.from("profiles").select("id, full_name, role, is_verified, created_at").order("created_at", { ascending: false }).limit(200),
      settings: () => supabase.from("app_settings").select("key, value, description").order("key"),
    }[which];
    const { data } = await q();
    setRows(((data ?? []) as Row[]).map((r) => ({ ...r, id: (r.id as string) ?? (r.key as string) })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => void load(tab), [tab, load]);

  const act = async (fn: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await fn();
    if (error) toast(t("common.error"), "error");
    else await load(tab);
  };

  const kpiItems: [string, string, boolean?][] = [
    ["users", t("admin.users")], ["active_listings", t("admin.activeListings")], ["verified_listings", t("admin.verified")],
    ["leads", t("admin.leads")], ["visits", t("admin.visits")], ["sales", t("admin.sales")], ["rentals", t("admin.rentals")],
    ["transaction_volume", t("admin.volume"), true], ["commissions_total", t("admin.commissions"), true],
    ["commissions_paid", t("admin.commissionsPaid"), true], ["commissions_unpaid", t("admin.commissionsUnpaid"), true],
    ["subscription_revenue", t("admin.revenue"), true], ["disputes", t("admin.disputes")],
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpiItems.map(([k, label, money]) => (
          <Card key={k} className="p-4">
            <p className="text-[12px] text-muted">{label}</p>
            <p className="mt-1 text-[22px] font-bold leading-tight ltr-nums">{money ? `${formatPrice(kpis[k] ?? 0)}` : format.number(kpis[k] ?? 0)}{money && <span className="text-[12px] font-semibold text-muted"> MRU</span>}</p>
          </Card>
        ))}
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        {TABS.map((x) => (
          <button key={x} type="button" onClick={() => setTab(x)} className={cn("shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold", tab === x ? "bg-ink text-on-ink" : "border border-line bg-surface")}>
            {t(`admin.${x}`)}
            {x === "moderation" && kpis.pending_review ? ` (${kpis.pending_review})` : ""}
            {x === "verifications" && kpis.pending_verifications ? ` (${kpis.pending_verifications})` : ""}
            {x === "reports" && kpis.open_reports ? ` (${kpis.open_reports})` : ""}
          </button>
        ))}
      </div>

      <Card className={cn("divide-y divide-line", loading && "opacity-60")}>
        {tab === "moderation" && rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Link href={`/property/${r.slug}`} className="font-semibold hover:underline">{String(r.title)}</Link>
              <p className="text-[12.5px] text-muted ltr-nums">{String(r.reference)} · {formatPrice(Number(r.price))} MRU · {(r.owner as { full_name: string } | null)?.full_name}</p>
            </div>
            <Button size="sm" onClick={() => act(() => supabase.rpc("moderate_property", { p_property_id: r.id, p_status: "published", p_reason: null }))}><Check className="size-4" />{t("admin.publish")}</Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => act(() => supabase.rpc("moderate_property", { p_property_id: r.id, p_status: "rejected", p_reason: prompt(t("report.details")) ?? null }))}><X className="size-4" />{t("admin.reject")}</Button>
          </div>
        ))}

        {tab === "verifications" && rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{String(r.subject_type)} · <span className="text-[12px] text-muted">{String(r.subject_id).slice(0, 8)}</span></p>
              <p className="text-[12.5px] text-muted">{(r.requester as { full_name: string } | null)?.full_name}</p>
            </div>
            {r.subject_type === "documents" && <DocumentLinks propertyId={String(r.subject_id)} />}
            <Button size="sm" onClick={() => act(() => supabase.rpc("review_verification", { p_verification_id: r.id, p_approve: true, p_notes: null }))}>{t("admin.approve")}</Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => act(() => supabase.rpc("review_verification", { p_verification_id: r.id, p_approve: false, p_notes: prompt("Motif") ?? null }))}>{t("admin.reject")}</Button>
          </div>
        ))}

        {tab === "reports" && rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Link href={`/property/${(r.property as { slug: string } | null)?.slug}`} className="font-semibold hover:underline">{(r.property as { title: string } | null)?.title}</Link>
              <p className="text-[12.5px] text-muted">{t(`report.reasons.${r.reason}` as never)} — {String(r.details ?? "")}</p>
            </div>
            <Button size="sm" onClick={() => act(() => supabase.from("reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", r.id))}>{t("admin.resolve")}</Button>
            <Button size="sm" variant="ghost" onClick={() => act(() => supabase.from("reports").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", r.id))}>{t("admin.dismiss")}</Button>
          </div>
        ))}

        {tab === "transactions" && rows.map((r) => {
          const payment = (r.payment as { id: string; status: string; amount: number }[] | { id: string; status: string; amount: number } | null);
          const pay = Array.isArray(payment) ? payment[0] : payment;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{(r.property as { title: string } | null)?.title}</p>
                <p className="text-[12.5px] text-muted ltr-nums">
                  {t(`listingTypes.${r.transaction_type}` as never)} · {formatPrice(Number(r.amount))} MRU
                  {r.commission_amount != null && ` · ${t("admin.commissions")} ${formatPrice(Number(r.commission_amount))} MRU`}
                  {r.commission_rate != null && ` (${(Number(r.commission_rate) * 100).toFixed(2)}%)`}
                </p>
              </div>
              <Badge variant={r.status === "completed" ? "green" : "outline"}>{t(`transaction.status.${r.status}` as never)}</Badge>
              {pay && pay.status !== "paid" && (
                <Button size="sm" variant="gold" onClick={() => act(() => supabase.from("commission_payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", pay.id))}>{t("admin.markPaid")}</Button>
              )}
              {pay?.status === "paid" && <Badge variant="green">{t("admin.commissionsPaid")}</Badge>}
            </div>
          );
        })}

        {tab === "commissionRules" && (
          <>
            <NewRuleForm onCreated={() => load("commissionRules")} />
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{String(r.name)}</p>
                  <p className="text-[12.5px] text-muted">
                    {t(`listingTypes.${r.transaction_type}` as never)} · {r.property_type ? t(`propertyTypes.${r.property_type}` as never) : "*"} · {t(`admin.method.${r.method}` as never)} ·{" "}
                    {r.method === "percentage" ? `${(Number(r.rate) * 100).toFixed(2)}%` : r.method === "fixed" ? `${formatPrice(Number(r.fixed_amount))} MRU` : `${Number(r.rent_fraction)} × loyer`}
                  </p>
                </div>
                <Switch id={`rule-${r.id}`} label="" checked={Boolean(r.is_active)} onChange={(v) => void act(() => supabase.from("commission_rules").update({ is_active: v }).eq("id", r.id))} />
              </div>
            ))}
          </>
        )}

        {tab === "users" && rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 truncate font-medium">{String(r.full_name ?? r.id)}</p>
            <div className="w-48">
              <Select value={String(r.role)} onChange={(e) => void act(() => supabase.from("profiles").update({ role: e.target.value, role_selected: true }).eq("id", r.id))} className="h-10 text-[13px]">
                {APP_ROLES.map((role) => <option key={role} value={role}>{t(`profile.role.${role}`)}</option>)}
              </Select>
            </div>
          </div>
        ))}

        {tab === "settings" && rows.map((r) => <SettingRow key={r.id} k={String(r.key)} value={r.value} description={String(r.description ?? "")} onSaved={() => load("settings")} />)}

        {rows.length === 0 && !loading && tab !== "commissionRules" && <p className="px-5 py-8 text-center text-sm text-muted">{t("common.none")}</p>}
      </Card>
    </div>
  );
}

function DocumentLinks({ propertyId }: { propertyId: string }) {
  const [docs, setDocs] = useState<{ id: string; doc_type: string; storage_path: string }[]>([]);
  const supabase = getSupabaseBrowser();
  useEffect(() => {
    supabase.from("property_documents").select("id, doc_type, storage_path").eq("property_id", propertyId).then(({ data }) => setDocs(data ?? []));
  }, [propertyId, supabase]);
  return (
    <div className="flex gap-1.5">
      {docs.map((d) => (
        <button key={d.id} type="button" className="text-[12px] font-semibold text-gold underline"
          onClick={async () => { const { data } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60); if (data) window.open(data.signedUrl, "_blank", "noopener"); }}>
          {d.doc_type}
        </button>
      ))}
    </div>
  );
}

function NewRuleForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const [f, setF] = useState({ name: "", transaction_type: "sale", property_type: "", method: "percentage", value: "" });
  const submit = async () => {
    const v = Number(f.value.replace(",", "."));
    if (!f.name || !v) return;
    const { error } = await getSupabaseBrowser().from("commission_rules").insert({
      name: f.name, transaction_type: f.transaction_type, property_type: f.property_type || null, method: f.method,
      rate: f.method === "percentage" ? v / 100 : null,
      fixed_amount: f.method === "fixed" ? Math.round(v) : null,
      rent_fraction: f.method === "rent_fraction" ? v : null,
      priority: f.property_type ? 10 : 0,
    });
    if (error) return toast(t("common.error"), "error");
    setF({ ...f, name: "", value: "" });
    onCreated();
  };
  return (
    <div className="grid gap-3 bg-surface-2/50 px-5 py-4 sm:grid-cols-6 sm:items-end">
      <Field label="Nom" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label={t("filters.listingType")}>
        <Select value={f.transaction_type} onChange={(e) => setF({ ...f, transaction_type: e.target.value })}>
          <option value="sale">{t("listingTypes.sale")}</option><option value="rent">{t("listingTypes.rent")}</option>
        </Select>
      </Field>
      <Field label={t("filters.types")}>
        <Select value={f.property_type} onChange={(e) => setF({ ...f, property_type: e.target.value })}>
          <option value="">*</option>{PROPERTY_TYPES.map((p) => <option key={p} value={p}>{t(`propertyTypes.${p}`)}</option>)}
        </Select>
      </Field>
      <Field label="Méthode">
        <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          {(["percentage", "fixed", "rent_fraction"] as const).map((m) => <option key={m} value={m}>{t(`admin.method.${m}`)}</option>)}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Input placeholder={f.method === "percentage" ? "%" : f.method === "fixed" ? "MRU" : "×"} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <Button size="icon" onClick={submit} aria-label={t("admin.newRule")}><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

function SettingRow({ k, value, description, onSaved }: { k: string; value: unknown; description: string; onSaved: () => void }) {
  const t = useTranslations("common");
  const [text, setText] = useState(JSON.stringify(value));
  const save = async () => {
    try {
      const parsed = JSON.parse(text);
      await getSupabaseBrowser().from("app_settings").update({ value: parsed, updated_at: new Date().toISOString() }).eq("key", k);
      onSaved();
    } catch {
      alert("JSON invalide");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[13px] font-semibold">{k}</p>
        <p className="text-[12px] text-muted">{description}</p>
      </div>
      <Input className="h-10 w-64 font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" onClick={save}>{t("save")}</Button>
    </div>
  );
}
