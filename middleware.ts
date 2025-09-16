import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-current-host", request.nextUrl.host);
  
  // For local development, automatically set the token cookie
  if (process.env.HF_TOKEN === "local_dev_token") {
    const token = request.cookies.get(MY_TOKEN_KEY());
    if (!token || token.value !== "local_dev_token") {
      const response = NextResponse.next({ headers });
      response.cookies.set({
        name: MY_TOKEN_KEY(),
        value: "local_dev_token",
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });
      return response;
    }
  }
  
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
