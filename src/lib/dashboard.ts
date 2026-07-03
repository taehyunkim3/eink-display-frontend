import { getCalendarEvents } from "./calendar";
import { getWeather } from "./weather";
import type { DashboardData, WeatherSnapshot } from "./types";

function fallbackWeather(message: string): WeatherSnapshot {
  return {
    label: process.env.WEATHER_LABEL ?? "Seoul",
    temperatureC: null,
    apparentTemperatureC: null,
    humidityPercent: null,
    windKph: null,
    weatherCode: null,
    condition: message,
    updatedAt: new Date().toISOString()
  };
}

function refreshSeconds(): number {
  const value = Number(process.env.DEVICE_REFRESH_SECONDS);
  return Number.isFinite(value) && value >= 60 ? Math.floor(value) : 1800;
}

type DashboardOptions = {
  forceRefresh?: boolean;
};

export async function getDashboardData(options: DashboardOptions = {}): Promise<DashboardData> {
  const notices: string[] = [];
  const [weatherResult, calendarResult] = await Promise.allSettled([
    getWeather(options),
    getCalendarEvents(options)
  ]);

  const weather =
    weatherResult.status === "fulfilled"
      ? weatherResult.value
      : fallbackWeather("날씨 연결 실패");

  if (weatherResult.status === "rejected") {
    notices.push(weatherResult.reason instanceof Error ? weatherResult.reason.message : "Weather failed");
  }

  const events = calendarResult.status === "fulfilled" ? calendarResult.value : [];

  if (calendarResult.status === "rejected") {
    notices.push(
      calendarResult.reason instanceof Error ? calendarResult.reason.message : "Calendar failed"
    );
  }

  if (!process.env.GOOGLE_CALENDAR_ICAL_URL) {
    notices.push("GOOGLE_CALENDAR_ICAL_URL 미설정");
  }

  return {
    generatedAt: new Date().toISOString(),
    refreshSeconds: refreshSeconds(),
    weather,
    events,
    notices
  };
}
