import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";
import type { AppRole } from "@imora/shared";
import { isConfigured, supabase } from "./supabase";

interface Profile { id: string; full_name: string | null; avatar_url: string | null; role: AppRole; is_verified: boolean }

interface SessionValue {
  session: Session | null;
  profile: Profile | null;
  favorites: Set<string>;
  toggleFavorite: (propertyId: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ session: null, profile: null, favorites: new Set(), toggleFavorite: async () => false, refreshProfile: async () => {} });

/** Registers the Expo push token in push_tokens (fan-out done by the notify-push edge function). */
async function registerPush(userId: string) {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await supabase.from("push_tokens").upsert({ user_id: userId, token, platform: Platform.OS === "ios" ? "ios" : "android" }, { onConflict: "token" });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      setProfile(null);
      setFavorites(new Set());
      return;
    }
    const [{ data: p }, { data: favs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, role, is_verified").eq("id", uid).maybeSingle(),
      supabase.from("favorites").select("property_id"),
    ]);
    setProfile(p as Profile | null);
    setFavorites(new Set((favs ?? []).map((f) => f.property_id as string)));
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void refreshProfile();
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      void refreshProfile();
      if (event === "SIGNED_IN" && s) void registerPush(s.user.id).catch(() => undefined);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshProfile]);

  const toggleFavorite = useCallback(async (propertyId: string) => {
    const uid = session?.user.id;
    if (!uid) return false;
    const isFav = favorites.has(propertyId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
    const { error } = isFav
      ? await supabase.from("favorites").delete().eq("user_id", uid).eq("property_id", propertyId)
      : await supabase.from("favorites").insert({ user_id: uid, property_id: propertyId });
    if (error) await refreshProfile();
    return true;
  }, [session, favorites, refreshProfile]);

  return <Ctx.Provider value={{ session, profile, favorites, toggleFavorite, refreshProfile }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
