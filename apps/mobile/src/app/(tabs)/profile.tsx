import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { BadgeCheck, LogOut } from "lucide-react-native";
import { Header } from "@/components/Header";
import { Button, Card } from "@/components/ui";
import { useLocaleSwitch } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { isConfigured, supabase } from "@/lib/supabase";
import { fonts, useColors } from "@/lib/theme";

export default function Profile() {
  const c = useColors();
  const t = useTranslations();
  const { session, profile, favorites } = useSession();
  const { locale, setLocale } = useLocaleSwitch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert(t("auth.invalidCredentials"));
  };
  const signUp = async () => {
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { locale } } });
    setLoading(false);
    Alert.alert(error ? error.message : data.session ? t("auth.title") : t("auth.checkEmail"));
  };

  const input = [s.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {!session ? (
          <Card style={{ gap: 12 }}>
            <Text style={[s.title, { color: c.ink }]}>{t("auth.title")}</Text>
            <Text style={{ color: c.muted, fontFamily: fonts.body }}>{t("auth.subtitle")}</Text>
            <TextInput style={input} placeholder={t("auth.email")} placeholderTextColor={c.subtle} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={input} placeholder={t("auth.password")} placeholderTextColor={c.subtle} secureTextEntry value={password} onChangeText={setPassword} />
            <Button title={t("auth.signIn")} onPress={signIn} loading={loading} disabled={!isConfigured} />
            <Button title={t("auth.signUp")} variant="secondary" onPress={signUp} disabled={!isConfigured || loading} />
          </Card>
        ) : (
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.title, { color: c.ink }]}>{profile?.full_name ?? session.user.email}</Text>
              {profile?.is_verified && <BadgeCheck size={20} color={c.gold} />}
            </View>
            {profile && <Text style={{ color: c.gold, fontFamily: fonts.bodySemibold }}>{t(`profile.role.${profile.role}`)}</Text>}
            <Text style={{ color: c.muted, fontFamily: fonts.body }}>{t("profile.myFavorites")} : {favorites.size}</Text>
          </Card>
        )}
        <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15 }}>{t("profile.language")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="FR" variant={locale === "fr" ? "primary" : "secondary"} onPress={() => setLocale("fr")} style={{ height: 40 }} />
            <Button title="AR" variant={locale === "ar" ? "primary" : "secondary"} onPress={() => setLocale("ar")} style={{ height: 40 }} />
          </View>
        </Card>
        {session && <Button title={t("auth.signOut")} variant="outline" icon={<LogOut size={16} color={c.danger} />} onPress={() => void supabase.auth.signOut()} />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 24 },
  input: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 15 },
});
