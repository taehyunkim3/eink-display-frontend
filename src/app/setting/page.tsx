"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const BLE_SERVICE_UUID = "7b1e0001-9adb-4c9a-8b3f-e1c5a1f3d0aa";
const BLE_CONFIG_UUID = "7b1e0002-9adb-4c9a-8b3f-e1c5a1f3d0aa";
const BLE_STATUS_UUID = "7b1e0003-9adb-4c9a-8b3f-e1c5a1f3d0aa";

const PAGE_TITLES = [
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

const REFRESH_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "600", label: "10분" },
  { value: "1800", label: "30분" },
  { value: "3600", label: "1시간" },
  { value: "7200", label: "2시간" }
];

const FULL_REFRESH_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "2", label: "2회 전환마다" },
  { value: "3", label: "3회 전환마다" },
  { value: "5", label: "5회 전환마다" },
  { value: "10", label: "10회 전환마다" },
  { value: "20", label: "20회 전환마다" }
];

const ROTATE_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "0", label: "자동 순환 끄기" },
  { value: "30", label: "30초마다" },
  { value: "60", label: "1분마다" },
  { value: "300", label: "5분마다" },
  { value: "600", label: "10분마다" },
  { value: "1800", label: "30분마다" }
];

const START_PAGE_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "-1", label: "마지막 본 페이지 유지" },
  ...PAGE_TITLES.map((title, index) => ({ value: String(index), label: `${index + 1}. ${title}` }))
];

const DEEP_SLEEP_OPTIONS = [
  { value: "", label: "변경 안 함" },
  { value: "0", label: "끄기 (버튼 즉시 반응)" },
  { value: "1", label: "켜기 (배터리 절약, 버튼 반응 없음)" }
];

type ConnectionState = "idle" | "connecting" | "connected" | "error";

type DeviceConfig = {
  ssid?: string;
  endpoint?: string;
  refreshSec?: number;
  fullEvery?: number;
  startPage?: number;
  pageMask?: number;
  rotateSec?: number;
  deepSleep?: boolean;
};

function statusCodeToMessage(code: string): string {
  if (code === "ready") return "기기 준비 완료. PIN을 입력하고 저장하세요.";
  if (code === "saved") return "저장 완료! 기기가 재시작됩니다.";
  if (code === "locked")
    return "PIN 오류가 반복되어 기기가 설정 모드를 종료했어요. 기기에서 다시 설정 모드에 진입하세요.";
  if (code.startsWith("error:pin")) return "PIN이 틀렸어요. 기기 화면의 PIN을 다시 확인하세요.";
  if (code.startsWith("error:endpoint"))
    return "서버 주소 형식이 잘못됐어요. http:// 또는 https:// 로 시작해야 해요.";
  if (code.startsWith("error:empty")) return "저장할 설정이 없어요. 하나 이상의 항목을 입력하세요.";
  if (code.startsWith("error:json")) return "기기가 요청을 해석하지 못했어요. 다시 시도하세요.";
  return code;
}

