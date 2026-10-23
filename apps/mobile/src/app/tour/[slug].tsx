import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "use-intl";
import { X } from "lucide-react-native";
import { WEB_URL } from "@/lib/supabase";

/**
 * Immersive 360°/3D tour. The Three.js engine (panorama, dollhouse, WebXR, gyroscope)
 * is shared with the web app and embedded here, so both platforms get the same experience.
 */
export default function TourScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const prefix = locale === "ar" ? "/ar" : "";
  return (
    <View style={{ flex: 1, backgroundColor: "#0d0c0a" }}>
      <WebView
        source={{ uri: `${WEB_URL}${prefix}/property/${slug}/tour` }}
        style={{ flex: 1, marginTop: insets.top }}
        allowsInlineMediaPlayback
        javaScriptEnabled
        onLoadEnd={() => setLoading(false)}
        // Only stay inside Imora; open anything else in the system browser
        originWhitelist={[WEB_URL]}
      />
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#e8c66d" size="large" />}
      <Pressable onPress={() => router.back()} style={[s.close, { top: insets.top + 12 }]} accessibilityLabel="Fermer">
        <X size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  close: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
