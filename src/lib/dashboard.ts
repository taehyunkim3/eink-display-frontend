import { getCalendarEvents, hasCalendarIcalUrls } from "./calendar";
import { getNewsHeadlines } from "./news";
import { getStockQuotes } from "./stocks";
import { getMarketSummary } from "./summary";
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
    updatedAt: new Date().toISOString(),
    daily: []
  };
}

function refreshSeconds(): number {
  const value = Number(process.env.DEVICE_REFRESH_SECONDS);
  return Number.isFinite(value) && value >= 60 ? Math.floor(value) : 1800;
}

type DashboardOptions = {
  forceRefresh?: boolean;
};

function calendarConfigured(): boolean {
  try {
    return hasCalendarIcalUrls();
  } catch {
    return true;
  }
}

export async function getDashboardData(options: DashboardOptions = {}): Promise<DashboardData> {
  const notices: string[] = [];
  const [weatherResult, calendarResult, stockResult, newsResult] = await Promise.allSettled([
    getWeather(options),
    getCalendarEvents(options),
    getStockQuotes(options),
    getNewsHeadlines(options)
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

  if (!calendarConfigured()) {
    notices.push("GOOGLE_CALENDAR_ICAL_URLS 미설정");
  }

  const stocks = stockResult.status === "fulfilled" ? stockResult.value : [];

  if (stockResult.status === "rejected") {
    notices.push(stockResult.reason instanceof Error ? stockResult.reason.message : "Stock failed");
  }

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];

  if (newsResult.status === "rejected") {
    notices.push(newsResult.reason instanceof Error ? newsResult.reason.message : "News failed");
  }

  let marketSummary: string | null = null;
  try {
    marketSummary = await getMarketSummary(news, stocks);
  } catch (error) {
    notices.push(error instanceof Error ? error.message : "Market summary failed");
  }

  return {
    generatedAt: new Date().toISOString(),
    refreshSeconds: refreshSeconds(),
    weather,
    events,
    stocks,
    news,
    marketSummary,
    notices
  };
}
