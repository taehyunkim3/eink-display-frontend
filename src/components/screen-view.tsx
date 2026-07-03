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
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/lib/screen";
import type { DashboardData, DeviceStatus, StockQuote } from "@/lib/types";

type ScreenViewProps = {
  data: DashboardData;
  deviceStatus: DeviceStatus;
};

const PAGE_TITLES = ["요약", "주간날씨", "캘린더", "국내주식", "기기상태"] as const;
const PAGE_COUNT = PAGE_TITLES.length;

const KOREAN_DAY = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul"
});

function normalizePage(page: number) {
  return ((page % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT;
}

function formatForecastDate(value: string): string {
  return KOREAN_DAY.format(new Date(`${value}T00:00:00+09:00`));
}

function stockDirectionLabel(stock: StockQuote): string {
  if (stock.direction === "up") return "상승";
  if (stock.direction === "down") return "하락";
  if (stock.direction === "flat") return "보합";
  return "-";
}

function stockDirectionSign(stock: StockQuote): string {
  if (stock.direction === "up") return "+";
  if (stock.direction === "down") return "-";
  return "";
}

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

function PanelShell({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: "22px 26px",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 10,
          borderBottom: "2px solid #111"
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{subtitle}</div>
      </div>
      {children}
      {footer ? (
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
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: 238,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px dashed #111",
        fontSize: 22,
        fontWeight: 800,
        textAlign: "center"
      }}
    >
      {children}
    </div>
  );
}

function OverviewPanel({ data }: { data: DashboardData }) {
  const nextEvents = data.events.slice(0, 3);
  const topStocks = data.stocks.slice(0, 3);

  return (
    <PanelShell title="오늘 요약" subtitle="날씨 · 일정 · 주식">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 18 }}>
          {[
            ["체감", formatTemperature(data.weather.apparentTemperatureC)],
            ["습도", formatPercent(data.weather.humidityPercent)],
            ["바람", formatWind(data.weather.windKph)]
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                flex: 1,
                border: "2px solid #111",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontWeight: 900
              }}
            >
              <span style={{ fontSize: 15 }}>{label}</span>
              <span style={{ fontSize: 25 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, minHeight: 206 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>다가오는 일정</div>
            {nextEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nextEvents.map((event) => (
                  <div
                    key={event.uid}
                    style={{
                      borderBottom: "1px solid #111",
                      paddingBottom: 7,
                      display: "flex",
                      flexDirection: "column"
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{formatEventTime(event)}</div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {event.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>일정 없음</EmptyState>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>국내 주식</div>
            {topStocks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topStocks.map((stock) => (
                  <StockRow key={stock.code} stock={stock} compact />
                ))}
              </div>
            ) : (
              <EmptyState>주식 정보 없음</EmptyState>
            )}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function WeeklyWeatherPanel({ data }: { data: DashboardData }) {
  return (
    <PanelShell title="주간날씨" subtitle="7일 예보">
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
        {data.weather.daily.length > 0 ? (
          data.weather.daily.slice(0, 7).map((day) => (
            <div
              key={day.date}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                paddingBottom: 7,
                borderBottom: "1px solid #111",
                fontWeight: 900
              }}
            >
              <div style={{ width: 116, fontSize: 16 }}>{formatForecastDate(day.date)}</div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 18,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {day.condition}
              </div>
              <div
                style={{
                  width: 110,
                  textAlign: "right",
                  fontSize: 18,
                  display: "flex",
                  justifyContent: "flex-end"
                }}
              >
                {formatTemperature(day.minTemperatureC)} / {formatTemperature(day.maxTemperatureC)}
              </div>
              <div
                style={{
                  width: 76,
                  textAlign: "right",
                  fontSize: 16,
                  display: "flex",
                  justifyContent: "flex-end"
                }}
              >
                비 {formatPercent(day.precipitationProbabilityPercent)}
              </div>
            </div>
          ))
        ) : (
          <EmptyState>주간 예보 없음</EmptyState>
        )}
      </div>
    </PanelShell>
  );
}

function CalendarPanel({ data }: { data: DashboardData }) {
  return (
    <PanelShell
      title="캘린더"
      subtitle="앞으로 7일"
      footer={data.notices.length > 0 ? data.notices.join(" · ") : null}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 15 }}>
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
          <EmptyState>표시할 일정 없음</EmptyState>
        )}
      </div>
    </PanelShell>
  );
}

function StockRow({ stock, compact = false }: { stock: StockQuote; compact?: boolean }) {
  const sign = stockDirectionSign(stock);
  const change = stock.change ? `${sign}${stock.change}` : "--";
  const rate = stock.changePercent ? `${sign}${stock.changePercent}%` : "--";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        paddingBottom: compact ? 7 : 9,
        borderBottom: "1px solid #111",
        fontWeight: 900
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: compact ? 16 : 20,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {stock.name}
        </div>
        <div
          style={{
            fontSize: compact ? 12 : 14,
            color: "#555",
            display: "flex"
          }}
        >
          {stock.code} {stock.market ? `· ${stock.market}` : ""}
        </div>
      </div>
      <div style={{ width: compact ? 74 : 92, textAlign: "right", fontSize: compact ? 17 : 21 }}>
        {stock.price ?? "--"}
      </div>
      <div
        style={{
          width: compact ? 70 : 92,
          textAlign: "right",
          fontSize: compact ? 14 : 16,
          display: "flex",
          justifyContent: "flex-end"
        }}
      >
        {stockDirectionLabel(stock)} {rate}
      </div>
      {!compact ? (
        <div style={{ width: 84, textAlign: "right", fontSize: 15 }}>{change}</div>
      ) : null}
    </div>
  );
}

function StocksPanel({ data }: { data: DashboardData }) {
  return (
    <PanelShell title="국내주식" subtitle="네이버 금융">
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
        {data.stocks.length > 0 ? (
          data.stocks.slice(0, 7).map((stock) => <StockRow key={stock.code} stock={stock} />)
        ) : (
          <EmptyState>주식 정보 없음</EmptyState>
        )}
      </div>
    </PanelShell>
  );
}

function DeviceDetails({
  deviceStatus,
  page
}: {
  deviceStatus: DeviceStatus;
  page: number;
}) {
  const rows = [
    ["Wi-Fi", formatWifiStatus(deviceStatus)],
    ["RSSI", deviceStatus.rssi === null ? "-- dBm" : `${deviceStatus.rssi} dBm`],
    ["Battery", formatBatteryStatus(deviceStatus)],
    ["Charge", formatChargeStatus(deviceStatus)],
    ["Page", `${page + 1} / ${PAGE_COUNT}`]
  ];

  return (
    <PanelShell title="기기상태" subtitle="연결 · 배터리">
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
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 900 }}>신호강도</div>
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
    </PanelShell>
  );
}

