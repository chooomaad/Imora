import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the Imora design tokens so e.g. "bg-ink" and "bg-white" conflict correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["bg", "surface", "surface-2", "surface-3", "ink", "ink-2", "muted", "subtle", "line", "gold", "gold-strong", "gold-bright", "gold-light", "gold-soft", "green", "green-soft", "danger", "danger-soft", "on-ink"],
      radius: ["card", "xl2"],
      shadow: ["soft", "lift", "pin"],
    },
  },
});

/** Join class names and resolve Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
