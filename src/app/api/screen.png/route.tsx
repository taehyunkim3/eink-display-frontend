import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { ScreenView } from "@/components/screen-view";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { parseDeviceStatus } from "@/lib/device-status";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const data = await getDashboardData();
  const deviceStatus = parseDeviceStatus(request.nextUrl.searchParams);

  return new ImageResponse(
    <ScreenView data={data} deviceStatus={deviceStatus} />,
    {
      width: 800,
      height: 480,
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
