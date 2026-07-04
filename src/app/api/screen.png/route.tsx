import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { ScreenView } from "@/components/screen-view";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { parseDeviceStatus } from "@/lib/device-status";
import { getHomePhotoSrc } from "@/lib/home-photo";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/screen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isPhotoPage(page: number) {
  void page;
  return false;
}

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
  const data = await getDashboardData({ forceRefresh });
  const deviceStatus = parseDeviceStatus(request.nextUrl.searchParams);
  const photoSrc = await getHomePhotoSrc();
  const preservePhotoTone = isPhotoPage(deviceStatus.page);

  const png = new ImageResponse(
    <ScreenView data={data} deviceStatus={deviceStatus} photoSrc={photoSrc} />,
    {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    }
  );
  const pngBuffer = Buffer.from(await png.arrayBuffer());
  const outputBuffer = preservePhotoTone
    ? pngBuffer
    : await sharp(pngBuffer)
      .flatten({ background: "#ffffff" })
      .grayscale()
      .linear(1.24, -18)
      .threshold(148)
      .png()
      .toBuffer();

  return new Response(outputBuffer, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "image/png"
    }
  });
}
