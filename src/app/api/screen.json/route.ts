import { NextRequest } from "next/server";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";

  return Response.json(await getDashboardData({ forceRefresh }), {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
