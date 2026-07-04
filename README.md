# ESP32 E-ink Dashboard Frontend

Vercel에 배포해서 ESP32 e-ink 보드가 가져갈 화면을 만드는 Next.js 앱입니다.

## Routes

- `/preview`: 브라우저에서 800x480 e-ink 화면을 미리 봅니다. 실제 일정과 날씨가 포함되므로 `DEVICE_AUTH_TOKEN`이 필요합니다.
- `/api/screen.json`: ESP32 펌웨어가 직접 화면을 그릴 때 사용할 JSON입니다.
- `/api/screen.png`: 브라우저/호환용 800x480 PNG 화면입니다.
- `/api/health`: 배포 상태 확인용 공개 엔드포인트입니다.

## Auth

기기용 API와 미리보기는 `DEVICE_AUTH_TOKEN`이 필요합니다.

```http
GET /api/screen.json
Authorization: Bearer your-token
```

ESP32 펌웨어 구현이 단순해야 하면 쿼리 문자열도 지원합니다.

```http
GET /api/screen.json?token=your-token
```

미리보기는 브라우저에서 `/preview`를 열고 토큰을 입력합니다. 성공하면 실제 토큰 대신 미리보기 전용 HttpOnly 세션 쿠키가 1시간 유지됩니다.

토큰은 완전한 기기 인증은 아니고 공유 비밀키 방식입니다. 유출되면 Vercel 환경변수와 펌웨어 값을 같이 교체하세요.

## Google Calendar

Google Calendar 설정에서 비공개 iCal URL을 복사해 `GOOGLE_CALENDAR_ICAL_URLS`에 JSON 배열 문자열로 넣으면 됩니다. 이 앱은 서버에서 각 `.ics`를 가져와 합친 뒤 오늘부터 7일간의 일정을 표시합니다.

```env
GOOGLE_CALENDAR_ICAL_URLS='["https://calendar.google.com/calendar/ical/.../basic.ics","https://calendar.google.com/calendar/ical/.../basic.ics"]'
```

기존 단일 설정인 `GOOGLE_CALENDAR_ICAL_URL`도 계속 지원합니다.

## Weather

Open-Meteo를 사용합니다. `WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_TIMEZONE`, `WEATHER_LABEL`만 설정하면 됩니다.

## Market

국내 종목은 네이버 금융, 주요 지수/환율/WTI 유가는 Yahoo Finance를 사용합니다. `STOCK_SYMBOLS`를 설정하지 않으면 삼성전자, SK하이닉스, 제주반도체, 디앤디파마텍, LG이노텍, KOSPI, KOSDAQ, S&P 500, NASDAQ, USD/KRW, WTI 유가(달러)를 표시합니다. KRX 항목의 4번째 값은 그래프용 Yahoo 심볼입니다.

```env
STOCK_SYMBOLS="KRX:005930:삼성전자:005930.KS,KRX:000660:SK하이닉스:000660.KS,KRX:080220:제주반도체:080220.KQ,KRX:347850:디앤디파마텍:347850.KQ,KRX:011070:LG이노텍:011070.KS,YAHOO:^KS11:KOSPI,YAHOO:^KQ11:KOSDAQ,YAHOO:^GSPC:S&P 500,YAHOO:^IXIC:NASDAQ,YAHOO:KRW=X:USD/KRW,YAHOO:CL=F:WTI 유가(달러)"
```

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
// 2. GET https://your-app.vercel.app/api/screen.json with Authorization header
// 3. Draw text, lines, icons, and graphs on ESP32
// 4. Update e-ink
// 5. Deep sleep DEVICE_REFRESH_SECONDS
```
