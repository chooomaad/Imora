"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCollections } from "@/providers/CollectionsProvider";

export function CompareRemove({ id, ids }: { id: string; ids: string[] }) {
  const t = useTranslations("compare");
  const router = useRouter();
  const { compare, toggleCompare } = useCollections();
  return (
    <button
      type="button"
      className="mt-2 text-[12px] font-semibold text-muted hover:text-danger"
      onClick={() => {
        if (compare.includes(id)) toggleCompare(id);
        const rest = ids.filter((x) => x !== id);
        router.replace(rest.length ? `/compare?ids=${rest.join(",")}` : "/compare");
      }}
    >
      {t("remove")}
    </button>
  );
}
