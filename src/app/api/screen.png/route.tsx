import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { ScreenView } from "@/components/screen-view";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { parseDeviceStatus } from "@/lib/device-status";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/screen";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
  const data = await getDashboardData({ forceRefresh });
  const deviceStatus = parseDeviceStatus(request.nextUrl.searchParams);

  return new ImageResponse(
    <ScreenView data={data} deviceStatus={deviceStatus} />,
    {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
