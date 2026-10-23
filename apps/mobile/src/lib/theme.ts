import { useColorScheme } from "react-native";

/** Imora tokens — mirrors apps/web/src/app/globals.css */
const light = {
  bg: "#faf8f4", surface: "#ffffff", surface2: "#f4efe7", surface3: "#ece5d9",
  ink: "#111110", ink2: "#2b2925", muted: "#706858", subtle: "#a39a8a", line: "#ebe4d8",
  gold: "#7d5f14", goldBright: "#c9a246", goldLight: "#f6dc98", goldSoft: "#f8f0dc",
  green: "#1d4a37", greenSoft: "#e6efe9", danger: "#b4321f", onInk: "#ffffff",
};
const dark: typeof light = {
  bg: "#0d0c0a", surface: "#171512", surface2: "#201d19", surface3: "#2a2621",
  ink: "#f4efe6", ink2: "#ddd6ca", muted: "#a69d8e", subtle: "#776f63", line: "#2d2924",
  gold: "#d7b35f", goldBright: "#e8c66d", goldLight: "#3a3020", goldSoft: "#26211a",
  green: "#7cc0a0", greenSoft: "#1b2a23", danger: "#f08a78", onInk: "#0d0c0a",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_400Regular_Italic",
  body: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
};

export const radius = { card: 20, xl: 16, pill: 999 };
