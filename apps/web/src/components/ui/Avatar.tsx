import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export function Avatar({ name, src, size = 40, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gold-soft font-semibold text-gold", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        // Avatars can come from any OAuth provider: plain <img> avoids next/image domain allow-listing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />
      ) : initials ? (
        initials
      ) : (
        <UserRound className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
