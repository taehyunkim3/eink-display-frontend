import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { ScreenView } from "@/components/screen-view";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { parseDeviceStatus } from "@/lib/device-status";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/screen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BYTES_PER_ROW = SCREEN_WIDTH / 8;
const BLACK_THRESHOLD = 205;

function packMonoBitmap(grayscale: Buffer) {
  const packed = Buffer.alloc(BYTES_PER_ROW * SCREEN_HEIGHT);

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const luminance = grayscale[y * SCREEN_WIDTH + x];
      if (luminance < BLACK_THRESHOLD) {
        packed[y * BYTES_PER_ROW + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return packed;
}

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
  const data = await getDashboardData({ forceRefresh });
  const deviceStatus = parseDeviceStatus(request.nextUrl.searchParams);
  const png = new ImageResponse(<ScreenView data={data} deviceStatus={deviceStatus} />, {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT
  });

  const pngBuffer = Buffer.from(await png.arrayBuffer());
  const grayscale = await sharp(pngBuffer)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer();
  const bitmap = packMonoBitmap(grayscale);

  return new Response(bitmap, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(bitmap.length),
      "Content-Type": "application/octet-stream",
      "X-Screen-Format": "1bpp-msb",
      "X-Screen-Height": String(SCREEN_HEIGHT),
      "X-Screen-Width": String(SCREEN_WIDTH)
    }
  });
}
