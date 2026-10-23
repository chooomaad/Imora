"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/cn";
import { useSession } from "@/providers/SessionProvider";
import { errorCode, getTakenSlots, getVisitSlots, requestVisit } from "@/services/engagement";

const DAYS = 14;

/** Local calendar date in Nouakchott (UTC+0, no DST) as YYYY-MM-DD. */
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function VisitBooking({ propertyId, isOwn }: { propertyId: string; isOwn: boolean }) {
  const t = useTranslations("visit");
  const tc = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const { requireAuth } = useSession();
  const [slots, setSlots] = useState<string[]>(["10:00", "11:30", "15:00", "17:00"]);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);

  const days = useMemo(() => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i + 1); // from tomorrow
      return d;
    });
  }, []);
  const [date, setDate] = useState(isoDay(days[0]));
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getVisitSlots().then((s) => s.length && setSlots(s)).catch(() => undefined);
    getTakenSlots(propertyId, isoDay(days[0]), isoDay(days[days.length - 1]))
      .then((rows) => setTaken(new Set(rows.map((r) => `${r.date}T${r.time.slice(0, 5)}`))))
      .catch(() => undefined);
  }, [propertyId, days]);

  const fmtDay = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr-FR", { weekday: "short", timeZone: "UTC" });
  const fmtMonth = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr-FR", { month: "long", timeZone: "UTC" });
  const fmtFull = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const submit = async () => {
    if (!time || !requireAuth()) return;
    setLoading(true);
    try {
      await requestVisit(propertyId, date, time, notes);
      setDone({ date, time });
      setTaken((s) => new Set(s).add(`${date}T${time}`));
    } catch (e) {
      const code = errorCode(e);
      const key = `errors.${code}` as const;
      toast(t.has(key as never) ? t(key as never) : tc("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (isOwn) return null;

  return (
    <Card id="visit" className="scroll-mt-24 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-gold"><CalendarDays className="size-5" /></span>
        <div>
          <h2 className="font-display text-[22px] leading-tight text-ink">{t("title")}</h2>
          <p className="text-[13px] text-muted">{t("subtitle")}</p>
        </div>
      </div>

      {done ? (
        <div className="mt-5 flex animate-fade-up items-start gap-3 rounded-2xl bg-green-soft p-4 text-green">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-medium">{t("confirmed", { date: fmtFull.format(new Date(`${done.date}T00:00:00Z`)), time: done.time })}</p>
        </div>
      ) : (
        <>
          <p className="mt-5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{t("selectDate")}</p>
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none" role="listbox" aria-label={t("selectDate")}>
            {days.map((d) => {
              const iso = isoDay(d);
              const active = iso === date;
              return (
                <button key={iso} type="button" role="option" aria-selected={active}
                  onClick={() => { setDate(iso); setTime(null); }}
                  className={cn("flex h-[86px] w-[88px] shrink-0 flex-col items-center justify-center rounded-2xl transition",
                    active ? "bg-ink text-on-ink shadow-soft" : "bg-surface-2 text-ink hover:bg-surface-3")}>
                  <span className={cn("text-[12px] font-semibold capitalize", active ? "text-on-ink/70" : "text-muted")}>{fmtDay.format(d)}</span>
                  <span className="text-[24px] font-bold leading-tight">{d.getUTCDate()}</span>
                  <span className={cn("text-[11.5px] capitalize", active ? "text-on-ink/70" : "text-muted")}>{fmtMonth.format(d)}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{t("timeSlot")}</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const isTaken = taken.has(`${date}T${s}`);
              return (
                <button key={s} type="button" disabled={isTaken} onClick={() => setTime(s)} aria-pressed={time === s}
                  className={cn("h-11 rounded-xl text-[14px] font-semibold transition ltr-nums disabled:cursor-not-allowed disabled:line-through disabled:opacity-40",
                    time === s ? "bg-ink text-on-ink" : "bg-surface-2 text-ink hover:bg-surface-3")}
                  title={isTaken ? t("taken") : undefined}>
                  {s}
                </button>
              );
            })}
          </div>

          <Textarea className="mt-4 min-h-16" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes")} maxLength={1000} />

          <Button className="mt-4 h-13 w-full" size="lg" disabled={!time} loading={loading} onClick={submit}>
            <CalendarCheck className="size-5" /> {t("confirm")}
          </Button>
        </>
      )}
    </Card>
  );
}