export default function SettingPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [deviceName, setDeviceName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pin, setPin] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [refreshSec, setRefreshSec] = useState("");
  const [fullEvery, setFullEvery] = useState("");
  const [startPage, setStartPage] = useState("");
  const [rotateSec, setRotateSec] = useState("");
  const [deepSleep, setDeepSleep] = useState("");
  // null = 변경 안 함, otherwise a 9-bit visibility array
  const [visiblePages, setVisiblePages] = useState<boolean[] | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const configCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const pinRef = useRef(pin);
  pinRef.current = pin;

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
  }, []);

  useEffect(() => {
    return () => {
      deviceRef.current?.gatt?.disconnect();
    };
  }, []);

  const applyDeviceConfig = useCallback((config: DeviceConfig) => {
    if (typeof config.ssid === "string") setSsid(config.ssid);
    if (typeof config.endpoint === "string") setEndpoint(config.endpoint);
    if (typeof config.refreshSec === "number") setRefreshSec(String(config.refreshSec));
    if (typeof config.fullEvery === "number") setFullEvery(String(config.fullEvery));
    if (typeof config.startPage === "number") setStartPage(String(config.startPage));
    if (typeof config.rotateSec === "number") setRotateSec(String(config.rotateSec));
    if (typeof config.deepSleep === "boolean") setDeepSleep(config.deepSleep ? "1" : "0");
    if (typeof config.pageMask === "number") {
      setVisiblePages(PAGE_TITLES.map((_, index) => ((config.pageMask! >> index) & 1) === 1));
    }
  }, []);

  const handleDisconnected = useCallback(() => {
    configCharRef.current = null;
    setConnection("idle");
    setStatusMessage((prev) =>
      prev.includes("저장 완료") ? prev : "기기와 연결이 끊어졌어요. 다시 연결하세요."
    );
  }, []);

  const connect = useCallback(async () => {
    setConnection("connecting");
    setStatusMessage("");
    setSaved(false);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "EINK-SETUP" }],
        optionalServices: [BLE_SERVICE_UUID]
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
        const raw = new TextDecoder().decode(target.value!);
        setBusy(false);
        if (raw.startsWith("{")) {
          try {
            const parsed = JSON.parse(raw) as { config?: DeviceConfig };
            if (parsed.config) {
              applyDeviceConfig(parsed.config);
              setStatusMessage("현재 설정을 불러왔어요. 수정 후 저장하세요.");
              return;
            }
          } catch {
            // fall through to plain status handling
          }
        }
        setStatusMessage(statusCodeToMessage(raw));
        if (raw === "saved") {
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
        message.includes("User cancelled") ? "기기 선택이 취소됐어요." : `연결 실패: ${message}`
      );
    }
  }, [handleDisconnected, applyDeviceConfig]);

  const writePayload = useCallback(async (payload: Record<string, unknown>) => {
    if (!configCharRef.current) {
      setStatusMessage("먼저 기기와 연결하세요.");
      return false;
    }
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      await configCharRef.current.writeValueWithResponse(bytes);
      return true;
    } catch (error) {
      setBusy(false);
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`전송 실패: ${message}`);
      return false;
    }
  }, []);

  const validPin = /^\d{6}$/.test(pin);

  const loadConfig = useCallback(async () => {
    if (!validPin) {
      setStatusMessage("기기 화면에 표시된 6자리 PIN을 먼저 입력하세요.");
      return;
    }
    setBusy(true);
    setStatusMessage("현재 설정을 불러오는 중...");
    await writePayload({ pin: pinRef.current, action: "get" });
  }, [validPin, writePayload]);

  const save = useCallback(async () => {
    if (!validPin) {
      setStatusMessage("기기 화면에 표시된 6자리 PIN을 입력하세요.");
      return;
    }

    const payload: Record<string, unknown> = { pin };
    if (ssid.trim()) {
      payload.ssid = ssid.trim();
      payload.password = password;
    }
    if (endpoint.trim()) payload.endpoint = endpoint.trim();
    if (token.trim()) payload.token = token.trim();
    if (refreshSec) payload.refreshSec = Number(refreshSec);
    if (fullEvery) payload.fullEvery = Number(fullEvery);
    if (startPage) payload.startPage = Number(startPage);
    if (rotateSec) payload.rotateSec = Number(rotateSec);
    if (deepSleep) payload.deepSleep = deepSleep === "1";
    if (visiblePages) {
      const mask = visiblePages.reduce((acc, visible, index) => (visible ? acc | (1 << index) : acc), 0);
      if (mask === 0) {
        setStatusMessage("최소 한 개의 페이지는 표시해야 해요.");
        return;
      }
      payload.pageMask = mask;
    }

    setBusy(true);
    setStatusMessage("기기로 전송 중...");
    await writePayload(payload);
  }, [
    validPin,
    pin,
    ssid,
    password,
    endpoint,
    token,
    refreshSec,
    fullEvery,
    startPage,
    rotateSec,
    deepSleep,
    visiblePages,
    writePayload
  ]);

  const togglePage = useCallback((index: number) => {
    setVisiblePages((prev) => {
      const next = prev ? [...prev] : PAGE_TITLES.map(() => true);
      next[index] = !next[index];
      return next;
    });
  }, []);

  const selectClass = "border-2 border-neutral-900 bg-white px-3 py-2";
  const inputClass = "border-2 border-neutral-900 px-3 py-2";
  const labelClass = "flex flex-col gap-1 text-sm font-semibold";

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
            ESP32 E-ink
          </p>
          <h1 className="mt-2 text-3xl font-bold">기기 설정 (Web Bluetooth)</h1>
          <p className="mt-2 text-neutral-700">
            기기에서 설정 모드(상단 버튼 2개 길게)에 진입한 뒤, 아래에서 연결하세요. 보안을 위해
            설정 모드는 <strong>5분 후 자동 종료</strong>되고, PIN을 3회 틀리면 즉시 종료돼요.
          </p>
        </div>

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">플랫폼별 설정 가능 범위</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
            <li>
              <strong>이 페이지 (블루투스)</strong>: 모든 설정 — Wi-Fi, 서버, 갱신 주기, 페이지
              구성, 자동 순환, 절전. 지원: Android/Mac/Windows Chrome·Edge.{" "}
              <strong>iPhone/iPad 불가</strong> (iOS는 Web Bluetooth 미지원).
            </li>
            <li>
              <strong>Wi-Fi 접속 포털</strong>: Wi-Fi 설정만 가능. 기기가 여는{" "}
              <code>EINK-SETUP-XXXX</code> Wi-Fi에 접속 → <code>http://192.168.4.1</code>. iPhone
              포함 모든 기기에서 가능.
            </li>
            <li>
              <strong>기기 버튼</strong>: 설정 불가. 설정 모드 진입(상단 버튼 2개 길게)과
              닫기(새로고침 버튼)만 가능.
            </li>
          </ul>
        </div>

        {supported === false && (
          <div className="border-2 border-neutral-900 bg-neutral-900 p-5 text-white">
            이 브라우저는 Web Bluetooth를 지원하지 않아요. Android/Mac/Windows의 Chrome에서
            열어주세요. iPhone은 위의 Wi-Fi 접속 포털 방식을 사용하세요.
          </div>
        )}

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">1. 기기 연결 + PIN</h2>
          <p className="mt-1 text-sm text-neutral-700">
            기기 화면에 <code>EINK-SETUP-XXXX</code> 이름과 6자리 PIN이 표시된 상태여야 해요.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
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
              <span className="text-sm font-semibold text-neutral-700">연결됨: {deviceName}</span>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              기기 화면의 PIN (필수)
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6자리 숫자"
                className={`${inputClass} font-mono text-lg tracking-[0.3em]`}
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={loadConfig}
                disabled={connection !== "connected" || busy || saved || !validPin}
                className="border-2 border-neutral-900 bg-white px-5 py-2 font-semibold disabled:opacity-40"
              >
                현재 설정 불러오기
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            불러오기에는 Wi-Fi 비밀번호와 토큰이 포함되지 않아요 (기기가 비밀값은 절대 내보내지
            않음).
          </p>
        </div>

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">2. 네트워크 / 서버</h2>
          <p className="mt-1 text-sm text-neutral-700">비워둔 항목은 변경되지 않아요.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Wi-Fi 이름 (SSID)
              <input
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                placeholder="2.4GHz Wi-Fi"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Wi-Fi 비밀번호
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              서버 주소 (screen.json 엔드포인트)
              <input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://your-app.vercel.app/api/screen.json"
                className={`${inputClass} font-mono text-sm`}
              />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              기기 인증 토큰
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                type="password"
                autoComplete="off"
                placeholder="DEVICE_AUTH_TOKEN"
                className={`${inputClass} font-mono text-sm`}
              />
            </label>
          </div>
        </div>

        <div className="border-2 border-neutral-900 bg-white p-5">
          <h2 className="text-lg font-semibold">3. 화면 / 갱신</h2>
          <p className="mt-1 text-sm text-neutral-700">
            흑백 e-ink 패널 특성상 대비/농도 조절은 지원되지 않아요.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              데이터 갱신 주기
              <select
                value={refreshSec}
                onChange={(event) => setRefreshSec(event.target.value)}
                className={selectClass}
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              전체 새로고침 간격 (잔상 제거)
              <select
                value={fullEvery}
                onChange={(event) => setFullEvery(event.target.value)}
                className={selectClass}
              >
                {FULL_REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              부팅 시 시작 페이지
              <select
                value={startPage}
                onChange={(event) => setStartPage(event.target.value)}
                className={selectClass}
              >
                {START_PAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              자동 페이지 순환
              <select
                value={rotateSec}
                onChange={(event) => setRotateSec(event.target.value)}
                className={selectClass}
              >
                {ROTATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Deep Sleep (절전)
              <select
                value={deepSleep}
                onChange={(event) => setDeepSleep(event.target.value)}
                className={selectClass}
              >
                {DEEP_SLEEP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {deepSleep === "1" && (
            <p className="mt-3 border-2 border-neutral-900 bg-neutral-100 p-3 text-sm">
              Deep Sleep을 켜면 갱신 주기 사이에 기기가 완전히 잠들어 배터리는 크게 절약되지만,
              버튼(페이지 이동/설정 진입)이 즉시 반응하지 않아요. 설정 모드에 다시 진입하려면
              기기가 깨어난 직후에 버튼을 눌러야 해요.
            </p>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">표시할 페이지</span>
              <span className="text-xs text-neutral-500">
                {visiblePages ? "변경됨 (저장 시 적용)" : "변경 안 함"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {PAGE_TITLES.map((title, index) => {
                const checked = visiblePages ? visiblePages[index] : true;
                return (
                  <label
                    key={title}
                    className={`flex cursor-pointer items-center gap-2 border-2 border-neutral-900 px-3 py-2 text-sm font-semibold ${
                      checked ? "bg-white" : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePage(index)}
                      className="accent-neutral-900"
                    />
                    {index + 1}. {title}
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={connection !== "connected" || busy || saved}
            className="mt-6 border-2 border-neutral-900 bg-neutral-900 px-6 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy ? "전송 중..." : "설정 저장"}
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
