import { getDashboardData } from "@/lib/dashboard";
import { formatBatteryStatus, formatWifiStatus, previewDeviceStatus } from "@/lib/device-status";
import {
  formatEventTime,
  formatGeneratedAt,
  formatPercent,
  formatTemperature,
  formatWind
} from "@/lib/format";

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

        <section className="eink-frame">
          <div className="flex h-full flex-col">
            <header className="flex h-9 shrink-0 items-center justify-between border-b-2 border-neutral-950 px-6 text-[15px] font-extrabold">
              <div className="flex items-center gap-2">
                <span>ESP32 E-INK</span>
                <span>|</span>
                <span>{formatGeneratedAt(data.generatedAt)}</span>
              </div>
              <div className="flex items-center gap-5">
                <span>{formatWifiStatus(deviceStatus)}</span>
                <span>{formatBatteryStatus(deviceStatus)}</span>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-[310px_1fr] gap-0">
            <section className="border-r-2 border-neutral-950 px-7 py-6">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-lg font-bold">{data.weather.label}</p>
                  <div className="mt-4 flex items-start gap-3">
                    <p className="text-[84px] font-black leading-none">
                      {formatTemperature(data.weather.temperatureC)}
                    </p>
                  </div>
                  <p className="mt-2 text-[28px] font-bold">{data.weather.condition}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-base font-semibold">
                  <div className="border-t-2 border-neutral-950 pt-2">
                    체감
                    <br />
                    {formatTemperature(data.weather.apparentTemperatureC)}
                  </div>
                  <div className="border-t-2 border-neutral-950 pt-2">
                    습도
                    <br />
                    {formatPercent(data.weather.humidityPercent)}
                  </div>
                  <div className="border-t-2 border-neutral-950 pt-2">
                    바람
                    <br />
                    {formatWind(data.weather.windKph)}
                  </div>
                  <div className="border-t-2 border-neutral-950 pt-2">
                    갱신
                    <br />
                    {formatGeneratedAt(data.generatedAt)}
                  </div>
                </div>
              </div>
            </section>

            <section className="px-7 py-6">
              <div className="flex h-full flex-col">
                <div className="mb-4 flex items-center justify-between border-b-2 border-neutral-950 pb-3">
                  <h2 className="text-[32px] font-black">Calendar</h2>
                  <p className="text-base font-bold">Next 7 days</p>
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  {data.events.length > 0 ? (
                    data.events.slice(0, 6).map((event) => (
                      <div key={event.uid} className="grid grid-cols-[132px_1fr] gap-4 border-b border-neutral-950 pb-2">
                        <p className="text-base font-bold">{formatEventTime(event)}</p>
                        <div>
                          <p className="line-clamp-1 text-[20px] font-black">{event.title}</p>
                          {event.location ? (
                            <p className="line-clamp-1 text-sm font-semibold text-neutral-600">
                              {event.location}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-1 items-center justify-center border-2 border-dashed border-neutral-950 text-center text-xl font-bold">
                      표시할 일정 없음
                    </div>
                  )}
                </div>

                {data.notices.length > 0 ? (
                  <p className="mt-4 line-clamp-1 text-sm font-semibold text-neutral-600">
                    {data.notices.join(" · ")}
                  </p>
                ) : null}
              </div>
            </section>
            </div>
          </div>
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
