export type DailyForecast = {
  date: string;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  precipitationProbabilityPercent: number | null;
  weatherCode: number | null;
  condition: string;
};

export type WeatherSnapshot = {
  label: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  weatherCode: number | null;
  condition: string;
  updatedAt: string;
  daily: DailyForecast[];
};

export type CalendarEvent = {
  uid: string;
  title: string;
  calendarName?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
};

export type StockQuote = {
  code: string;
  name: string;
  market: string | null;
  price: string | null;
  change: string | null;
  changePercent: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  tradedAt: string | null;
};

export type DashboardData = {
  generatedAt: string;
  refreshSeconds: number;
  weather: WeatherSnapshot;
  events: CalendarEvent[];
  stocks: StockQuote[];
  notices: string[];
};

export type DeviceStatus = {
  wifiStatus: "connected" | "offline" | "unknown";
  ssid: string | null;
  rssi: number | null;
  page: number;
  batteryPercent: number | null;
  batteryVoltage: number | null;
  batteryChargeState: "charging" | "full" | "not_charging" | "unknown";
};
