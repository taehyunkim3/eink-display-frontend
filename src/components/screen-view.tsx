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
  "주간일정",
  "시장지표",
  "차트1",
  "차트2",
  "차트3",
  "뉴스"
] as const;
export const SCREEN_PAGE_COUNT = SCREEN_PAGE_TITLES.length;
const EINK_TEXT_WEIGHT = 600;
const EINK_BOLD_WEIGHT = 700;
const EINK_HEAVY_WEIGHT = 800;

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

function formatForecastShortDate(value: string): string {
  const [, month, day] = value.match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  if (!month || !day) return value;
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(`${value}T00:00:00+09:00`));
  return `${Number(month)}/${Number(day)} ${weekday}`;
}

function formatForecastHour(value: string): string {
  const match = value.match(/T(\d{2}):/);
  return match ? `${Number(match[1])}시` : "--시";
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

  const unsignedValue = value.trim().replace(/^[+-]+/, "").replaceAll(",", "");
  if (stock.direction === "up") return `+${unsignedValue}${suffix}`;
  if (stock.direction === "down") return `-${unsignedValue}${suffix}`;
  return `${unsignedValue}${suffix}`;
}

function addThousandsSeparators(value: string): string {
  return value.replace(/^(\D*)(\d+)/, (_, prefix: string, digits: string) =>
    `${prefix}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
  );
}

function formatStockPrice(value: string | null): string {
  return value ? addThousandsSeparators(value.replaceAll(",", "")) : "--";
}

function formatChartPrice(value: number): string {
  const rounded = Number(value.toFixed(value >= 1000 ? 0 : value >= 100 ? 1 : 2)).toString();
  return addThousandsSeparators(rounded);
}

function formatInvestorFlowValue(flow: StockQuote["investorFlow"], value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (value === 0) return "0";

  const sign = value > 0 ? "+" : "-";
  const absoluteValue = Math.abs(value);

  if (flow?.unit === "hundredMillionKrw") {
    if (absoluteValue >= 10_000) {
      return `${sign}${Number((absoluteValue / 10_000).toFixed(1))}조`;
    }

    return `${sign}${absoluteValue}억`;
  }

  if (absoluteValue >= 100_000_000) {
    return `${sign}${Number((absoluteValue / 100_000_000).toFixed(1))}억`;
  }

  if (absoluteValue >= 10_000) {
    return `${sign}${Math.round(absoluteValue / 10_000)}만`;
  }

  if (absoluteValue >= 1_000) {
    return `${sign}${Math.round(absoluteValue / 1_000)}천`;
  }

  return `${sign}${absoluteValue}`;
}

function investorFlowValueParts(flow: StockQuote["investorFlow"], value: number | null | undefined) {
  const formattedValue = formatInvestorFlowValue(flow, value);
  const sign = formattedValue.match(/^[+-]/)?.[0] ?? "";

  return {
    sign,
    body: sign ? formattedValue.slice(1) : formattedValue
  };
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

function koreaDateKey(value: Date | string): string {
  return KOREAN_DATE_PARTS.format(value instanceof Date ? value : new Date(value));
}

function calendarDayLabel(date: Date): string {
  if (date.getDate() === 1) return `${date.getMonth() + 1}월 1일`;
  return String(date.getDate());
}

function weekDayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

function weekCells(value: string): Date[] {
  const base = new Date(value);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dayRange(date: Date): { start: Date; end: Date } {
  const key = dateKey(date);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    start,
    end
  };
}

function eventOverlapsDay(event: CalendarEvent, date: Date): boolean {
  const { start: dayStart, end: dayEnd } = dayRange(date);
  const eventStart = new Date(event.startsAt);
  const eventEnd = event.endsAt ? new Date(event.endsAt) : eventStart;

  if (eventEnd.getTime() === eventStart.getTime()) {
    return eventDateKey(event) === dateKey(date);
  }

  return eventStart < dayEnd && eventEnd > dayStart;
}

function eventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events
    .filter((event) => eventOverlapsDay(event, date))
    .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function TodayCellBorder() {
  return (
    <div
      style={{
        position: "absolute",
        top: 1,
        left: 1,
        width: "calc(100% - 2px)",
        height: "calc(100% - 2px)",
        borderTop: "3px solid #111",
        borderLeft: "3px solid #111",
        boxSizing: "border-box"
      }}
    />
  );
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

const MARKET_GRAPH_MIN_PERCENT_RANGE = 1;
const MARKET_GRAPH_MAX_PERCENT_RANGE = 15;

function parseMarketNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function percentSeriesForStock(stock: StockQuote): number[] {
  const latestPrice = parseMarketNumber(stock.price);
  const latestRate = parseMarketNumber(stock.changePercent);
  const history = stock.history.filter((value) => Number.isFinite(value));
  const values = [...history];

  if (latestPrice !== null && values[values.length - 1] !== latestPrice) {
    values.push(latestPrice);
  }

  const baseline =
    latestPrice !== null && latestRate !== null && latestRate > -99
      ? latestPrice / (1 + latestRate / 100)
      : values[0];

  if (!baseline || !Number.isFinite(baseline)) {
    return [0, latestRate ?? 0];
  }

  const series = values.length > 0 ? values : [baseline, latestPrice ?? baseline];
  const percentValues = series.map((value) => ((value - baseline) / baseline) * 100);

  if (percentValues.length < 2) {
    return [0, latestRate ?? percentValues[0] ?? 0];
  }

  return percentValues;
}

function marketGraphPercentRange(stock: StockQuote): number {
  const latestRate = Math.abs(parseMarketNumber(stock.changePercent) ?? 0);
  const padded = Math.ceil(Math.max(1, latestRate) * 1.3);
  return Math.max(MARKET_GRAPH_MIN_PERCENT_RANGE, Math.min(MARKET_GRAPH_MAX_PERCENT_RANGE, padded));
}

function percentSparklinePoints(
  stock: StockQuote,
  size: number,
  width: number,
  height: number,
  range: number
) {
  const inset = 4;
  const values = percentSeriesForStock(stock);
  const sampleStep = Math.max(1, Math.floor(values.length / size));
  const sampled = values.filter((_, index) => index % sampleStep === 0).slice(-size);

  return sampled.map((value, index) => {
    const clamped = Math.max(-range, Math.min(range, value));
    return {
      x: inset + (index / Math.max(1, sampled.length - 1)) * (width - inset * 2),
      y: height / 2 - (clamped / range) * (height / 2 - inset)
    };
  });
}

function svgNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function smoothSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${svgNumber(points[0].x)} ${svgNumber(points[0].y)}`;

  const segments = [`M ${svgNumber(points[0].x)} ${svgNumber(points[0].y)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    segments.push(
      `C ${svgNumber(cp1x)} ${svgNumber(cp1y)} ${svgNumber(cp2x)} ${svgNumber(cp2y)} ${svgNumber(p2.x)} ${svgNumber(p2.y)}`
    );
  }

  return segments.join(" ");
}

function PercentSparkline({ stock, width, height }: { stock: StockQuote; width: number; height: number }) {
  const range = marketGraphPercentRange(stock);
  const points = percentSparklinePoints(stock, Math.max(12, Math.floor(width / 2)), width, height, range);
  const path = smoothSvgPath(points);
  const endPoint = points[points.length - 1];
  const lineWidth = 1.45;
  const midY = Math.round(height / 2);
  const upperY = Math.round(height / 4);
  const lowerY = Math.round((height / 4) * 3);
  const firstThirdX = Math.round(width / 3);
  const secondThirdX = Math.round((width / 3) * 2);
  const imageSrc = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">` +
      `<line x1="4" y1="${upperY}" x2="${width - 4}" y2="${upperY}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 5"/>` +
      `<line x1="4" y1="${lowerY}" x2="${width - 4}" y2="${lowerY}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 5"/>` +
      `<line x1="${firstThirdX}" y1="3" x2="${firstThirdX}" y2="${height - 3}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 6"/>` +
      `<line x1="${secondThirdX}" y1="3" x2="${secondThirdX}" y2="${height - 3}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 6"/>` +
      `<line x1="4" y1="${midY}" x2="${width - 4}" y2="${midY}" stroke="#111" stroke-width="0.9" stroke-dasharray="3 4"/>` +
      `<path d="${path}" fill="none" stroke="#111" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${svgNumber(endPoint.x)}" cy="${svgNumber(endPoint.y)}" r="1.5" fill="#111"/>` +
      `</svg>`
  );

  return (
    <div style={{ width, height, position: "relative", display: "flex", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG keeps percent-scaled market graphs stable inside next/og. */}
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
        <div style={{ fontSize: 30, fontWeight: EINK_HEAVY_WEIGHT }}>{title}</div>
        <div style={{ fontSize: 15, fontWeight: EINK_BOLD_WEIGHT }}>{subtitle}</div>
      </div>
      {children}
      {footer ? (
        <div
          style={{
            marginTop: "auto",
            fontSize: 13,
            fontWeight: EINK_BOLD_WEIGHT,
            color: "#111",
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
        fontWeight: EINK_BOLD_WEIGHT,
        textAlign: "center"
      }}
    >
      {children}
    </div>
  );
}

function OverviewCard({
  title,
  right,
  children,
  style
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid #111",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        ...style
      }}
    >
      <div
        style={{
          background: "#111",
          color: "#fff",
          padding: "3px 9px",
          fontSize: 13,
          fontWeight: EINK_BOLD_WEIGHT,
          display: "flex",
          justifyContent: "space-between"
        }}
      >
        <span>{title}</span>
        {right ? <span>{right}</span> : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "8px 12px" }}>{children}</div>
    </div>
  );
}

function TrendArrow({ direction }: { direction: string | null }) {
  const glyph = direction === "up" ? "▲" : direction === "down" ? "▼" : "―";
  return <span style={{ fontSize: 13 }}>{glyph}</span>;
}

function OverviewPanel({ data }: { data: DashboardData }) {
  const nextEvents = data.events.slice(0, 3);
  const marketStocks = data.stocks.slice(0, 3);
  const headlines = data.news?.slice(0, 2) ?? [];
  const todayForecast = data.weather.daily[0];
  const hourly = todayForecast?.hourly?.slice(0, 3) ?? [];

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", gap: 10, height: 210 }}>
        <OverviewCard title="오늘 날씨" right={data.weather.label} style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <WeatherIcon code={data.weather.weatherCode} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: EINK_HEAVY_WEIGHT }}>
                {formatTemperature(data.weather.temperatureC)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: EINK_BOLD_WEIGHT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {data.weather.condition ?? "날씨 정보 없음"}
              </div>
            </div>
            {todayForecast ? (
              <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: EINK_BOLD_WEIGHT }}>
                <div>최고 {formatTemperature(todayForecast.maxTemperatureC)}</div>
                <div>최저 {formatTemperature(todayForecast.minTemperatureC)}</div>
                <div>강수 {formatPercent(todayForecast.precipitationProbabilityPercent)}</div>
              </div>
            ) : null}
          </div>
          <div
            style={{
              borderTop: "1px solid #111",
              marginTop: 8,
              paddingTop: 6,
              display: "flex",
              gap: 16,
              fontSize: 12,
              fontWeight: EINK_BOLD_WEIGHT
            }}
          >
            <span>체감 {formatTemperature(data.weather.apparentTemperatureC)}</span>
            <span>습도 {formatPercent(data.weather.humidityPercent)}</span>
            <span>바람 {formatWind(data.weather.windKph)}</span>
          </div>
          {hourly.length > 0 ? (
            <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
              {hourly.map((hour) => (
                <div key={hour.time} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <WeatherIcon code={hour.weatherCode} size={26} />
                  <div style={{ fontSize: 11, fontWeight: EINK_BOLD_WEIGHT }}>
                    <div>{formatNewsTime(hour.time)}</div>
                    <div>{formatTemperature(hour.temperatureC)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </OverviewCard>

        <OverviewCard
          title="다가오는 일정"
          right={data.events.length > 0 ? `${data.events.length}건` : undefined}
          style={{ flex: 1 }}
        >
          {nextEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {nextEvents.map((event, index) => (
                <div
                  key={event.uid}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "5px 0",
                    borderBottom: index < nextEvents.length - 1 ? "1px solid #111" : "none"
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: EINK_HEAVY_WEIGHT, minWidth: 44 }}>
                    {formatEventTime(event)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: EINK_BOLD_WEIGHT,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {event.title}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: EINK_TEXT_WEIGHT }}>
                      {calendarEventMeta(event) ?? event.calendarName ?? "캘린더"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState height={140}>예정된 일정이 없어요</EmptyState>
          )}
        </OverviewCard>
      </div>

      <OverviewCard title="시장 지표" style={{ height: 126 }}>
        <div style={{ display: "flex", height: "100%" }}>
          {marketStocks.length > 0 ? (
            marketStocks.map((stock, index) => (
              <div
                key={stock.code}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  gap: 8,
                  paddingLeft: index > 0 ? 12 : 0,
                  borderLeft: index > 0 ? "1px solid #111" : "none"
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: EINK_HEAVY_WEIGHT }}>{stock.name}</div>
                  <div style={{ fontSize: 21, fontWeight: EINK_HEAVY_WEIGHT }}>{stock.price}</div>
                  <div style={{ fontSize: 12, fontWeight: EINK_BOLD_WEIGHT }}>
                    <TrendArrow direction={stock.direction} /> {stock.changePercent}%
                  </div>
                </div>
                {stock.history && stock.history.length > 1 ? (
                  <div style={{ marginLeft: "auto", alignSelf: "center" }}>
                    <Sparkline values={stock.history} width={92} height={54} />
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState height={80}>주식 정보 없음</EmptyState>
          )}
        </div>
      </OverviewCard>

      <div style={{ display: "flex", border: "1px solid #111", minHeight: 62 }}>
        <div
          style={{
            background: "#111",
            color: "#fff",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            fontSize: 13,
            fontWeight: EINK_BOLD_WEIGHT
          }}
        >
          뉴스
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: "6px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {headlines.length > 0 ? (
            headlines.map((headline, index) => (
              <div
                key={`${headline.title}-${index}`}
                style={{ display: "flex", gap: 10, alignItems: "baseline", lineHeight: 1.35 }}
              >
                <span style={{ fontSize: 11, fontWeight: EINK_BOLD_WEIGHT, minWidth: 38 }}>
                  {formatNewsTime(headline.publishedAt)}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: EINK_TEXT_WEIGHT,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {headline.title}
                </span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 13, fontWeight: EINK_BOLD_WEIGHT }}>뉴스 정보 없음</span>
          )}
        </div>
      </div>
    </section>
  );
}

function WeeklyWeatherPanel({ data }: { data: DashboardData }) {
  const days = data.weather.daily.slice(0, 8);
  const contentHeight = SCREEN_HEIGHT - 6 - 36;
  const tileWidth = (SCREEN_WIDTH - 6) / 2;
  const tileHeight = contentHeight / 4;

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        flexWrap: "wrap"
      }}
    >
      {days.length > 0 ? (
        Array.from({ length: 8 }, (_, index) => {
          const day = days[index];
          const rowIndex = Math.floor(index / 2);
          const columnIndex = index % 2;

          return day ? (
            <div
              key={day.date}
              style={{
                width: tileWidth,
                height: tileHeight,
                boxSizing: "border-box",
                borderTop: rowIndex === 0 ? "1px solid #111" : "0px solid transparent",
                borderLeft: columnIndex === 0 ? "1px solid #111" : "0px solid transparent",
                borderRight: "1px solid #111",
                borderBottom: "1px solid #111",
                padding: "7px 9px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                fontWeight: EINK_BOLD_WEIGHT
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <WeatherIcon code={day.weatherCode} size={32} />
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 3 }}>
                  <div style={{ display: "flex", fontSize: 14, lineHeight: 1 }}>
                    {formatForecastShortDate(day.date)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {day.condition}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", fontSize: 15 }}>
                    {`${formatTemperature(day.minTemperatureC)}-${formatTemperature(day.maxTemperatureC)}`}
                  </div>
                  <div style={{ display: "flex", fontSize: 12 }}>
                    {`강수 ${formatPercent(day.precipitationProbabilityPercent)}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, minWidth: 0 }}>
                {day.hourly.length > 0 ? (
                  day.hourly.slice(0, 3).map((hour) => (
                    <div
                      key={hour.time}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: 42,
                        boxSizing: "border-box",
                        borderLeft: "1px dashed #111",
                        paddingLeft: 4,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ display: "flex", fontSize: 11 }}>{formatForecastHour(hour.time)}</div>
                        <WeatherIcon code={hour.weatherCode} size={12} />
                      </div>
                      <div style={{ display: "flex", fontSize: 13 }}>{formatTemperature(hour.temperatureC)}</div>
                      <div style={{ display: "flex", fontSize: 10 }}>
                        {`비 ${formatPercent(hour.precipitationProbabilityPercent)}`}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed #111",
                      fontSize: 13
                    }}
                  >
                    시간대별 예보 없음
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              key={`empty-${index}`}
              style={{
                width: tileWidth,
                height: tileHeight,
                boxSizing: "border-box",
                borderTop: rowIndex === 0 ? "1px dashed #111" : "0px solid transparent",
                borderLeft: columnIndex === 0 ? "1px dashed #111" : "0px solid transparent",
                borderRight: "1px dashed #111",
                borderBottom: "1px dashed #111"
              }}
            />
          );
        })
      ) : (
        <EmptyState height={390}>주간 예보 없음</EmptyState>
      )}
    </section>
  );
}

function CalendarPanel({ data }: { data: DashboardData }) {
  const baseDate = new Date(data.generatedAt);
  const cells = monthCells(data.generatedAt);
  const weeks = chunkArray(cells, 7);
  const currentMonth = baseDate.getMonth();
  const contentWidth = SCREEN_WIDTH - 6;
  const weekdayHeight = 18;
  const dayCellWidth = contentWidth / 7;
  const dayCellHeight = (SCREEN_HEIGHT - 6 - 36 - weekdayHeight) / 6;
  const todayKey = koreaDateKey(data.generatedAt);
  const eventsByDate = data.events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = eventDateKey(event);
    acc[key] = [...(acc[key] ?? []), event];
    return acc;
  }, {});

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          width: contentWidth,
          height: SCREEN_HEIGHT - 6 - 36
        }}
      >
        <div style={{ display: "flex", gap: 0, height: weekdayHeight }}>
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                width: dayCellWidth,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: EINK_BOLD_WEIGHT
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: "flex", gap: 0, height: dayCellHeight }}>
            {week.map((cell, dayIndex) => {
              const key = dateKey(cell);
              const dayEvents = eventsByDate[key] ?? [];
              const muted = cell.getMonth() !== currentMonth;
              const borderStyle = muted ? "dashed" : "solid";
              const isFirstDayOfMonth = cell.getDate() === 1;
              const isToday = koreaDateKey(cell) === todayKey;

              return (
                <div
                  key={key}
                  style={{
                    position: "relative",
                    width: dayCellWidth,
                    height: dayCellHeight,
                    borderTop: weekIndex === 0 ? `1px ${borderStyle} #111` : "0px solid transparent",
                    borderLeft: dayIndex === 0 ? `1px ${borderStyle} #111` : "0px solid transparent",
                    borderRight: `1px ${borderStyle} #111`,
                    borderBottom: `1px ${borderStyle} #111`,
                    boxSizing: "border-box",
                    padding: "2px 3px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: isFirstDayOfMonth ? 10 : 12,
                      fontWeight: EINK_BOLD_WEIGHT,
                      lineHeight: 1
                    }}
                  >
                    {calendarDayLabel(cell)}
                  </div>
                  {dayEvents.slice(0, 4).map((event) => (
                    <div
                      key={event.uid}
                      style={{
                        display: "flex",
                        minWidth: 0,
                        fontWeight: EINK_TEXT_WEIGHT,
                        lineHeight: 1
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          minWidth: 0,
                          fontSize: 9,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {`${calendarEventTimeLabel(event)} ${event.title}`}
                      </div>
                    </div>
                  ))}
                  {dayEvents.length > 4 ? (
                    <div style={{ display: "flex", fontSize: 9, fontWeight: EINK_BOLD_WEIGHT }}>{`+${dayEvents.length - 4}`}</div>
                  ) : null}
                  {isToday ? <TodayCellBorder /> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function WeekCalendarPanel({ data }: { data: DashboardData }) {
  const days = weekCells(data.generatedAt);
  const contentWidth = SCREEN_WIDTH - 6;
  const contentHeight = SCREEN_HEIGHT - 6 - 36;
  const dayCellWidth = contentWidth / 7;
  const dayCellHeight = contentHeight;
  const todayKey = koreaDateKey(data.generatedAt);

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: 0,
        display: "flex"
      }}
    >
      <div
        style={{
          width: contentWidth,
          height: contentHeight,
          display: "flex",
          gap: 0
        }}
      >
        {days.map((day, dayIndex) => {
          const dayEvents = eventsForDay(data.events, day);
          const isToday = koreaDateKey(day) === todayKey;

          return (
            <div
              key={dateKey(day)}
              style={{
                position: "relative",
                width: dayCellWidth,
                height: dayCellHeight,
                boxSizing: "border-box",
                borderTop: "1px solid #111",
                borderLeft: dayIndex === 0 ? "1px solid #111" : "0px solid transparent",
                borderRight: "1px solid #111",
                borderBottom: "1px solid #111",
                display: "flex",
                flexDirection: "column",
                fontWeight: EINK_BOLD_WEIGHT,
                minWidth: 0
              }}
            >
              <div
                style={{
                  height: 30,
                  boxSizing: "border-box",
                  borderBottom: "1px solid #111",
                  padding: "3px 4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2
                }}
              >
                <div style={{ display: "flex", fontSize: 13, lineHeight: 1 }}>
                  {WEEKDAY_LABELS[day.getDay()]}
                </div>
                <div style={{ display: "flex", fontSize: 11, lineHeight: 1 }}>
                  {weekDayLabel(day)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "4px 3px"
                }}
              >
                {dayEvents.length > 0 ? (
                  dayEvents.slice(0, 11).map((event) => (
                    <div
                      key={`${event.uid}-${dateKey(day)}`}
                      style={{
                        display: "flex",
                        minWidth: 0,
                        borderBottom: "1px dashed #111",
                        lineHeight: 1,
                        paddingBottom: 2
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          fontSize: 9,
                          minWidth: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {`${calendarEventTimeLabel(event)} ${event.title}`}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#111"
                    }}
                  >
                    일정 없음
                  </div>
                )}
                {dayEvents.length > 11 ? (
                  <div style={{ display: "flex", fontSize: 9 }}>{`+${dayEvents.length - 11}`}</div>
                ) : null}
              </div>
              {isToday ? <TodayCellBorder /> : null}
            </div>
          );
        })}
      </div>
    </section>
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
        fontWeight: EINK_BOLD_WEIGHT
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
            color: "#111",
            display: "flex"
          }}
        >
          {stock.code} {stock.market ? `· ${stock.market}` : ""}
        </div>
      </div>
      <div style={{ width: compact ? 74 : 92, textAlign: "right", fontSize: compact ? 17 : 21 }}>
        {formatStockPrice(stock.price)}
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

function InvestorFlowMetric({
  label,
  flow,
  value,
  justifyContent
}: {
  label: string;
  flow: StockQuote["investorFlow"];
  value: number | null | undefined;
  justifyContent: "flex-start" | "center" | "flex-end";
}) {
  const parts = investorFlowValueParts(flow, value);

  return (
    <span
      style={{
        flex: 1,
        display: "flex",
        alignItems: "baseline",
        justifyContent,
        minWidth: 0,
        whiteSpace: "nowrap"
      }}
    >
      <span>{label} </span>
      {parts.sign ? (
        <span style={{ fontSize: 14, lineHeight: 0.7, fontWeight: EINK_HEAVY_WEIGHT }}>{parts.sign}</span>
      ) : null}
      <span>{parts.body}</span>
    </span>
  );
}

function MarketTile({
  stock,
  height,
  width,
  rowIndex,
  columnIndex
}: {
  stock: StockQuote;
  height: number;
  width: number;
  rowIndex: number;
  columnIndex: number;
}) {
  const change = formatSignedStockValue(stock, stock.change);
  const rate = formatSignedStockValue(stock, stock.changePercent, "%");
  const hasInvestorFlow = Boolean(stock.investorFlow);

  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "5px 6px",
        borderTop: rowIndex === 0 ? "1px solid #111" : "0px solid transparent",
        borderLeft: columnIndex === 0 ? "1px solid #111" : "0px solid transparent",
        borderRight: "1px solid #111",
        borderBottom: "1px solid #111",
        fontWeight: EINK_BOLD_WEIGHT
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 15,
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {stock.name}
          </div>
          <div style={{ display: "flex", fontSize: 10, color: "#111", lineHeight: 1.15 }}>
            {`${stockCategoryLabel(stock)} · ${stock.code}${stock.market ? ` · ${stock.market}` : ""}`}
          </div>
        </div>
        <div
          style={{
            width: 96,
            display: "flex",
            justifyContent: "flex-end",
            textAlign: "right",
            fontSize: 18,
            fontWeight: EINK_HEAVY_WEIGHT,
            lineHeight: 1
          }}
        >
          {formatStockPrice(stock.price)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          borderTop: "1px solid #111",
          borderBottom: "1px solid #111",
          padding: "5px 0",
          lineHeight: 1
        }}
      >
        <span style={{ fontSize: 18, fontWeight: EINK_HEAVY_WEIGHT }}>{stockDirectionLabel(stock)}</span>
        <span style={{ fontSize: 19, fontWeight: EINK_HEAVY_WEIGHT }}>{rate}</span>
        <span style={{ fontSize: 14 }}>변동 {change}</span>
      </div>
      {hasInvestorFlow ? (
        <div
          style={{
            display: "flex",
            padding: "2px 0",
            fontSize: 9,
            lineHeight: 1,
            gap: 4,
            whiteSpace: "nowrap"
          }}
        >
          <InvestorFlowMetric
            label="개인"
            flow={stock.investorFlow}
            value={stock.investorFlow?.retail}
            justifyContent="flex-start"
          />
          <InvestorFlowMetric
            label="기관"
            flow={stock.investorFlow}
            value={stock.investorFlow?.institutional}
            justifyContent="center"
          />
          <InvestorFlowMetric
            label="외인"
            flow={stock.investorFlow}
            value={stock.investorFlow?.foreign}
            justifyContent="flex-end"
          />
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, lineHeight: 1 }}>
        <span>{stock.category === "equity" ? "종목" : stockCategoryLabel(stock)}</span>
        <span>{stock.market || stock.code}</span>
      </div>
    </div>
  );
}

function MarketScaleTile({
  width,
  height,
  rowIndex,
  columnIndex
}: {
  width: number;
  height: number;
  rowIndex: number;
  columnIndex: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        borderTop: rowIndex === 0 ? "1px dashed #111" : "0px solid transparent",
        borderLeft: columnIndex === 0 ? "1px dashed #111" : "0px solid transparent",
        borderRight: "1px dashed #111",
        borderBottom: "1px dashed #111",
        padding: "9px 10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontWeight: EINK_BOLD_WEIGHT
      }}
    >
      <div style={{ display: "flex", fontSize: 16 }}>표기 기준</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, lineHeight: 1.1 }}>
        <span>가격: 쉼표 생략</span>
        <span>등락: 전일 종가 대비</span>
        <span>개인/기관/외인 순매수</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 18 }}>
        % 기준
      </div>
    </div>
  );
}

const STOCK_CHART_AXIS_WIDTH = 44;

function DetailedStockChart({ stock, width: outerWidth, height }: { stock: StockQuote; width: number; height: number }) {
  const width = outerWidth - STOCK_CHART_AXIS_WIDTH;
  const range = marketGraphPercentRange(stock);
  const midY = Math.round(height / 2);
  const candleCount = Math.min(stock.candles?.length ?? 0, 36);
  const baselinePrice = (() => {
    const latestPrice = parseMarketNumber(stock.price);
    const latestRate = parseMarketNumber(stock.changePercent);
    if (latestPrice !== null && latestRate !== null && latestRate > -99) {
      return latestPrice / (1 + latestRate / 100);
    }
    return stock.history[0] ?? null;
  })();
  const toY = (value: number) => {
    if (!baselinePrice) return midY;
    const percent = ((value - baselinePrice) / baselinePrice) * 100;
    const clamped = Math.max(-range, Math.min(range, percent));
    return height / 2 - (clamped / range) * (height / 2 - 5);
  };

  const candles = candleCount > 1 ? stock.candles.slice(-candleCount) : [];
  const candleMarkup = candles
    .map((candle, index) => {
      const cx = 6 + (index / Math.max(1, candles.length - 1)) * (width - 12);
      const slot = Math.max(5, (width - 12) / Math.max(1, candles.length));
      const bodyWidth = Math.max(2, Math.min(6, slot - 2));
      const highY = toY(candle.h);
      const lowY = toY(candle.l);
      const openY = toY(candle.o);
      const closeY = toY(candle.c);
      const top = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      const fill = candle.c >= candle.o ? "#fff" : "#111";

      return (
        `<line x1="${svgNumber(cx)}" y1="${svgNumber(highY)}" x2="${svgNumber(cx)}" y2="${svgNumber(lowY)}" stroke="#111" stroke-width="1"/>` +
        `<rect x="${svgNumber(cx - bodyWidth / 2)}" y="${svgNumber(top)}" width="${svgNumber(bodyWidth)}" height="${svgNumber(bodyHeight)}" fill="${fill}" stroke="#111" stroke-width="1"/>`
      );
    })
    .join("");

  const points = percentSparklinePoints(stock, Math.max(24, Math.floor(width / 2)), width, height, range);
  const linePath = smoothSvgPath(points);
  const imageSrc = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">` +
      `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#fff" stroke="#111" stroke-width="1"/>` +
      `<line x1="4" y1="${Math.round(height / 4)}" x2="${width - 4}" y2="${Math.round(height / 4)}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 5"/>` +
      `<line x1="4" y1="${Math.round((height / 4) * 3)}" x2="${width - 4}" y2="${Math.round((height / 4) * 3)}" stroke="#111" stroke-width="0.7" stroke-dasharray="1 5"/>` +
      `<line x1="4" y1="${midY}" x2="${width - 4}" y2="${midY}" stroke="#111" stroke-width="1" stroke-dasharray="3 4"/>` +
      (candles.length > 1
        ? candleMarkup
        : `<path d="${linePath}" fill="none" stroke="#111" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`) +
      `</svg>`
  );

  const axisTicks = baselinePrice
    ? [
        { y: 5, price: formatChartPrice(baselinePrice * (1 + range / 100)) },
        { y: midY, price: formatChartPrice(baselinePrice) },
        { y: height - 5, price: formatChartPrice(baselinePrice * (1 - range / 100)) }
      ]
    : [];

  return (
    <div style={{ width: outerWidth, height, position: "relative", display: "flex", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG keeps chart rendering deterministic in next/og. */}
      <img src={imageSrc} alt="" width={width} height={height} style={{ width, height }} />
      {axisTicks.map((tick, tickIndex) => (
        <span
          key={tickIndex}
          style={{
            position: "absolute",
            left: width + 5,
            top: tick.y - 5,
            fontSize: 9,
            lineHeight: 1,
            whiteSpace: "nowrap"
          }}
        >
          {tick.price}
        </span>
      ))}
    </div>
  );
}

function stockChartLabels(stock: StockQuote): Array<{ time: string }> {
  const candles = stock.candles?.filter((candle) => Number.isFinite(candle.c)) ?? [];
  if (candles.length > 1) {
    const indexes = Array.from(new Set([
      0,
      Math.floor((candles.length - 1) / 2),
      candles.length - 1
    ]));
    return indexes.map((index) => ({
      time: candles[index].t || "--:--"
    }));
  }

  const values = stock.history.filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    return [];
  }

  return [{ time: "시작" }, { time: "중간" }, { time: "현재" }];
}

