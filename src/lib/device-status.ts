import type { DeviceStatus } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: string | null): number | null {
  if (!value) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function safeText(value: string | null): string | null {
  if (!value) return null;
  const decoded = value.trim().slice(0, 28);
  return decoded.length > 0 ? decoded : null;
}

function parseChargeState(value: string | null): DeviceStatus["batteryChargeState"] {
  if (value === "charging" || value === "full" || value === "not_charging") {
    return value;
  }
  return "unknown";
}

export function parseDeviceStatus(searchParams: URLSearchParams): DeviceStatus {
  const wifi = searchParams.get("wifi");
  const batteryPercent = finiteNumber(searchParams.get("battery"));
  const batteryVoltage = finiteNumber(searchParams.get("batteryVoltage"));
  const page = finiteNumber(searchParams.get("page"));

  return {
    wifiStatus: wifi === "connected" || wifi === "offline" ? wifi : "unknown",
    ssid: safeText(searchParams.get("ssid")),
    rssi: finiteNumber(searchParams.get("rssi")),
    page: page === null ? 0 : clamp(Math.round(page), 0, 9),
    batteryPercent: batteryPercent === null ? null : clamp(Math.round(batteryPercent), 0, 100),
    batteryVoltage:
      batteryVoltage === null ? null : Math.round(clamp(batteryVoltage, 0, 6) * 100) / 100,
    batteryChargeState: parseChargeState(searchParams.get("charge"))
  };
}

export function previewDeviceStatus(): DeviceStatus {
  return {
    wifiStatus: "connected",
    ssid: "Home WiFi",
    rssi: -54,
    page: 0,
    batteryPercent: 82,
    batteryVoltage: 4.03,
    batteryChargeState: "charging"
  };
}

export function wifiSignalPercent(rssi: number | null): number | null {
  if (rssi === null) return null;
  return clamp(Math.round(((rssi + 90) / 60) * 100), 0, 100);
}

export function wifiSignalBars(rssi: number | null): number {
  const percent = wifiSignalPercent(rssi);
  if (percent === null) return 0;
  if (percent >= 75) return 4;
  if (percent >= 50) return 3;
  if (percent >= 25) return 2;
  if (percent > 0) return 1;
  return 0;
}

export function formatWifiStatus(status: DeviceStatus): string {
  if (status.wifiStatus === "offline") return "Wi-Fi offline";
  if (status.wifiStatus === "unknown") return "Wi-Fi --";

  const percent = wifiSignalPercent(status.rssi);
  const signal = percent === null ? "" : ` ${percent}%`;
  return `${status.ssid ?? "Wi-Fi"}${signal}`;
}

export function formatBatteryStatus(status: DeviceStatus): string {
  const percent = status.batteryPercent === null ? "--%" : `${status.batteryPercent}%`;
  const voltage = status.batteryVoltage === null ? "" : ` ${status.batteryVoltage.toFixed(2)}V`;
  const charge =
    status.batteryChargeState === "charging"
      ? " CHG"
      : status.batteryChargeState === "full"
        ? " FULL"
        : "";
  return `BAT ${percent}${voltage}${charge}`;
}

export function formatChargeStatus(status: DeviceStatus): string {
  if (status.batteryChargeState === "charging") return "Charging";
  if (status.batteryChargeState === "full") return "Full";
  if (status.batteryChargeState === "not_charging") return "Not charging";
  return "Unknown";
}
