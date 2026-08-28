import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/constants";

function loginRedirect(request, reason) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", reason);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export function proxy(request) {
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (isAdminRoute && !hasSessionCookie) {
    return loginRedirect(request, "authentication-required");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