function StockChartTile({
  stock,
  index,
  width,
  height,
  rowIndex,
  columnIndex
}: {
  stock: StockQuote;
  index: number;
  width: number;
  height: number;
  rowIndex: number;
  columnIndex: number;
}) {
  const rate = formatSignedStockValue(stock, stock.changePercent, "%");
  const labels = stockChartLabels(stock);

  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        borderTop: rowIndex === 0 ? "1px solid #111" : "0px solid transparent",
        borderLeft: columnIndex === 0 ? "1px solid #111" : "0px solid transparent",
        borderRight: "1px solid #111",
        borderBottom: "1px solid #111",
        padding: "7px 8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontWeight: EINK_BOLD_WEIGHT
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              fontSize: 15,
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {index + 1}. {stock.name}
          </div>
          <div style={{ display: "flex", fontSize: 10, lineHeight: 1.1 }}>
            {stock.candles?.length > 1 ? "15분봉 캔들" : "라인"} · 전일종가 0%
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 13, lineHeight: 1.1 }}>
          <span>{formatStockPrice(stock.price)}</span>
          <span>{rate}</span>
        </div>
      </div>
      <DetailedStockChart stock={stock} width={width - 16} height={height - 100} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 4,
          fontSize: 9,
          lineHeight: 1,
          width: width - 16 - STOCK_CHART_AXIS_WIDTH
        }}
      >
        {labels.map((label, labelIndex) => (
          <span key={`${label.time}-${labelIndex}`}>{label.time}</span>
        ))}
      </div>
      {stock.investorFlow ? (
        <div style={{ display: "flex", fontSize: 9, lineHeight: 1, gap: 5, whiteSpace: "nowrap" }}>
          <InvestorFlowMetric label="개인" flow={stock.investorFlow} value={stock.investorFlow.retail} justifyContent="flex-start" />
          <InvestorFlowMetric label="기관" flow={stock.investorFlow} value={stock.investorFlow.institutional} justifyContent="center" />
          <InvestorFlowMetric label="외인" flow={stock.investorFlow} value={stock.investorFlow.foreign} justifyContent="flex-end" />
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 10 }}>개인/기관/외인 없음</div>
      )}
    </div>
  );
}

