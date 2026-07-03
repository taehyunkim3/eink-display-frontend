# ESP32 E-ink Dashboard Frontend

Vercel에 배포해서 ESP32 e-ink 보드가 가져갈 화면을 만드는 Next.js 앱입니다.

## Routes

- `/preview`: 브라우저에서 800x480 e-ink 화면을 미리 봅니다. 실제 일정과 날씨가 포함되므로 `DEVICE_AUTH_TOKEN`이 필요합니다.
- `/api/screen.png`: ESP32가 받을 800x480 PNG 화면입니다.
- `/api/screen.json`: ESP32 펌웨어가 직접 그릴 때 사용할 JSON입니다.
- `/api/health`: 배포 상태 확인용 공개 엔드포인트입니다.

## Auth

기기용 API와 미리보기는 `DEVICE_AUTH_TOKEN`이 필요합니다.

```http
GET /api/screen.png
Authorization: Bearer your-token
```

ESP32 펌웨어 구현이 단순해야 하면 쿼리 문자열도 지원합니다.

```http
GET /api/screen.png?token=your-token
```

미리보기는 브라우저에서 `/preview`를 열고 토큰을 입력합니다. 성공하면 실제 토큰 대신 미리보기 전용 HttpOnly 세션 쿠키가 1시간 유지됩니다.

토큰은 완전한 기기 인증은 아니고 공유 비밀키 방식입니다. 유출되면 Vercel 환경변수와 펌웨어 값을 같이 교체하세요.

## Google Calendar

Google Calendar 설정에서 비공개 iCal URL을 복사해 `GOOGLE_CALENDAR_ICAL_URL`에 넣으면 됩니다. 이 앱은 서버에서 `.ics`를 가져와 오늘부터 7일간의 일정을 표시합니다.

## Weather

Open-Meteo를 사용합니다. `WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_TIMEZONE`, `WEATHER_LABEL`만 설정하면 됩니다.

## Local

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000/preview`를 열고 토큰을 입력해 확인합니다.

## ESP32 request shape

권장 주기는 10분에서 1시간입니다. e-ink는 자주 갱신할수록 전력 소모와 잔상이 늘어납니다.

```cpp
// Firmware pseudo-flow
// 1. Wi-Fi connect
// 2. GET https://your-app.vercel.app/api/screen.png with Authorization header
// 3. Decode PNG or use /api/screen.json and draw text locally
// 4. Update e-ink
// 5. Deep sleep DEVICE_REFRESH_SECONDS
```