function MainPanel({ page, data, deviceStatus }: ScreenViewProps & { page: number }) {
  if (page === 0) return <OverviewPanel data={data} />;
  if (page === 1) return <WeeklyWeatherPanel data={data} />;
  if (page === 2) return <CalendarPanel data={data} />;
  if (page === 3) return <StocksPanel data={data} />;
  return <DeviceDetails deviceStatus={deviceStatus} page={page} />;
}

export function ScreenView({ data, deviceStatus }: ScreenViewProps) {
  const page = normalizePage(deviceStatus.page);

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
          padding: "0 22px",
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
          <span>{PAGE_TITLES[page]}</span>
          <span style={{ fontWeight: 700 }}>|</span>
          <span>
            {page + 1}/{PAGE_COUNT}
          </span>
          <span style={{ fontWeight: 700 }}>|</span>
          <span>{formatGeneratedAt(data.generatedAt)}</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
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
            width: 286,
            boxSizing: "border-box",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRight: "2px solid #111"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.weather.label}</div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 14 }}>
              <div style={{ fontSize: 78, lineHeight: 0.9, fontWeight: 900 }}>
                {formatTemperature(data.weather.temperatureC)}
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 800 }}>
              {data.weather.condition}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              ["체감", formatTemperature(data.weather.apparentTemperatureC)],
              ["습도", formatPercent(data.weather.humidityPercent)],
              ["바람", formatWind(data.weather.windKph)],
              ["갱신", formatGeneratedAt(data.generatedAt)]
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  width: "108px",
                  paddingTop: 8,
                  borderTop: "2px solid #111",
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 15,
                  fontWeight: 700
                }}
              >
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <MainPanel page={page} data={data} deviceStatus={deviceStatus} />
      </main>
    </div>
  );
}
