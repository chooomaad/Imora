"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MediaItem } from "@/types/models";

/** Swipeable hero gallery with a fullscreen viewer. Overlays (badges, title) are passed as children. */
export function Gallery({ media, title, children }: { media: MediaItem[]; title: string; children?: React.ReactNode }) {
  const t = useTranslations("property");
  const images = media.filter((m) => m.kind === "image" && m.url);
  const videos = media.filter((m) => m.kind === "video" && m.url);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };
  const go = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * el.clientWidth * (rtl ? -1 : 1), behavior: "smooth" });
  };

  return (
    <div className="relative overflow-hidden bg-surface-2 sm:rounded-[28px]">
      <div ref={track} onScroll={onScroll} className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto scrollbar-none sm:aspect-[16/9]">
        {images.map((m, i) => (
          <button key={m.id} type="button" onClick={() => setFull(i)} className="relative h-full w-full shrink-0 snap-center" aria-label={`${title} — ${i + 1}/${images.length}`}>
            <Image src={m.url!} alt={m.caption ?? title} fill priority={i === 0} sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover" />
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="absolute start-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow sm:grid" aria-label="Précédent">
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => go(1)} className="absolute end-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow sm:grid" aria-label="Suivant">
            <ChevronRight className="size-5 rtl:rotate-180" />
          </button>
        </>
      )}
      <span className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur ltr-nums">
        <Images className="size-3.5" /> {t("photos", { current: Math.min(index + 1, images.length), total: images.length + videos.length })}
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">{children}</div>

      {full != null && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm ltr-nums">{full + 1} / {images.length}</span>
            <button type="button" onClick={() => setFull(null)} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="Fermer"><X className="size-5" /></button>
          </div>
          <div className="relative flex-1">
            <Image src={images[full].url!} alt={images[full].caption ?? title} fill sizes="100vw" className="object-contain" />
            <button type="button" onClick={() => setFull((f) => (f! - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white" aria-label="Précédent"><ChevronLeft className="rtl:rotate-180" /></button>
            <button type="button" onClick={() => setFull((f) => (f! + 1) % images.length)} className="absolute end-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white" aria-label="Suivant"><ChevronRight className="rtl:rotate-180" /></button>
          </div>
          {videos.length > 0 && (
            <div className="flex gap-3 overflow-x-auto p-4">
              {videos.map((v) => (
                <video key={v.id} src={v.url!} controls preload="metadata" className="h-40 rounded-xl" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
