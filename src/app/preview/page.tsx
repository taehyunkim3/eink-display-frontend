import { getDashboardData } from "@/lib/dashboard";
import { previewDeviceStatus } from "@/lib/device-status";
import { formatGeneratedAt } from "@/lib/format";
import { ScreenView } from "@/components/screen-view";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
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

        <section className="eink-frame" aria-label="800 x 480 device preview">
          <ScreenView data={data} deviceStatus={deviceStatus} />
        </section>

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
