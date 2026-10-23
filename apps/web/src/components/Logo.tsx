import { cn } from "@/lib/cn";

/**
 * Imora mark, reproduced from the design references (dark tile, gold house).
 * Replace with the official asset in /public/brand when it is delivered.
 */
export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="Imora">
      <defs>
        <linearGradient id="imora-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1D58C" />
          <stop offset="1" stopColor="#B88A2E" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#111110" />
      <path d="M12 22.5 24 12l12 10.5V35a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 12 35V22.5Z" fill="none" stroke="url(#imora-gold)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M19.5 36.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" fill="none" stroke="url(#imora-gold)" strokeWidth="2.2" />
      <circle cx="24" cy="21" r="2.6" fill="none" stroke="url(#imora-gold)" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold tracking-tight text-ink">Imora</span>
          <span className="font-arabic text-[13px] font-semibold text-gold" lang="ar">إيمورا</span>
        </span>
      )}
    </span>
  );
}
