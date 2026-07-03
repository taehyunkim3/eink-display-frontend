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

export function parseDeviceStatus(searchParams: URLSearchParams): DeviceStatus {
  const wifi = searchParams.get("wifi");
  const batteryPercent = finiteNumber(searchParams.get("battery"));
  const batteryVoltage = finiteNumber(searchParams.get("batteryVoltage"));

  return {
    wifiStatus: wifi === "connected" || wifi === "offline" ? wifi : "unknown",
    ssid: safeText(searchParams.get("ssid")),
    rssi: finiteNumber(searchParams.get("rssi")),
    batteryPercent: batteryPercent === null ? null : clamp(Math.round(batteryPercent), 0, 100),
    batteryVoltage:
      batteryVoltage === null ? null : Math.round(clamp(batteryVoltage, 0, 6) * 100) / 100
  };
}

export function previewDeviceStatus(): DeviceStatus {
  return {
    wifiStatus: "connected",
    ssid: "Home WiFi",
    rssi: -54,
    batteryPercent: 82,
    batteryVoltage: 4.03
  };
}

export function formatWifiStatus(status: DeviceStatus): string {
  if (status.wifiStatus === "offline") return "Wi-Fi offline";
  if (status.wifiStatus === "unknown") return "Wi-Fi --";

  const signal = status.rssi === null ? "" : ` ${status.rssi}dBm`;
  return `${status.ssid ?? "Wi-Fi"}${signal}`;
}

export function formatBatteryStatus(status: DeviceStatus): string {
  const percent = status.batteryPercent === null ? "--%" : `${status.batteryPercent}%`;
  const voltage = status.batteryVoltage === null ? "" : ` ${status.batteryVoltage.toFixed(2)}V`;
  return `BAT ${percent}${voltage}`;
}
