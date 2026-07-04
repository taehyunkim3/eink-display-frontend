"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const BLE_SERVICE_UUID = "7b1e0001-9adb-4c9a-8b3f-e1c5a1f3d0aa";
const BLE_CONFIG_UUID = "7b1e0002-9adb-4c9a-8b3f-e1c5a1f3d0aa";
const BLE_STATUS_UUID = "7b1e0003-9adb-4c9a-8b3f-e1c5a1f3d0aa";

const REFRESH_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "600", label: "10분" },
  { value: "1800", label: "30분" },
  { value: "3600", label: "1시간" },
  { value: "7200", label: "2시간" },
];

const FULL_REFRESH_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "2", label: "2회마다" },
  { value: "5", label: "5회마다" },
  { value: "10", label: "10회마다" },
];

type ConnectionState = "idle" | "connecting" | "connected" | "error";

function statusCodeToMessage(code: string): string {
  if (code === "ready") return "기기 준비 완료. PIN을 입력하고 저장하세요.";
  if (code === "saved") return "저장 완료! 기기가 재시작됩니다.";
  if (code === "locked") return "PIN 오류가 반복되어 기기가 설정 모드를 종료했어요. 기기에서 다시 설정 모드에 진입하세요.";
  if (code.startsWith("error:pin")) return "PIN이 틀렸어요. 기기 화면의 PIN을 다시 확인하세요.";
  if (code.startsWith("error:endpoint")) return "서버 주소 형식이 잘못됐어요. http:// 또는 https:// 로 시작해야 해요.";
  if (code.startsWith("error:empty")) return "저장할 설정이 없어요. 하나 이상의 항목을 입력하세요.";
  if (code.startsWith("error:json")) return "기기가 요청을 해석하지 못했어요. 다시 시도하세요.";
  return code;
}

