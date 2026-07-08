import type { CalendarEvent } from "./types";

const KOREAN_DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul"
});

const KOREAN_TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul"
});

export function formatTemperature(value: number | null): string {
  return value === null ? "--°C" : `${Math.round(value)}°C`;
}

export function formatPercent(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)}%`;
}

export function formatWind(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)} km/h`;
}

export function formatGeneratedAt(value: string): string {
  return KOREAN_TIME.format(new Date(value));
}

export function formatEventTime(event: CalendarEvent): string {
  const date = new Date(event.startsAt);
  if (event.allDay) {
    return `${KOREAN_DATE.format(date)} 종일`;
  }

  return `${KOREAN_DATE.format(date)} ${KOREAN_TIME.format(date)}`;
}

export function formatEventDate(event: CalendarEvent): string {
  return KOREAN_DATE.format(new Date(event.startsAt));
}

export function formatEventTimeOnly(event: CalendarEvent): string {
  if (event.allDay) return "종일";
  return KOREAN_TIME.format(new Date(event.startsAt));
}
