import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import type { PropertyCard as Card } from "@imora/shared";
import { Header } from "@/components/Header";
import { PropertyCard } from "@/components/PropertyCard";
import { H2 } from "@/components/ui";
import { searchProperties } from "@/lib/api";
import { isConfigured } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

export default function Tours() {
  const c = useColors();
  const t = useTranslations("tour");
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    if (isConfigured) void searchProperties({ has_360: true }, 0, 30).then((r) => setItems(r.items));
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        ListHeaderComponent={<View style={{ gap: 4 }}><H2>{t("listTitle")}</H2><Text style={{ color: c.muted, fontFamily: fonts.body }}>{t("listSubtitle")}</Text></View>}
        renderItem={({ item }) => <PropertyCard p={item} />}
      />
    </View>
  );
}
