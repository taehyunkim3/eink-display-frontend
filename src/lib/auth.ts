import type { NextRequest } from "next/server";

export function assertDeviceAuth(request: NextRequest): Response | null {
  const expectedToken = process.env.DEVICE_AUTH_TOKEN;

  if (!expectedToken) {
    return Response.json(
      { error: "DEVICE_AUTH_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = bearerToken ?? queryToken;

  if (token !== expectedToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
