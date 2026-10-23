import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

// Routes that require a session (checked again server-side and by RLS).
const PROTECTED = [/^\/(ar\/)?(dashboard|admin|messages|favorites|onboarding)(\/|$)/];

export async function middleware(request: NextRequest) {
  const response = intl(request);
  const { userId } = await refreshSession(request, response);

  if (!userId && PROTECTED.some((re) => re.test(request.nextUrl.pathname))) {
    const isAr = request.nextUrl.pathname.startsWith("/ar");
    const url = request.nextUrl.clone();
    url.pathname = `${isAr ? "/ar" : ""}/login`;
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|auth/callback|_next|_vercel|.*\\..*).*)"],
};
