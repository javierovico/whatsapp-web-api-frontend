import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || token.authError === "AUTH_INVALID") {
    const loginUrl = new URL("/login", req.url);
    const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|login).*)",
  ],
};
