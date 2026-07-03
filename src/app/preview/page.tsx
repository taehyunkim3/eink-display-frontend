import { cookies, headers } from "next/headers";
import {
  PREVIEW_SESSION_COOKIE,
  getBearerToken,
  getDeviceAuthError,
  getPreviewSessionAuthError
} from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { previewDeviceStatus } from "@/lib/device-status";
import { formatGeneratedAt } from "@/lib/format";
import { PreviewScreen } from "@/components/preview-screen";

export const dynamic = "force-dynamic";

function PreviewAuthError({ status, message }: { status: number; message: string }) {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <section className="mx-auto flex max-w-2xl flex-col gap-4 border-2 border-neutral-900 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Preview
        </p>
        <h1 className="text-3xl font-bold">인증 필요</h1>
        <p className="text-sm text-neutral-700">
          실제 캘린더와 날씨가 포함된 미리보기는 기기 토큰이 있어야 볼 수 있습니다.
        </p>
        <form action="/api/preview-session" method="post" className="flex flex-col gap-3">
          <label className="text-sm font-semibold" htmlFor="token">
            Device token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            className="border-2 border-neutral-900 px-3 py-2 text-base"
            required
          />
          <button
            type="submit"
            className="border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
          >
            미리보기 열기
          </button>
        </form>
        <p className="border-t-2 border-neutral-900 pt-4 text-sm font-semibold">
          {status} · {message}
        </p>
      </section>
    </main>
  );
}

export default async function PreviewPage() {
  const headerList = await headers();
  const cookieStore = await cookies();
  const bearerToken = getBearerToken(headerList.get("authorization"));
  const bearerAuthError = bearerToken ? getDeviceAuthError(bearerToken) : null;
  const sessionAuthError = getPreviewSessionAuthError(
    cookieStore.get(PREVIEW_SESSION_COOKIE)?.value ?? null
  );
  const bearerAuthorized = Boolean(bearerToken && !bearerAuthError);

  if (!bearerAuthorized && sessionAuthError) {
    const authError = bearerAuthError ?? sessionAuthError;
    return <PreviewAuthError status={authError.status} message={authError.message} />;
  }

  const data = await getDashboardData();
  const deviceStatus = previewDeviceStatus();

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
              Preview
            </p>
            <h1 className="text-3xl font-bold">800 x 480 e-ink screen</h1>
          </div>
          <p className="text-sm text-neutral-600">
            갱신 {formatGeneratedAt(data.generatedAt)} · 권장 주기 {Math.round(data.refreshSeconds / 60)}분
          </p>
        </header>

        <PreviewScreen data={data} deviceStatus={deviceStatus} />

        <section className="grid gap-3 text-sm md:grid-cols-2">
          <div className="border-2 border-neutral-900 bg-white p-4">
            <p className="font-bold">Device PNG</p>
            <code>/api/screen.png</code>
          </div>
          <div className="border-2 border-neutral-900 bg-white p-4">
            <p className="font-bold">Device JSON</p>
            <code>/api/screen.json</code>
          </div>
        </section>
      </div>
    </main>
  );
}
