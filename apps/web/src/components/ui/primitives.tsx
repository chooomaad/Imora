import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { BadgeCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ Card */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line/70 bg-surface shadow-soft", className)} {...props} />;
}

/* ----------------------------------------------------------------- Badge */
type BadgeVariant = "light" | "gold" | "dark" | "soft" | "green" | "demo" | "outline";
const badgeVariants: Record<BadgeVariant, string> = {
  light: "bg-surface/95 text-ink backdrop-blur border border-line/60",
  gold: "bg-gold text-white dark:text-[#16130d]",
  dark: "bg-ink/90 text-on-ink backdrop-blur",
  soft: "bg-gold-soft text-gold border border-gold/15",
  green: "bg-green-soft text-green",
  demo: "bg-[#fff4d6] text-[#7a5a00] border border-[#e9cf86] dark:bg-[#3a2f12] dark:text-[#f0d27a] dark:border-[#5a4718]",
  outline: "border border-line text-muted bg-surface",
};

export function Badge({ variant = "light", className, icon, children }: { variant?: BadgeVariant; className?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none", badgeVariants[variant], className)}>
      {icon}
      {children}
    </span>
  );
}

export function VerifiedIcon({ className }: { className?: string }) {
  return <BadgeCheck className={cn("size-3.5 text-green", className)} aria-hidden />;
}

/* --------------------------------------------------------------- Eyebrow */
export function Eyebrow({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-gold", className)}>
      {icon}
      {children}
    </p>
  );
}

export function SectionTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("font-display text-[28px] leading-tight text-ink sm:text-[32px]", className)}>{children}</h2>;
}

/* ---------------------------------------------------------------- Inputs */
const fieldBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-subtle outline-none transition focus:border-gold-bright focus:ring-3 focus:ring-gold-bright/20 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, "h-12 appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

/* ---------------------------------------------------------- Toggle chip */
export function Chip({ active, className, children, ...props }: { active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition",
        active ? "bg-ink text-on-ink shadow-soft" : "border border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------- Segmented control */
export function Segmented<T extends string>({
  value, onChange, options, className, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl px-3 font-semibold transition",
            size === "sm" ? "h-9 text-[13px]" : "h-11 text-sm",
            value === o.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Switch */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="text-[15px] text-ink">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-surface-3 transition peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold-bright" />
        <span className="absolute start-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

/* ------------------------------------------------------------- Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

/* ----------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-gold-soft text-gold">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}
