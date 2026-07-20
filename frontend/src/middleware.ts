import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // access_token または csrf_token をセッションのヒントとする
  const hasToken = request.cookies.has("access_token");

  // /login ページへのアクセス
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 静的ファイルやAPIリクエストなどはスキップ
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 認証が必要なページ（/dashboard や /events など）
  if (pathname === "/" || pathname.startsWith("/dashboard") || pathname.startsWith("/events")) {
    if (!hasToken) {
      // 未ログインならログインページへ
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