export default function SettingPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [deviceName, setDeviceName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pin, setPin] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [refreshSec, setRefreshSec] = useState("");
  const [fullEvery, setFullEvery] = useState("");

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const configCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
  }, []);

  useEffect(() => {
    return () => {
      deviceRef.current?.gatt?.disconnect();
    };
  }, []);

  const handleDisconnected = useCallback(() => {
    configCharRef.current = null;
    setConnection("idle");
    setStatusMessage((prev) =>
      prev.includes("저장 완료") ? prev : "기기와 연결이 끊어졌어요. 다시 연결하세요.",
    );
  }, []);

  const connect = useCallback(async () => {
    setConnection("connecting");
    setStatusMessage("");
    setSaved(false);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "EINK-SETUP" }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", handleDisconnected);

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      configCharRef.current = await service.getCharacteristic(BLE_CONFIG_UUID);

      const statusChar = await service.getCharacteristic(BLE_STATUS_UUID);
      await statusChar.startNotifications();
      statusChar.addEventListener("characteristicvaluechanged", (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const code = new TextDecoder().decode(target.value!);
        setStatusMessage(statusCodeToMessage(code));
        setSaving(false);
        if (code === "saved") {
          setSaved(true);
        }
      });

      setDeviceName(device.name ?? "EINK-SETUP");
      setConnection("connected");
      setStatusMessage("기기와 연결됐어요. 기기 화면의 PIN을 입력하세요.");
    } catch (error) {
      setConnection("error");
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(
        message.includes("User cancelled")
          ? "기기 선택이 취소됐어요."
          : `연결 실패: ${message}`,
      );
    }
  }, [handleDisconnected]);

  const save = useCallback(async () => {
    if (!configCharRef.current) {
      setStatusMessage("먼저 기기와 연결하세요.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setStatusMessage("기기 화면에 표시된 6자리 PIN을 입력하세요.");
      return;
    }

    const payload: Record<string, string | number> = { pin };
    if (ssid.trim()) {
      payload.ssid = ssid.trim();
      payload.password = password;
    }
    if (endpoint.trim()) payload.endpoint = endpoint.trim();
    if (token.trim()) payload.token = token.trim();
    if (refreshSec) payload.refreshSec = Number(refreshSec);
    if (fullEvery) payload.fullEvery = Number(fullEvery);

    setSaving(true);
    setStatusMessage("기기로 전송 중...");
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      await configCharRef.current.writeValueWithResponse(bytes);
    } catch (error) {
      setSaving(false);
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`전송 실패: ${message}`);
    }
  }, [pin, ssid, password, endpoint, token, refreshSec, fullEvery]);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
            ESP32 E-ink
          </p>
          <h1 className="mt-2 text-3xl font-bold">기기 설정 (Web Bluetooth)</h1>
          <p className="mt-2 text-neutral-700">
            기기의 설정 메뉴에서 <strong>블루투스 설정</strong>에 진입한 뒤, 아래에서 연결하세요.
          </p>
        </div>

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">지원 환경</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
            <li>가능: Android Chrome, Mac Chrome, Windows Chrome/Edge</li>
            <li>
              불가: <strong>iPhone/iPad (iOS Safari·Chrome 모두)</strong> — iOS는 Web
              Bluetooth를 지원하지 않아요. 기기의 Wi-Fi 설정 포털(기기가 여는{" "}
              <code>EINK-SETUP</code> Wi-Fi에 접속 → <code>192.168.4.1</code>)을 사용하세요.
            </li>
          </ul>
        </div>

        {supported === false && (
          <div className="border-2 border-neutral-900 bg-neutral-900 p-5 text-white">
            이 브라우저는 Web Bluetooth를 지원하지 않아요. Android/Mac/Windows의 Chrome에서
            열어주세요.
          </div>
        )}

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">1. 기기 연결</h2>
          <p className="mt-1 text-sm text-neutral-700">
            기기 화면에 <code>EINK-SETUP-XXXX</code> 이름과 6자리 PIN이 표시된 상태여야 해요.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={connect}
              disabled={supported !== true || connection === "connecting" || saved}
              className="border-2 border-neutral-900 bg-neutral-900 px-5 py-2 font-semibold text-white disabled:opacity-40"
            >
              {connection === "connecting"
                ? "연결 중..."
                : connection === "connected"
                  ? "다시 연결"
                  : "기기 연결"}
            </button>
            {connection === "connected" && (
              <span className="text-sm font-semibold text-neutral-700">
                연결됨: {deviceName}
              </span>
            )}
          </div>
        </div>

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">2. 설정 입력</h2>
          <p className="mt-1 text-sm text-neutral-700">
            비워둔 항목은 변경되지 않아요. PIN은 필수예요.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              기기 화면의 PIN (필수)
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6자리 숫자"
                className="border-2 border-neutral-900 px-3 py-2 font-mono text-lg tracking-[0.3em]"
              />
            </label>
            <div />
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Wi-Fi 이름 (SSID)
              <input
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                placeholder="2.4GHz Wi-Fi"
                className="border-2 border-neutral-900 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Wi-Fi 비밀번호
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="off"
                className="border-2 border-neutral-900 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
              서버 주소 (screen.json 엔드포인트)
              <input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://your-app.vercel.app/api/screen.json"
                className="border-2 border-neutral-900 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
              기기 인증 토큰
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                type="password"
                autoComplete="off"
                placeholder="DEVICE_AUTH_TOKEN"
                className="border-2 border-neutral-900 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              데이터 갱신 주기
              <select
                value={refreshSec}
                onChange={(event) => setRefreshSec(event.target.value)}
                className="border-2 border-neutral-900 bg-white px-3 py-2"
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              전체 새로고침 간격
              <select
                value={fullEvery}
                onChange={(event) => setFullEvery(event.target.value)}
                className="border-2 border-neutral-900 bg-white px-3 py-2"
              >
                {FULL_REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={connection !== "connected" || saving || saved}
            className="mt-5 border-2 border-neutral-900 bg-neutral-900 px-5 py-2 font-semibold text-white disabled:opacity-40"
          >
            {saving ? "전송 중..." : "설정 저장"}
          </button>
        </div>

        {statusMessage && (
          <div
            className={`border-2 border-neutral-900 p-4 font-semibold ${
              saved ? "bg-neutral-900 text-white" : "bg-white"
            }`}
          >
            {statusMessage}
          </div>
        )}

        <p className="text-sm text-neutral-600">
          Wi-Fi 비밀번호와 토큰은 이 페이지에서 기기로만 전송되며 서버로는 전송되지 않아요.{" "}
          <Link href="/" className="underline">
            홈으로
          </Link>
        </p>
      </section>
    </main>
  );
}
