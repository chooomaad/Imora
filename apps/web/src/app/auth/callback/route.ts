import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** OAuth / magic-link / e-mail confirmation callback: exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const locale = url.searchParams.get("locale") === "ar" ? "/ar" : "";

  const response = NextResponse.redirect(new URL(`${locale}${next}`, url.origin));
  if (!code) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(`${locale}/login`, url.origin));

  // First login: send the user to role selection
  const { data: profile } = await supabase.from("profiles").select("role_selected").eq("id", data.user.id).maybeSingle();
  if (!profile?.role_selected) {
    response.headers.set("Location", new URL(`${locale}/onboarding?next=${encodeURIComponent(next)}`, url.origin).toString());
  }
  return response;
}
