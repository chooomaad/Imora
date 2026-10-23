"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Building, Check, Coins, MapPin, Sparkles, Waves } from "lucide-react";
import { filtersToSearchParams } from "@imora/shared";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { aiSearch, type AiSearchResult } from "@/services/ai";
import { describeFilters } from "@/features/search/describeFilters";

const CHIP_ICONS: Record<string, React.ReactNode> = {
  district: <MapPin className="size-3.5" />,
  city: <MapPin className="size-3.5" />,
  types: <Building className="size-3.5" />,
  pool: <Waves className="size-3.5" />,
  price_max: <Coins className="size-3.5" />,
};

/** "Recherche intelligente IA" — natural language → structured filters (via the ai-search edge function). */
export function AiSearchCard() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const q = query.trim() || t("ai.placeholder");
    if (q.length < 3) return setError(t("ai.tooShort"));
    if (!isSupabaseConfigured) return setError(t("ai.unavailable"));
    setLoading(true);
    setError(null);
    try {
      setResult(await aiSearch(q, locale));
    } catch (e) {
      setError((e as Error).message === "rate_limited" ? t("ai.rateLimited") : t("ai.unavailable"));
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    if (!result) return;
    router.push(`/explore?${filtersToSearchParams(result.filters).toString()}`);
  };

  const chips = result ? describeFilters(result.filters, t as never, locale) : [];

  return (
    <Card className="bg-surface-2/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold ring-1 ring-gold/15">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-bold text-ink">{t("ai.title")}</h2>
            <span className="rounded-md bg-gold-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">{t("ai.badge")}</span>
          </div>
          <p className="text-[13px] text-muted">{t("ai.subtitle")}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5">
        <label htmlFor="ai-query" className="sr-only">{t("ai.title")}</label>
        <textarea
          id="ai-query"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
          }}
          rows={3}
          maxLength={500}
          placeholder={`“${t("ai.placeholder")}”`}
          className="w-full resize-none bg-transparent text-[14.5px] italic leading-relaxed text-ink outline-none placeholder:text-ink-2/80"
        />
        {result && (
          <div className="mt-2 animate-fade-up border-t border-line pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <Check className="size-3.5 text-green" /> {t("ai.understood")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c.key + c.label}
                  className={c.key === "price_max" ? "inline-flex items-center gap-1 rounded-full bg-gold-light px-2.5 py-1 text-[12px] font-semibold text-ink"
                    : "inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2"}>
                  {CHIP_ICONS[c.key]}
                  {c.label}
                </span>
              ))}
            </div>
            {result.interpretation && <p className="mt-2 text-[12.5px] text-muted">{result.interpretation}</p>}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[13px] font-medium text-danger" role="alert">{error}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          {result && (
            <>
              <span className="size-2 animate-pulse rounded-full bg-gold-bright" />
              {t("ai.matching", { count: result.count })}
            </>
          )}
        </p>
        {result ? (
          <Button variant="gold" onClick={open} disabled={result.count === 0}>
            {t("search.explore", { count: result.count })}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        ) : (
          <Button variant="gold" onClick={run} loading={loading}>
            {loading ? t("ai.analyzing") : t("ai.launch")}
            {!loading && <ArrowRight className="size-4 rtl:rotate-180" />}
          </Button>
        )}
      </div>
    </Card>
  );
}