function StockChartsPanel({ data, group }: { data: DashboardData; group: number }) {
  const contentWidth = SCREEN_WIDTH - 6;
  const contentHeight = SCREEN_HEIGHT - 6 - 36;
  const tileWidth = contentWidth / 2;
  const tileHeight = contentHeight / 2;
  const stocks = data.stocks.slice(group * 4, group * 4 + 4);

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        flexWrap: "wrap"
      }}
    >
      {Array.from({ length: 4 }, (_, index) => {
        const stock = stocks[index];
        const rowIndex = Math.floor(index / 2);
        const columnIndex = index % 2;

        return stock ? (
          <StockChartTile
            key={stock.code}
            stock={stock}
            index={group * 4 + index}
            width={tileWidth}
            height={tileHeight}
            rowIndex={rowIndex}
            columnIndex={columnIndex}
          />
        ) : (
          <div
            key={`empty-${index}`}
            style={{
              width: tileWidth,
              height: tileHeight,
              boxSizing: "border-box",
              borderTop: rowIndex === 0 ? "1px dashed #111" : "0px solid transparent",
              borderLeft: columnIndex === 0 ? "1px dashed #111" : "0px solid transparent",
              borderRight: "1px dashed #111",
              borderBottom: "1px dashed #111"
            }}
          />
        );
      })}
    </section>
  );
}

