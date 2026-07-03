import {
  formatBatteryStatus,
  formatChargeStatus,
  formatWifiStatus,
  wifiSignalBars,
  wifiSignalPercent
} from "@/lib/device-status";
import {
  formatEventTime,
  formatGeneratedAt,
  formatPercent,
  formatTemperature,
  formatWind
} from "@/lib/format";
import type { DashboardData, DeviceStatus } from "@/lib/types";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/screen";

type ScreenViewProps = {
  data: DashboardData;
  deviceStatus: DeviceStatus;
};

function WifiSignal({ status }: { status: DeviceStatus }) {
  const bars = wifiSignalBars(status.rssi);
  const percent = wifiSignalPercent(status.rssi);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
      {[8, 12, 16, 20].map((height, index) => (
        <div
          key={height}
          style={{
            width: 5,
            height,
            border: "1px solid #111",
            background: index < bars ? "#111" : "#fff"
          }}
        />
      ))}
      <span style={{ marginLeft: 6 }}>{percent === null ? "--%" : `${percent}%`}</span>
    </div>
  );
}

function DeviceDetails({ deviceStatus }: { deviceStatus: DeviceStatus }) {
  const rows = [
    ["Wi-Fi", formatWifiStatus(deviceStatus)],
    ["RSSI", deviceStatus.rssi === null ? "-- dBm" : `${deviceStatus.rssi} dBm`],
    ["Battery", formatBatteryStatus(deviceStatus)],
    ["Charge", formatChargeStatus(deviceStatus)],
    ["Page", `${deviceStatus.page + 1} / 2`]
  ];

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
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
        <div style={{ fontSize: 32, fontWeight: 900 }}>Device</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Status</div>
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 22 }}>
        <div
          style={{
            width: 170,
            height: 170,
            border: "3px solid #111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column"
          }}
        >
          <WifiSignal status={deviceStatus} />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 900 }}>Signal</div>
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 10 }}>
          {rows.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 9,
                borderBottom: "1px solid #111",
                fontSize: 18,
                fontWeight: 900
              }}
            >
              <span>{label}</span>
              <span style={{ textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CalendarPanel({ data }: { data: DashboardData }) {
  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
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
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {event.title}
                </div>
                {event.location ? (
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#555",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
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
            fontWeight: 800,
            color: "#555",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {data.notices.join(" · ")}
        </div>
      ) : null}
    </section>
  );
}

export function ScreenView({ data, deviceStatus }: ScreenViewProps) {
  const page = deviceStatus.page % 2;

  return (
    <div
      style={{
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: "#f8f6ed",
        color: "#111",
        fontFamily: "Arial, Helvetica, sans-serif",
        border: "3px solid #111",
        overflow: "hidden"
      }}
    >
      <header
        style={{
          height: 36,
          boxSizing: "border-box",
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <WifiSignal status={deviceStatus} />
            <span>{deviceStatus.ssid ?? "Wi-Fi"}</span>
          </div>
          <span>{formatBatteryStatus(deviceStatus)}</span>
        </div>
      </header>

      <main style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <section
          style={{
            width: 310,
            boxSizing: "border-box",
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

        {page === 0 ? <CalendarPanel data={data} /> : <DeviceDetails deviceStatus={deviceStatus} />}
      </main>
    </div>
  );
}
