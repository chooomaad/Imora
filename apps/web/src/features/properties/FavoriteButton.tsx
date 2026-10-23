"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCollections } from "@/providers/CollectionsProvider";
import { cn } from "@/lib/cn";

export function FavoriteButton({ propertyId, className, size = "md" }: { propertyId: string; className?: string; size?: "sm" | "md" }) {
  const { favorites, toggleFavorite } = useCollections();
  const t = useTranslations("favorites");
  const active = favorites.has(propertyId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavorite(propertyId);
      }}
      aria-pressed={active}
      aria-label={active ? t("remove") : t("add")}
      className={cn(
        "grid place-items-center rounded-full bg-surface/95 text-ink shadow-soft backdrop-blur transition active:scale-90",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      <Heart className={cn(size === "sm" ? "size-4" : "size-5", active && "fill-danger text-danger")} strokeWidth={1.9} />
    </button>
  );
}
