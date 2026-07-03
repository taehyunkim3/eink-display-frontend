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
import type { CalendarEvent, DashboardData, DeviceStatus, StockQuote } from "@/lib/types";

type ScreenViewProps = {
  data: DashboardData;
  deviceStatus: DeviceStatus;
  photoSrc?: string;
};

const DEFAULT_PHOTO_SRC = "/images/home-dog.png";
export const SCREEN_PAGE_TITLES = [
  "요약",
  "주간날씨",
  "캘린더",
  "시장지표",
  "기기상태",
  "사진"
] as const;
export const SCREEN_PAGE_COUNT = SCREEN_PAGE_TITLES.length;

const KOREAN_DAY = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul"
});
const KOREAN_MONTH = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  timeZone: "Asia/Seoul"
});
const KOREAN_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul"
});
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function normalizePage(page: number) {
  return ((page % SCREEN_PAGE_COUNT) + SCREEN_PAGE_COUNT) % SCREEN_PAGE_COUNT;
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

function stockCategoryLabel(stock: StockQuote): string {
  if (stock.category === "fx") return "환율";
  if (stock.category === "commodity") return "원자재";
  if (stock.category === "index") return "지수";
  return "종목";
}

function formatSignedStockValue(stock: StockQuote, value: string | null, suffix = ""): string {
  if (!value) return "--";

  const unsignedValue = value.trim().replace(/^[+-]+/, "");
  if (stock.direction === "up") return `+${unsignedValue}${suffix}`;
  if (stock.direction === "down") return `-${unsignedValue}${suffix}`;
  return `${unsignedValue}${suffix}`;
}

function calendarEventMeta(event: CalendarEvent): string | null {
  const values = [event.calendarName, event.location].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : null;
}

function calendarEventTimeLabel(event: CalendarEvent): string {
  if (event.allDay) return "종일";
  const parts = formatEventTime(event).split(" ");
  return parts[parts.length - 1] ?? "";
}

function eventDateKey(event: CalendarEvent): string {
  return KOREAN_DATE_PARTS.format(new Date(event.startsAt));
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthCells(value: string): Date[] {
  const base = new Date(value);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function weatherIconKind(code: number | null): "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" {
  if (code === null) return "cloud";
  if (code === 0 || code === 1) return "sun";
  if (code === 2 || code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 75) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

const WEATHER_ICON_PATHS: Record<ReturnType<typeof weatherIconKind>, string> = {
  sun: "M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708",
  cloud: "M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383m.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z",
  rain: "M4.158 12.025a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 0 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 1 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m.247-6.998a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 11H13a3 3 0 0 0 .405-5.973M8.5 2a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 2",
  snow: "M13.405 4.277a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10.25H13a3 3 0 0 0 .405-5.973M8.5 1.25a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1-.001 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1.25M2.625 11.5a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m2.75 2a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m5.5 0a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m-2.75-2a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m5.5 0a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25",
  storm: "M2.658 11.026a.5.5 0 0 1 .316.632l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.316m9.5 0a.5.5 0 0 1 .316.632l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.316m-7.5 1.5a.5.5 0 0 1 .316.632l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.316m9.5 0a.5.5 0 0 1 .316.632l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.316m-.753-8.499a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973M8.5 1a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1M7.053 11.276A.5.5 0 0 1 7.5 11h1a.5.5 0 0 1 .474.658l-.28.842H9.5a.5.5 0 0 1 .39.812l-2 2.5a.5.5 0 0 1-.875-.433L7.36 14H6.5a.5.5 0 0 1-.447-.724z",
  fog: "M3 13.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m10.405-9.473a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 12H13a3 3 0 0 0 .405-5.973M8.5 3a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 3"
};

function WeatherIcon({ code, size = 58 }: { code: number | null; size?: number }) {
  const kind = weatherIconKind(code);
  const imageSrc = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="#111" viewBox="0 0 16 16">` +
      `<path d="${WEATHER_ICON_PATHS[kind]}"/>` +
      `</svg>`
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        overflow: "hidden"
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Bootstrap weather SVGs render reliably as data URI images inside next/og. */}
      <img src={imageSrc} alt="" width={size} height={size} style={{ width: size, height: size }} />
    </div>
  );
}

function sparklinePoints(values: number[], size: number, width: number, height: number) {
  const validValues = values.filter((value) => Number.isFinite(value));
  const inset = 3;

  if (validValues.length < 2) {
    return [
      { x: inset, y: Math.floor(height / 2) },
      { x: width - inset, y: Math.floor(height / 2) }
    ];
  }

  const sampleStep = Math.max(1, Math.floor(validValues.length / size));
  const sampled = validValues.filter((_, index) => index % sampleStep === 0).slice(-size);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;

  return sampled.map((value, index) => ({
    x: Math.round(inset + (index / Math.max(1, sampled.length - 1)) * (width - inset * 2)),
    y: Math.round(height - inset - ((value - min) / range) * (height - inset * 2))
  }));
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Sparkline({ values, width = 134, height = 38 }: { values: number[]; width?: number; height?: number }) {
  const points = sparklinePoints(values, Math.max(12, Math.floor(width / 2)), width, height);
  const pointText = points.map((point) => `${point.x},${point.y}`).join(" ");
  const endPoint = points[points.length - 1];
  const lineWidth = Math.max(2, Math.round(height / 9));
  const midY = Math.round(height / 2);
  const imageSrc = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<line x1="3" y1="${midY}" x2="${width - 3}" y2="${midY}" stroke="#111" stroke-width="1" stroke-dasharray="3 3"/>` +
      `<polyline points="${pointText}" fill="none" stroke="#111" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${endPoint.x}" cy="${endPoint.y}" r="${Math.max(2, lineWidth)}" fill="#111"/>` +
      `</svg>`
  );

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        display: "flex",
        overflow: "hidden"
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG keeps sparklines continuous inside next/og ImageResponse. */}
      <img src={imageSrc} alt="" width={width} height={height} style={{ width, height }} />
    </div>
  );
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

function EmptyState({ children, height = 238 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      style={{
        height,
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
  const nextEvents = data.events.slice(0, 2);
  const topStocks = data.stocks.slice(0, 2);

  return (
    <PanelShell title="오늘 요약" subtitle="날씨 · 일정 · 주식">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 14 }}>
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
                padding: "9px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontWeight: 900
              }}
            >
              <span style={{ fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 22 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>다가오는 일정</div>
            {nextEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {nextEvents.map((event) => {
                  const meta = calendarEventMeta(event);
                  return (
                    <div
                      key={event.uid}
                      style={{
                        borderBottom: "1px solid #111",
                        paddingBottom: 6,
                        display: "flex",
                        flexDirection: "column"
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{formatEventTime(event)}</div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {event.title}
                      </div>
                      {meta ? (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#555",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {meta}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState height={166}>일정 없음</EmptyState>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>시장 지표</div>
            {topStocks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topStocks.map((stock) => (
                  <StockRow key={stock.code} stock={stock} compact />
                ))}
              </div>
            ) : (
              <EmptyState height={166}>주식 정보 없음</EmptyState>
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
      <div
        style={{
          display: "flex",
          gap: 9,
          marginTop: 16,
          flex: 1,
          minHeight: 0
        }}
      >
        {data.weather.daily.length > 0 ? (
          data.weather.daily.slice(0, 7).map((day) => (
            <div
              key={day.date}
              style={{
                minWidth: 0,
                flex: 1,
                border: "2px solid #111",
                padding: "9px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexDirection: "column",
                gap: 6,
                fontWeight: 900,
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: 14 }}>{formatForecastDate(day.date)}</div>
              <WeatherIcon code={day.weatherCode} />
              <div style={{ fontSize: 18, lineHeight: 1.1 }}>{day.condition}</div>
              <div style={{ fontSize: 17 }}>
                {`${formatTemperature(day.minTemperatureC)} / ${formatTemperature(day.maxTemperatureC)}`}
              </div>
              <div style={{ fontSize: 14 }}>{`비 ${formatPercent(day.precipitationProbabilityPercent)}`}</div>
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
  const baseDate = new Date(data.generatedAt);
  const cells = monthCells(data.generatedAt);
  const weeks = chunkArray(cells, 7);
  const currentMonth = baseDate.getMonth();
  const contentWidth = SCREEN_WIDTH - 58;
  const dayCellWidth = 102;
  const dayCellHeight = 47;
  const eventsByDate = data.events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = eventDateKey(event);
    acc[key] = [...(acc[key] ?? []), event];
    return acc;
  }, {});

  return (
    <PanelShell
      title="캘린더"
      subtitle={KOREAN_MONTH.format(baseDate)}
      footer={data.notices.length > 0 ? data.notices.join(" · ") : null}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 12,
          width: contentWidth,
          height: 332
        }}
      >
        <div style={{ display: "flex", gap: 4, height: 26 }}>
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                width: dayCellWidth,
                borderBottom: "2px solid #111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 900
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: "flex", gap: 4, height: dayCellHeight }}>
            {week.map((cell) => {
              const key = dateKey(cell);
              const dayEvents = eventsByDate[key] ?? [];
              const muted = cell.getMonth() !== currentMonth;

              return (
                <div
                  key={key}
                  style={{
                    width: dayCellWidth,
                    height: dayCellHeight,
                    border: muted ? "1px solid #777" : "2px solid #111",
                    padding: "3px 5px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    opacity: muted ? 0.45 : 1
                  }}
                >
                  <div style={{ display: "flex", fontSize: 14, fontWeight: 900 }}>{cell.getDate()}</div>
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.uid}
                      style={{
                        display: "flex",
                        borderLeft: "3px solid #111",
                        paddingLeft: 4,
                        minWidth: 0,
                        fontSize: 9,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {`${calendarEventTimeLabel(event)} · ${event.calendarName ?? "캘린더"} · ${event.title}`}
                    </div>
                  ))}
                  {dayEvents.length > 2 ? (
                    <div style={{ display: "flex", fontSize: 10, fontWeight: 900 }}>{`+${dayEvents.length - 2}`}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function StockRow({ stock, compact = false }: { stock: StockQuote; compact?: boolean }) {
  const change = formatSignedStockValue(stock, stock.change);
  const rate = formatSignedStockValue(stock, stock.changePercent, "%");

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
      {!compact ? (
        <div style={{ width: 118, display: "flex", justifyContent: "flex-end" }}>
          <Sparkline values={stock.history} width={118} height={32} />
        </div>
      ) : null}
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

function MarketListRow({ stock }: { stock: StockQuote }) {
  const change = formatSignedStockValue(stock, stock.change);
  const rate = formatSignedStockValue(stock, stock.changePercent, "%");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: 362,
        paddingBottom: 5,
        borderBottom: "1px solid #111",
        fontWeight: 900
      }}
    >
      <div style={{ width: 118, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {stock.name}
        </div>
        <div style={{ fontSize: 10, color: "#555" }}>{stockCategoryLabel(stock)}</div>
      </div>
      <div style={{ width: 68, textAlign: "right", fontSize: 14 }}>{stock.price ?? "--"}</div>
      <Sparkline values={stock.history} width={88} height={22} />
      <div
        style={{
          width: 64,
          textAlign: "right",
          fontSize: 11,
          display: "flex",
          flexDirection: "column"
        }}
      >
        <span>
          {stockDirectionLabel(stock)} {rate}
        </span>
        <span>{change}</span>
      </div>
    </div>
  );
}

function StocksPanel({ data }: { data: DashboardData }) {
  const marketItems = data.stocks.filter((stock) => stock.category !== "equity");
  const equities = data.stocks.filter((stock) => stock.category === "equity");
  const contentWidth = SCREEN_WIDTH - 58;
  const columnWidth = 362;

  return (
    <PanelShell title="시장지표" subtitle="지수 · 환율 · 관심종목">
      <div style={{ display: "flex", gap: 18, marginTop: 12, width: contentWidth, height: 312 }}>
        {data.stocks.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, width: columnWidth }}>
              <div style={{ fontSize: 15, fontWeight: 900, borderBottom: "2px solid #111", paddingBottom: 4 }}>
                주요 지표
              </div>
              {marketItems.slice(0, 6).map((stock) => (
                <MarketListRow key={stock.code} stock={stock} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, width: columnWidth }}>
              <div style={{ fontSize: 15, fontWeight: 900, borderBottom: "2px solid #111", paddingBottom: 4 }}>
                관심 종목
              </div>
              {equities.slice(0, 5).map((stock) => (
                <MarketListRow key={stock.code} stock={stock} />
              ))}
            </div>
          </>
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
    ["Page", `${page + 1} / ${SCREEN_PAGE_COUNT}`]
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

function PhotoPanel({ photoSrc }: { photoSrc: string }) {
  return (
    <PanelShell title="사진" subtitle="반려견">
      <div
        style={{
          marginTop: 16,
          border: "2px solid #111",
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background: "#fff"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image is not supported inside next/og ImageResponse. */}
        <img
          src={photoSrc}
          alt="웃고 있는 반려견"
          width={466}
          height={352}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain"
          }}
        />
      </div>
    </PanelShell>
  );
}

function MainPanel({ page, data, deviceStatus, photoSrc }: ScreenViewProps & { page: number }) {
  if (page === 0) return <OverviewPanel data={data} />;
  if (page === 1) return <WeeklyWeatherPanel data={data} />;
  if (page === 2) return <CalendarPanel data={data} />;
  if (page === 3) return <StocksPanel data={data} />;
  if (page === 5) return <PhotoPanel photoSrc={photoSrc ?? DEFAULT_PHOTO_SRC} />;
  return <DeviceDetails deviceStatus={deviceStatus} page={page} />;
}

export function ScreenView({ data, deviceStatus, photoSrc = DEFAULT_PHOTO_SRC }: ScreenViewProps) {
  const page = normalizePage(deviceStatus.page);
  const showWeatherRail = page === 0;

  return (
    <div
      style={{
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
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
          <span>{SCREEN_PAGE_TITLES[page]}</span>
          <span style={{ fontWeight: 700 }}>|</span>
          <span>
            {page + 1}/{SCREEN_PAGE_COUNT}
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
        {showWeatherRail ? (
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
        ) : null}

        <MainPanel page={page} data={data} deviceStatus={deviceStatus} photoSrc={photoSrc} />
      </main>
    </div>
  );
}
