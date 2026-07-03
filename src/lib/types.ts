export type WeatherSnapshot = {
  label: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  weatherCode: number | null;
  condition: string;
  updatedAt: string;
};

export type CalendarEvent = {
  uid: string;
  title: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
};

export type DashboardData = {
  generatedAt: string;
  refreshSeconds: number;
  weather: WeatherSnapshot;
  events: CalendarEvent[];
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
