import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const APP_ROUTES = [
  "/dashboard",
  "/keuangan",
  "/sdm",
  "/inventaris",
  "/pembelian-penjualan",
  "/crm",
  "/aset",
  "/pengaturan",
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/login");
  const isAppRoute =
    pathname === "/" || APP_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
