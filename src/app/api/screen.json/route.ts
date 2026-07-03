import { NextRequest } from "next/server";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  return Response.json(await getDashboardData(), {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