function StocksPanel({ data }: { data: DashboardData }) {
  const marketItems = data.stocks.filter((stock) => stock.category !== "equity");
  const equities = data.stocks.filter((stock) => stock.category === "equity");
  const contentWidth = SCREEN_WIDTH - 6 - 6;
  const contentHeight = SCREEN_HEIGHT - 6 - 36;
  const columnGap = 0;
  const rowGap = 0;
  const tableHeight = contentHeight - 6;
  const tileWidth = (contentWidth - columnGap * 2) / 3;
  const tileHeight = (tableHeight - rowGap * 3) / 4;
  const stocks = [...marketItems.slice(0, 6), ...equities.slice(0, 5)];
  const rows = chunkArray(stocks, 3);

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: "3px",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {data.stocks.length > 0 ? (
        <div
          style={{
            width: contentWidth,
            height: tableHeight,
            display: "flex",
            flexDirection: "column",
            gap: rowGap
          }}
        >
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", gap: columnGap, height: tileHeight }}>
              {Array.from({ length: 3 }, (_, columnIndex) => {
                const stock = rows[rowIndex]?.[columnIndex];
                if (!stock) {
                  return (
                    <MarketScaleTile
                      key="scale"
                      width={tileWidth}
                      height={tileHeight}
                      rowIndex={rowIndex}
                      columnIndex={columnIndex}
                    />
                  );
                }

                return (
                  <MarketTile
                    key={stock.code}
                    stock={stock}
                    width={tileWidth}
                    height={tileHeight}
                    rowIndex={rowIndex}
                    columnIndex={columnIndex}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState height={392}>주식 정보 없음</EmptyState>
      )}
    </section>
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
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: EINK_BOLD_WEIGHT }}>신호강도</div>
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
                fontWeight: EINK_BOLD_WEIGHT
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
    <section
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
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
    </section>
  );
}

function formatNewsTime(publishedAt: string | null): string {
  if (!publishedAt) return "--:--";
  const date = new Date(publishedAt);
  if (!Number.isFinite(date.getTime())) return "--:--";
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(date);
  return formatted;
}

function NewsPanel({ data }: { data: DashboardData }) {
  const headlines = data.news?.slice(0, 12) ?? [];

  return (
    <PanelShell title="증시 뉴스" subtitle="주요 헤드라인">
      {headlines.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          {headlines.map((headline, index) => (
            <div
              key={`${headline.title}-${index}`}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid #111",
                lineHeight: 1.15
              }}
            >
              <span style={{ fontSize: 12, fontWeight: EINK_BOLD_WEIGHT, minWidth: 40 }}>
                {formatNewsTime(headline.publishedAt)}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: EINK_TEXT_WEIGHT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {headline.title}
              </span>
              <span style={{ fontSize: 11, minWidth: 52, textAlign: "right" }}>{headline.source}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState height={392}>뉴스 정보 없음</EmptyState>
      )}
    </PanelShell>
  );
}

function MainPanel({ page, data }: ScreenViewProps & { page: number }) {
  if (page === 0) return <OverviewPanel data={data} />;
  if (page === 1) return <WeeklyWeatherPanel data={data} />;
  if (page === 2) return <CalendarPanel data={data} />;
  if (page === 3) return <WeekCalendarPanel data={data} />;
  if (page === 4) return <StocksPanel data={data} />;
  if (page === 5) return <StockChartsPanel data={data} group={0} />;
  if (page === 6) return <StockChartsPanel data={data} group={1} />;
  if (page === 7) return <StockChartsPanel data={data} group={2} />;
  if (page === 8) return <NewsPanel data={data} />;
  return <StocksPanel data={data} />;
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
          fontWeight: EINK_BOLD_WEIGHT
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span>{SCREEN_PAGE_TITLES[page]}</span>
          <span style={{ fontWeight: EINK_TEXT_WEIGHT }}>|</span>
          <span>
            {page + 1}/{SCREEN_PAGE_COUNT}
          </span>
          <span style={{ fontWeight: EINK_TEXT_WEIGHT }}>|</span>
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
              <div style={{ fontSize: 18, fontWeight: EINK_TEXT_WEIGHT }}>{data.weather.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                <WeatherIcon code={data.weather.weatherCode} size={64} />
                <div style={{ fontSize: 78, lineHeight: 0.9, fontWeight: EINK_HEAVY_WEIGHT }}>
                  {formatTemperature(data.weather.temperatureC)}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: EINK_BOLD_WEIGHT }}>
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
                    fontWeight: EINK_TEXT_WEIGHT
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
