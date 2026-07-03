import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const PREVIEW_SESSION_COOKIE = "eink_preview_session";

type DeviceAuthError = {
  status: 401 | 500;
  message: string;
};

function bearerTokenFromHeader(header: string | null): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export function getBearerToken(header: string | null): string | null {
  return bearerTokenFromHeader(header);
}

export function getDeviceAuthError(token: string | null): DeviceAuthError | null {
  const expectedToken = process.env.DEVICE_AUTH_TOKEN;

  if (!expectedToken) {
    return {
      status: 500,
      message: "DEVICE_AUTH_TOKEN is not configured"
    };
  }

  if (!token) {
    return {
      status: 401,
      message: "Unauthorized"
    };
  }

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(token);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      status: 401,
      message: "Unauthorized"
    };
  }

  return null;
}

export function createPreviewSessionToken(): string | null {
  const expectedToken = process.env.DEVICE_AUTH_TOKEN;

  if (!expectedToken) {
    return null;
  }

  return createHmac("sha256", expectedToken).update("eink-preview-session-v1").digest("hex");
}

export function getPreviewSessionAuthError(sessionToken: string | null): DeviceAuthError | null {
  const expectedSessionToken = createPreviewSessionToken();

  if (!expectedSessionToken) {
    return {
      status: 500,
      message: "DEVICE_AUTH_TOKEN is not configured"
    };
  }

  if (!sessionToken) {
    return {
      status: 401,
      message: "Unauthorized"
    };
  }

  const expected = Buffer.from(expectedSessionToken);
  const actual = Buffer.from(sessionToken);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      status: 401,
      message: "Unauthorized"
    };
  }

  return null;
}

export function getRequestToken(request: NextRequest): string | null {
  const bearerToken = bearerTokenFromHeader(request.headers.get("authorization"));
  const queryToken = request.nextUrl.searchParams.get("token");

  return bearerToken ?? queryToken;
}

export function assertDeviceAuth(request: NextRequest): Response | null {
  const authError = getDeviceAuthError(getRequestToken(request));

  if (authError) {
    return Response.json({ error: authError.message }, { status: authError.status });
  }

  return null;
}
