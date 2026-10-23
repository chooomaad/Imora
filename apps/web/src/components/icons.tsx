import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Cube inside scan corners — the "Visite 3D" pictogram used across the references. */
export function Icon3D({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5L12 7Z" />
      <path d="M7.5 9.5 12 12l4.5-2.5M12 12v5" />
    </svg>
  );
}

/** 360° rotation pictogram. */
export function Icon360({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <ellipse cx="12" cy="12" rx="9.5" ry="4.5" />
      <path d="m15 15.8 1.8 1-1 1.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
