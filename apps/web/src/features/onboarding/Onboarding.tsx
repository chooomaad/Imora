"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Building2, KeyRound, LineChart, MapPin, Search, Sparkles, Waves } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LogoMark } from "@/components/Logo";
import { Icon3D, Icon360 } from "@/components/icons";
import { cn } from "@/lib/cn";
import { WaveCanvas, type WaveHandle } from "./WaveCanvas";

export const INTRO_DONE_KEY = "imora-intro-done";
const STEP_KEY = "imora-intro-step";
const STEPS = 4;
const PANO_DEMO = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1800&q=70&auto=format&fit=crop";

/** Clears the "seen" flag so the intro shows again (profile > "Revoir l'introduction"). */
export function resetIntro() {
  try {
    localStorage.removeItem(INTRO_DONE_KEY);
    sessionStorage.removeItem(STEP_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Interactive 360° preview: drag the room left/right (infinite loop with inertia). */
function PanoDemo() {
  const t = useTranslations("intro");
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; last: number; v: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    // Gentle auto-rotation until the user touches it
    let alive = true;
    const spin = () => {
      if (!alive) return;
      if (!drag.current) setOffset((o) => o - 0.35);
      raf.current = requestAnimationFrame(spin);
    };
    raf.current = requestAnimationFrame(spin);
    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      className="relative mx-auto aspect-square w-[min(68vw,300px)] cursor-grab touch-none select-none overflow-hidden rounded-full shadow-[0_30px_80px_-20px_rgba(17,80,92,0.55)] ring-8 ring-white/70 active:cursor-grabbing"
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, last: e.clientX, v: 0 };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.last;
        drag.current.last = e.clientX;
        drag.current.v = dx;
        setOffset((o) => o + dx * 1.6);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        let v = (drag.current?.v ?? 0) * 1.6;
        drag.current = null;
        const glide = () => {
          if (Math.abs(v) < 0.2) return;
          setOffset((o) => o + v);
          v *= 0.94;
          requestAnimationFrame(glide);
        };
        glide();
      }}
      role="img"
      aria-label={t("panoHint")}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${PANO_DEMO})`,
          backgroundColor: "#d9cdb8",
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
          backgroundPositionX: `${offset}px`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_55%,rgba(0,0,0,0.35))]" />
      <span className="absolute inset-x-0 bottom-5 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
        <Icon360 size={15} /> {t("panoHint")}
      </span>
    </div>
  );
}

/** The AI search writes itself, then the understood filters pop in. */
function AiDemo({ active }: { active: boolean }) {
  const t = useTranslations("intro");
  const query = t("aiQuery");
  const [typed, setTyped] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!active) return;
    setTyped(0);
    const id = setInterval(() => setTyped((n) => (n >= query.length ? n : n + 1)), 28);
    return () => clearInterval(id);
  }, [active, query, run]);

  const done = typed >= query.length;
  const chips = [
    { icon: <MapPin className="size-3.5" />, label: t("aiChip1") },
    { icon: <Building2 className="size-3.5" />, label: t("aiChip2") },
    { icon: <Waves className="size-3.5" />, label: t("aiChip3") },
    { icon: <Sparkles className="size-3.5" />, label: t("aiChip4") },
  ];

  return (
    <div className="mx-auto w-full max-w-sm rounded-[24px] border border-white/15 bg-white/10 p-4 text-start shadow-2xl backdrop-blur-md" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#e8c66d]">
        <Sparkles className="size-4" /> Imora AI
      </div>
      <p className="mt-3 min-h-[72px] text-[15px] italic leading-relaxed text-white/90">
        “{query.slice(0, typed)}
        <span className={cn("ms-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-[#e8c66d]", done ? "opacity-0" : "animate-pulse")} />
        {done && "”"}
      </p>
      <div className="mt-3 flex min-h-[64px] flex-wrap gap-1.5">
        {done &&
          chips.map((c, i) => (
            <span key={c.label} style={{ animationDelay: `${i * 140}ms` }}
              className="inline-flex animate-[chip-pop_.45s_cubic-bezier(.2,1.4,.4,1)_both] items-center gap-1 rounded-full bg-[#f6dc98] px-2.5 py-1 text-[12px] font-semibold text-[#16130d]">
              {c.icon}{c.label}
            </span>
          ))}
      </div>
      <button type="button" onClick={() => setRun((r) => r + 1)} className="mt-2 text-[12px] font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline">
        {t("replay")}
      </button>
    </div>
  );
}

export function Onboarding() {
  const t = useTranslations("intro");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const wave = useRef<WaveHandle>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_DONE_KEY)) {
        new Image().src = PANO_DEMO; // preload the 360° demo while the user reads step 1
        setStep(Number(sessionStorage.getItem(STEP_KEY) ?? 0) || 0);
        setVisible(true);
      }
    } catch {
      /* storage blocked: skip the intro */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(STEP_KEY, String(step));
    } catch {
      /* ignore */
    }
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [visible, step]);

  const go = useCallback((n: number) => setStep(Math.max(0, Math.min(STEPS - 1, n))), []);

  const finish = useCallback((href?: string) => {
    try {
      localStorage.setItem(INTRO_DONE_KEY, "1");
      sessionStorage.removeItem(STEP_KEY);
    } catch {
      /* ignore */
    }
    wave.current?.swell();
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      if (href) router.push(href);
    }, 650);
  }, [router]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      const rtl = document.dir === "rtl";
      if (e.key === "ArrowRight") go(step + (rtl ? -1 : 1));
      if (e.key === "ArrowLeft") go(step + (rtl ? 1 : -1));
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, step, go, finish]);

  if (!visible) return null;

  const dark = step === 2;
  const switchLocale = (l: "fr" | "ar") => {
    if (l !== locale) router.replace(pathname, { locale: l });
  };

  const intents = [
    { key: "buy", icon: <Search className="size-5" />, href: "/explore?listing_type=sale" },
    { key: "rent", icon: <KeyRound className="size-5" />, href: "/explore?listing_type=rent" },
    { key: "invest", icon: <LineChart className="size-5" />, href: "/invest" },
    { key: "publish", icon: <Building2 className="size-5" />, href: "/dashboard/listings/new" },
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("welcomeTitle")}
      className={cn("fixed inset-0 z-[100] overflow-hidden transition-[opacity,transform] duration-700", leaving ? "pointer-events-none scale-[1.04] opacity-0" : "opacity-100")}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (!swipe.current) return;
        const dx = e.clientX - swipe.current.x;
        const dy = e.clientY - swipe.current.y;
        swipe.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          const rtl = document.dir === "rtl";
          go(step + ((dx < 0) !== rtl ? 1 : -1));
        }
      }}
    >
      <WaveCanvas ref={wave} step={step} total={STEPS} />

      <div className={cn("relative flex h-full flex-col px-6 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)] transition-colors duration-700", dark ? "text-white" : "text-ink")}>
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark size={32} />
            <span className="text-[19px] font-semibold tracking-tight">Imora</span>
          </span>
          {step < STEPS - 1 && (
            <button type="button" onClick={() => finish()} className={cn("rounded-full px-4 py-2 text-[13.5px] font-semibold backdrop-blur", dark ? "bg-white/10 hover:bg-white/20" : "bg-white/50 hover:bg-white/80")}>
              {t("skip")}
            </button>
          )}
        </div>

        {/* Slides */}
        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-[18vh]">
          <div key={step} className="flex flex-col items-center gap-6 text-center [&>*]:animate-[intro-rise_.7s_cubic-bezier(.2,.8,.2,1)_both] [&>*:nth-child(2)]:[animation-delay:.08s] [&>*:nth-child(3)]:[animation-delay:.16s] [&>*:nth-child(4)]:[animation-delay:.24s]">
            {step === 0 && (
              <>
                <div className="relative">
                  <span className="absolute inset-0 animate-ping rounded-[22px] bg-[#c9a246]/30 [animation-duration:2.4s]" />
                  <LogoMark size={92} className="relative drop-shadow-[0_18px_30px_rgba(125,95,20,0.45)]" />
                </div>
                <h1 className="font-display text-[42px] leading-[1.05] sm:text-[56px]">
                  {t("welcomeTitle")} <em className="font-normal italic text-gold">Imora</em>
                </h1>
                <p className="max-w-md text-[16px] leading-relaxed text-muted">{t("welcomeText")}</p>
                <div className="flex gap-3" onPointerDown={(e) => e.stopPropagation()}>
                  {(["fr", "ar"] as const).map((l) => (
                    <button key={l} type="button" onClick={() => switchLocale(l)} aria-pressed={locale === l}
                      className={cn("h-12 min-w-28 rounded-2xl px-5 text-[15px] font-semibold transition", locale === l ? "bg-ink text-on-ink shadow-lift" : "bg-white/70 text-ink backdrop-blur hover:bg-white")}>
                      {l === "fr" ? "Français" : "العربية"}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <PanoDemo />
                <h2 className="font-display text-[34px] leading-tight sm:text-[44px]">{t("tourTitle")}</h2>
                <p className="max-w-md text-[15.5px] leading-relaxed text-ink-2/80">{t("tourText")}</p>
              </>
            )}

            {step === 2 && (
              <>
                <AiDemo active={step === 2} />
                <h2 className="font-display text-[34px] leading-tight sm:text-[44px]">{t("aiTitle")}</h2>
                <p className="max-w-md text-[15.5px] leading-relaxed text-white/70">{t("aiText")}</p>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-display text-[34px] leading-tight sm:text-[44px]">{t("intentTitle")}</h2>
                <p className="max-w-md text-[15.5px] text-muted">{t("intentText")}</p>
                <div className="grid w-full grid-cols-2 gap-3" onPointerDown={(e) => e.stopPropagation()}>
                  {intents.map((it, i) => (
                    <button key={it.key} type="button" onClick={() => finish(it.href)} style={{ animationDelay: `${0.25 + i * 0.07}s` }}
                      className="group flex animate-[intro-rise_.6s_cubic-bezier(.2,.8,.2,1)_both] flex-col items-start gap-3 rounded-[22px] bg-white/80 p-4 text-start shadow-soft backdrop-blur transition hover:-translate-y-1 hover:bg-white hover:shadow-lift">
                      <span className="grid size-11 place-items-center rounded-2xl bg-gold-soft text-gold transition group-hover:bg-gold group-hover:text-white">{it.icon}</span>
                      <span className="text-[15.5px] font-semibold text-ink">{t(`intent.${it.key}`)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom controls (over the waves) */}
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" role="tablist" aria-label={t("progress")}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === step} aria-label={`${i + 1}/${STEPS}`} onClick={() => go(i)}
                className={cn("h-2.5 rounded-full transition-all duration-500", i === step ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80")} />
            ))}
          </div>
          {step < STEPS - 1 ? (
            <button type="button" onClick={() => go(step + 1)}
              className="group relative flex h-14 items-center gap-2 overflow-hidden rounded-full bg-white px-6 text-[15px] font-semibold text-[#111] shadow-lift">
              <span className="absolute inset-0 origin-left scale-x-0 bg-[#f6dc98] transition-transform duration-500 group-hover:scale-x-100 rtl:origin-right" />
              <span className="relative">{step === 0 ? t("start") : t("next")}</span>
              <ArrowRight className="relative size-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </button>
          ) : (
            <button type="button" onClick={() => finish()} className="flex h-14 items-center gap-2 rounded-full bg-white/90 px-6 text-[15px] font-semibold text-[#111] shadow-lift">
              <Icon3D size={18} /> {t("explore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
