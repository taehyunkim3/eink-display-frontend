import { formatBatteryStatus, formatWifiStatus } from "@/lib/device-status";
import {
  formatEventTime,
  formatGeneratedAt,
  formatPercent,
  formatTemperature,
  formatWind
} from "@/lib/format";
import type { DashboardData, DeviceStatus } from "@/lib/types";

type ScreenViewProps = {
  data: DashboardData;
  deviceStatus: DeviceStatus;
};

export function ScreenView({ data, deviceStatus }: ScreenViewProps) {
  return (
    <div
      style={{
        width: "800px",
        height: "480px",
        display: "flex",
        flexDirection: "column",
        background: "#f8f6ed",
        color: "#111",
        fontFamily: "Arial",
        border: "3px solid #111"
      }}
    >
      <header
        style={{
          height: "36px",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "2px solid #111",
          fontSize: 15,
          fontWeight: 800
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span>ESP32 E-INK</span>
          <span style={{ fontWeight: 700 }}>|</span>
          <span>{formatGeneratedAt(data.generatedAt)}</span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span>{formatWifiStatus(deviceStatus)}</span>
          <span>{formatBatteryStatus(deviceStatus)}</span>
        </div>
      </header>

      <main style={{ display: "flex", height: "438px" }}>
        <section
          style={{
            width: "310px",
            height: "438px",
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRight: "2px solid #111"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.weather.label}</div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 16 }}>
              <div style={{ fontSize: 84, lineHeight: 0.9, fontWeight: 900 }}>
                {formatTemperature(data.weather.temperatureC)}
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
              {data.weather.condition}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              ["체감", formatTemperature(data.weather.apparentTemperatureC)],
              ["습도", formatPercent(data.weather.humidityPercent)],
              ["바람", formatWind(data.weather.windKph)],
              ["갱신", formatGeneratedAt(data.generatedAt)]
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  width: "116px",
                  paddingTop: 9,
                  borderTop: "2px solid #111",
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 16,
                  fontWeight: 700
                }}
              >
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            width: "484px",
            height: "438px",
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 12,
              borderBottom: "2px solid #111"
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 900 }}>Calendar</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Next 7 days</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {data.events.length > 0 ? (
              data.events.slice(0, 6).map((event) => (
                <div
                  key={event.uid}
                  style={{
                    display: "flex",
                    gap: 16,
                    paddingBottom: 8,
                    borderBottom: "1px solid #111"
                  }}
                >
                  <div style={{ width: 132, fontSize: 15, fontWeight: 700 }}>
                    {formatEventTime(event)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden" }}>
                      {event.title}
                    </div>
                    {event.location ? (
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                        {event.location}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  height: 250,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px dashed #111",
                  fontSize: 22,
                  fontWeight: 800
                }}
              >
                표시할 일정 없음
              </div>
            )}
          </div>

          {data.notices.length > 0 ? (
            <div
              style={{
                marginTop: "auto",
                fontSize: 13,
                fontWeight: 700,
                color: "#555",
                whiteSpace: "nowrap",
                overflow: "hidden"
              }}
            >
              {data.notices.join(" · ")}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
