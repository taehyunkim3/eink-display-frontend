import type { HourlyForecast, WeatherSnapshot } from "./types";

type OpenMeteoCurrent = {
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  weather_code?: number;
  time?: string;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    weather_code?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
  };
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "맑음",
  1: "대체로 맑음",
  2: "구름 조금",
  3: "흐림",
  45: "안개",
  48: "서리 안개",
  51: "이슬비 약함",
  53: "이슬비",
  55: "이슬비 강함",
  61: "비 약함",
  63: "비",
  65: "비 강함",
  71: "눈 약함",
  73: "눈",
  75: "눈 강함",
  80: "소나기 약함",
  81: "소나기",
  82: "소나기 강함",
  95: "뇌우"
};

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

type FetchFreshOptions = {
  forceRefresh?: boolean;
};

const HOURLY_DISPLAY_HOURS = new Set([6, 12, 18, 23]);

function localDateKey(value: string): string {
  return value.slice(0, 10);
}

function localHour(value: string): number | null {
  const match = value.match(/T(\d{2}):/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isFinite(hour) ? hour : null;
}

function hourlyCondition(code: number | null): string {
  return code === null ? "날씨 정보 없음" : WEATHER_CODE_LABELS[code] ?? "날씨 확인";
}

export async function getWeather(options: FetchFreshOptions = {}): Promise<WeatherSnapshot> {
  const latitude = numberEnv("WEATHER_LATITUDE", 37.5665);
  const longitude = numberEnv("WEATHER_LONGITUDE", 126.978);
  const timezone = process.env.WEATHER_TIMEZONE ?? "Asia/Seoul";
  const label = process.env.WEATHER_LABEL ?? "Seoul";

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code,wind_speed_10m"
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", timezone);

  const response = await fetch(
    url,
    options.forceRefresh ? { cache: "no-store" } : { next: { revalidate: 600 } }
  );

  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current ?? {};
  const weatherCode = current.weather_code ?? null;
  const daily = data.daily ?? {};
  const dates = daily.time ?? [];
  const hourly = data.hourly ?? {};
  const hourlyItems = (hourly.time ?? []).reduce<Record<string, HourlyForecast[]>>(
    (acc, time, index) => {
      const hour = localHour(time);
      if (hour === null || !HOURLY_DISPLAY_HOURS.has(hour)) return acc;

      const hourlyWeatherCode = hourly.weather_code?.[index] ?? null;
      const key = localDateKey(time);
      acc[key] = [
        ...(acc[key] ?? []),
        {
          time,
          temperatureC: hourly.temperature_2m?.[index] ?? null,
          precipitationProbabilityPercent: hourly.precipitation_probability?.[index] ?? null,
          weatherCode: hourlyWeatherCode,
          windKph: hourly.wind_speed_10m?.[index] ?? null,
          condition: hourlyCondition(hourlyWeatherCode)
        }
      ];
      return acc;
    },
    {}
  );

  return {
    label,
    temperatureC: current.temperature_2m ?? null,
    apparentTemperatureC: current.apparent_temperature ?? null,
    humidityPercent: current.relative_humidity_2m ?? null,
    windKph: current.wind_speed_10m ?? null,
    weatherCode,
    condition:
      weatherCode === null ? "날씨 정보 없음" : WEATHER_CODE_LABELS[weatherCode] ?? "날씨 확인",
    updatedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    daily: dates.slice(0, 7).map((date, index) => {
      const dailyWeatherCode = daily.weather_code?.[index] ?? null;
      return {
        date,
        minTemperatureC: daily.temperature_2m_min?.[index] ?? null,
        maxTemperatureC: daily.temperature_2m_max?.[index] ?? null,
        precipitationProbabilityPercent: daily.precipitation_probability_max?.[index] ?? null,
        weatherCode: dailyWeatherCode,
        condition:
          dailyWeatherCode === null
            ? "날씨 정보 없음"
            : WEATHER_CODE_LABELS[dailyWeatherCode] ?? "날씨 확인",
        hourly: hourlyItems[date] ?? []
      };
    })
  };
}
