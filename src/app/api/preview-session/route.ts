import { NextRequest, NextResponse } from "next/server";
import {
  PREVIEW_SESSION_COOKIE,
  createPreviewSessionToken,
  getDeviceAuthError
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : null;
  const authError = getDeviceAuthError(token);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status });
  }

  const sessionToken = createPreviewSessionToken();

  if (!sessionToken) {
    return NextResponse.json(
      { error: "DEVICE_AUTH_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(new URL("/preview", request.url), {
    status: 303
  });

  response.cookies.set(PREVIEW_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/preview",
    maxAge: 60 * 60
  });

  return response;
}
