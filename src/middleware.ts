import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedMethods = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

export function middleware(request: NextRequest) {
  if (allowedMethods.has(request.method)) return NextResponse.next();

  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET, HEAD, POST, OPTIONS"
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
