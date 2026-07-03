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

const BYTES_PER_ROW = SCREEN_WIDTH / 8;
const BLACK_THRESHOLD = 205;
const BAYER_8X8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21
] as const;

function orderedDitherThreshold(x: number, y: number) {
  return 72 + BAYER_8X8[(y & 7) * 8 + (x & 7)] * 2;
}

function packMonoBitmap(grayscale: Buffer, dither: boolean) {
  const packed = Buffer.alloc(BYTES_PER_ROW * SCREEN_HEIGHT);

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const luminance = grayscale[y * SCREEN_WIDTH + x];
      const threshold = dither ? orderedDitherThreshold(x, y) : BLACK_THRESHOLD;
      if (luminance < threshold) {
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
  const photoSrc = await getHomePhotoSrc();
  const ditherPhoto = deviceStatus.page === 5;
  const png = new ImageResponse(
    <ScreenView data={data} deviceStatus={deviceStatus} photoSrc={photoSrc} />,
    {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT
    }
  );

  const pngBuffer = Buffer.from(await png.arrayBuffer());
  const image = sharp(pngBuffer).flatten({ background: "#ffffff" }).grayscale();
  const grayscale = await (ditherPhoto ? image.linear(1.12, 18) : image).raw().toBuffer();
  const bitmap = packMonoBitmap(grayscale, ditherPhoto);

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
