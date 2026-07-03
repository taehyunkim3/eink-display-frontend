import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { assertDeviceAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import {
  formatEventTime,
  formatGeneratedAt,
  formatPercent,
  formatTemperature,
  formatWind
} from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = assertDeviceAuth(request);
  if (authError) return authError;

  const data = await getDashboardData();

  return new ImageResponse(
    (
      <div
        style={{
          width: "800px",
          height: "480px",
          display: "flex",
          background: "#f8f6ed",
          color: "#111",
          fontFamily: "Arial",
          border: "3px solid #111"
        }}
      >
        <section
          style={{
            width: "310px",
            height: "474px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRight: "2px solid #111"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.weather.label}</div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
              <div style={{ fontSize: 92, lineHeight: 0.9, fontWeight: 900 }}>
                {formatTemperature(data.weather.temperatureC)}
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
              {data.weather.condition}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
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
                  paddingTop: 10,
                  borderTop: "2px solid #111",
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 17,
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
            height: "474px",
            padding: "28px",
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
            <div style={{ fontSize: 34, fontWeight: 900 }}>Calendar</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Next 7 days</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
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
                    <div style={{ fontSize: 21, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden" }}>
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
                  height: 278,
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
      </div>
    ),
    {
      width: 800,
      height: 480,
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
