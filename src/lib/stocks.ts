import type { StockQuote } from "./types";

type FetchFreshOptions = {
  forceRefresh?: boolean;
};

type NaverStockItem = {
  itemCode?: string;
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  fluctuationsRatio?: string;
  localTradedAt?: string;
  stockExchangeType?: {
    nameKor?: string;
  };
  compareToPreviousPrice?: {
    code?: string;
    text?: string;
  };
};

type NaverStockResponse = {
  datas?: NaverStockItem[];
};

type InvestorFlow = NonNullable<StockQuote["investorFlow"]>;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        currency?: string;
        exchangeName?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type StockSymbol = {
  provider: "krx" | "yahoo";
  code: string;
  fallbackName: string;
  category: StockQuote["category"];
  yahooCode?: string;
};

type NaverMarket = "kospi" | "kosdaq";

const DEFAULT_STOCKS = [
  ["krx", "005930", "삼성전자", "equity", "005930.KS"],
  ["krx", "000660", "SK하이닉스", "equity", "000660.KS"],
  ["krx", "080220", "제주반도체", "equity", "080220.KQ"],
  ["krx", "347850", "디앤디파마텍", "equity", "347850.KQ"],
  ["krx", "011070", "LG이노텍", "equity", "011070.KS"],
  ["yahoo", "^KS11", "KOSPI", "index"],
  ["yahoo", "^KQ11", "KOSDAQ", "index"],
  ["yahoo", "^GSPC", "S&P 500", "index"],
  ["yahoo", "^IXIC", "NASDAQ", "index"],
  ["yahoo", "KRW=X", "USD/KRW", "fx"],
  ["yahoo", "CL=F", "WTI 유가(달러)", "commodity"]
] as const;
const MARKET_FETCH_TIMEOUT_MS = 2500;

function marketFetchOptions(
  options: FetchFreshOptions,
  headers?: HeadersInit
): { cache: "no-store"; headers?: HeadersInit; signal: AbortSignal } | {
  next: { revalidate: number };
  headers?: HeadersInit;
  signal: AbortSignal;
} {
  const signal = AbortSignal.timeout(MARKET_FETCH_TIMEOUT_MS);
  return options.forceRefresh
    ? { cache: "no-store", headers, signal }
    : { next: { revalidate: 60 }, headers, signal };
}

function defaultStockSymbols(): StockSymbol[] {
  return DEFAULT_STOCKS.map(([provider, code, fallbackName, category, yahooCode]) => ({
    provider,
    code,
    fallbackName,
    category,
    yahooCode
  }));
}

function inferYahooCategory(code: string): StockQuote["category"] {
  if (code.endsWith("=X")) return "fx";
  if (code.endsWith("=F")) return "commodity";
  return "index";
}

function parseStockSymbol(item: string): StockSymbol | null {
  const parts = item.split(":").map((value) => value.trim());
  if (parts.length === 0) return null;

  const [first, second, third, fourth] = parts;
  const provider = first.toLowerCase();

  if ((provider === "krx" || provider === "yahoo") && second) {
    return {
      provider,
      code: second,
      fallbackName: third || second,
      category: provider === "krx" ? "equity" : inferYahooCategory(second),
      yahooCode: provider === "krx" ? fourth : undefined
    };
  }

  return first
    ? {
        provider: "krx",
        code: first,
        fallbackName: second || first,
        category: "equity",
        yahooCode: third
      }
    : null;
}

function stockSymbols(): StockSymbol[] {
  const raw = process.env.STOCK_SYMBOLS;
  if (!raw) {
    return defaultStockSymbols();
  }

  const parsed = raw
    .split(",")
    .map(parseStockSymbol)
    .filter((item): item is StockSymbol => item !== null);

  return parsed.length > 0 ? parsed.slice(0, 12) : defaultStockSymbols();
}

function directionFrom(item: NaverStockItem): StockQuote["direction"] {
  const code = item.compareToPreviousPrice?.code;
  const text = item.compareToPreviousPrice?.text ?? "";

  if (code === "2" || text.includes("상승")) return "up";
  if (code === "5" || text.includes("하락")) return "down";
  if (code === "3" || text.includes("보합")) return "flat";
  return "unknown";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSignedIntegerCell(value: string): number | null {
  const text = stripHtml(value).replace(/,/g, "").replace(/\s/g, "");
  const match = text.match(/[+-]?\d+/);
  if (!match) return null;

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInvestorFlowHtml(html: string): InvestorFlow | null {
  const table = html.match(/<caption>\s*외국인 기관\s*<\/caption>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  const tbody = table?.[1];
  if (!tbody) return null;

  const rowMatches = tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  for (const rowMatch of rowMatches) {
    const cells = Array.from(rowMatch[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/g)).map(
      (cellMatch) => cellMatch[1]
    );
    const date = stripHtml(cells[0] ?? "");

    if (!/^\d{2}\/\d{2}$/.test(date) || cells.length < 5) {
      continue;
    }

    const foreign = parseSignedIntegerCell(cells[3]);
    const institutional = parseSignedIntegerCell(cells[4]);
    const retail =
      typeof foreign === "number" && typeof institutional === "number"
        ? -(foreign + institutional)
        : null;

    return {
      date,
      unit: "shares",
      retail,
      institutional,
      foreign
    };
  }

  return null;
}

async function getStockInvestorFlow(
  code: string,
  options: FetchFreshOptions
): Promise<InvestorFlow | undefined> {
  const url = new URL("https://finance.naver.com/item/main.naver");
  url.searchParams.set("code", code);

  const response = await fetch(
    url,
    marketFetchOptions(options, { "User-Agent": "Mozilla/5.0" })
  );

  if (!response.ok) {
    throw new Error(`Investor flow request failed: ${code} ${response.status}`);
  }

  return parseInvestorFlowHtml(await response.text()) ?? undefined;
}

function marketSosok(market: NaverMarket): string {
  return market === "kosdaq" ? "02" : "";
}

function marketFromYahooCode(code: string): NaverMarket | null {
  if (code === "^KS11") return "kospi";
  if (code === "^KQ11") return "kosdaq";
  return null;
}

async function decodeEucKrResponse(response: Response): Promise<string> {
  return new TextDecoder("euc-kr").decode(await response.arrayBuffer());
}

function todayKoreaBizdate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  })
    .format(new Date())
    .replaceAll("-", "");
}

function parseMarketBizdate(html: string): string {
  return html.match(/investorDealTrendTime\.naver\?bizdate=(\d{8})/)?.[1] ?? todayKoreaBizdate();
}

function parseMarketInvestorFlowHtml(html: string): InvestorFlow | null {
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);

  for (const rowMatch of rowMatches) {
    const cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map(
      (cellMatch) => cellMatch[1]
    );
    const time = stripHtml(cells[0] ?? "");

    if (!/^\d{2}:\d{2}$/.test(time) || cells.length < 4) {
      continue;
    }

    return {
      date: time,
      unit: "hundredMillionKrw",
      retail: parseSignedIntegerCell(cells[1]),
      foreign: parseSignedIntegerCell(cells[2]),
      institutional: parseSignedIntegerCell(cells[3])
    };
  }

  return null;
}

async function getMarketInvestorFlow(
  market: NaverMarket,
  options: FetchFreshOptions
): Promise<InvestorFlow | undefined> {
  const sosok = marketSosok(market);
  const pageUrl = new URL("https://finance.naver.com/sise/sise_trans_style.naver");
  if (sosok) pageUrl.searchParams.set("sosok", sosok);

  const pageResponse = await fetch(
    pageUrl,
    marketFetchOptions(options, { "User-Agent": "Mozilla/5.0" })
  );

  if (!pageResponse.ok) {
    throw new Error(`Market investor page failed: ${market} ${pageResponse.status}`);
  }

  const bizdate = parseMarketBizdate(await decodeEucKrResponse(pageResponse));
  const dataUrl = new URL("https://finance.naver.com/sise/investorDealTrendTime.naver");
  dataUrl.searchParams.set("bizdate", bizdate);
  dataUrl.searchParams.set("sosok", sosok);

  const dataResponse = await fetch(
    dataUrl,
    marketFetchOptions(options, { "User-Agent": "Mozilla/5.0" })
  );

  if (!dataResponse.ok) {
    throw new Error(`Market investor flow failed: ${market} ${dataResponse.status}`);
  }

  return parseMarketInvestorFlowHtml(await decodeEucKrResponse(dataResponse)) ?? undefined;
}

async function getStockQuote(
  code: string,
  fallbackName: string,
  yahooCode: string | undefined,
  options: FetchFreshOptions
): Promise<StockQuote> {
  const url = new URL(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`);
  url.searchParams.set("query", `SERVICE_ITEM:${code}`);

  const response = await fetch(url, marketFetchOptions(options));

  if (!response.ok) {
    throw new Error(`Stock request failed: ${code} ${response.status}`);
  }

  const data = (await response.json()) as NaverStockResponse;
  const item = data.datas?.[0] ?? {};
  let history: number[] = [];
  let investorFlow: InvestorFlow | undefined;

  const [historyResult, investorFlowResult] = await Promise.allSettled([
    yahooCode ? getYahooSnapshot(yahooCode, options) : Promise.resolve({ history: [] }),
    getStockInvestorFlow(code, options)
  ]);

  if (historyResult.status === "fulfilled") {
    history = historyResult.value.history;
  }

  if (investorFlowResult.status === "fulfilled") {
    investorFlow = investorFlowResult.value;
  }

  return {
    code: item.itemCode ?? code,
    name: item.stockName ?? fallbackName,
    market: item.stockExchangeType?.nameKor ?? null,
    category: "equity",
    price: item.closePrice ?? null,
    change: item.compareToPreviousClosePrice ?? null,
    changePercent: item.fluctuationsRatio ?? null,
    direction: directionFrom(item),
    tradedAt: item.localTradedAt ?? null,
    history,
    investorFlow
  };
}

function formatMarketPrice(value: number | undefined, category: StockQuote["category"]): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (category === "fx") return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (category === "index") return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toFixed(2);
}

function formatMarketChange(value: number | undefined, category: StockQuote["category"]): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (category === "index" || category === "fx") {
    return Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return Math.abs(value).toFixed(2);
}

function directionFromChange(change: number): StockQuote["direction"] {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

function latestNumber(values: Array<number | null>): number | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number") return value;
  }

  return undefined;
}

type YahooSnapshot = {
  price: number | undefined;
  previousClose: number | undefined;
  market: string | null;
  tradedAt: string | null;
  history: number[];
};

async function getYahooChart(
  code: string,
  options: FetchFreshOptions,
  range: string,
  interval: string
) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);

  const response = await fetch(
    url,
    marketFetchOptions(options, { "User-Agent": "Mozilla/5.0" })
  );

  if (!response.ok) {
    throw new Error(`Market request failed: ${code} ${response.status}`);
  }

  return (await response.json()) as YahooChartResponse;
}

async function getYahooSnapshot(
  code: string,
  options: FetchFreshOptions
): Promise<YahooSnapshot> {
  let data = await getYahooChart(code, options, "1d", "15m");
  let result = data.chart?.result?.[0];
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
    (value): value is number => typeof value === "number"
  );

  if (closes.length < 2) {
    data = await getYahooChart(code, options, "5d", "1d");
    result = data.chart?.result?.[0];
  }

  const history = (result?.indicators?.quote?.[0]?.close ?? []).filter(
    (value): value is number => typeof value === "number"
  );
  const latestClose = latestNumber(history);
  const previousSeriesClose = history.length >= 2 ? history[history.length - 2] : undefined;
  const price = result?.meta?.regularMarketPrice ?? latestClose;
  const previousClose =
    result?.meta?.previousClose ?? result?.meta?.chartPreviousClose ?? previousSeriesClose;

  return {
    price,
    previousClose,
    market: result?.meta?.currency ?? result?.meta?.exchangeName ?? null,
    tradedAt: result?.meta?.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : null,
    history
  };
}

async function getYahooQuote(
  code: string,
  fallbackName: string,
  category: StockQuote["category"],
  options: FetchFreshOptions
): Promise<StockQuote> {
  const market = marketFromYahooCode(code);
  const [snapshotResult, investorFlowResult] = await Promise.allSettled([
    getYahooSnapshot(code, options),
    market ? getMarketInvestorFlow(market, options) : Promise.resolve(undefined)
  ]);

  if (snapshotResult.status === "rejected") {
    throw snapshotResult.reason;
  }

  const snapshot = snapshotResult.value;
  const investorFlow =
    investorFlowResult.status === "fulfilled" ? investorFlowResult.value : undefined;
  const change =
    typeof snapshot.price === "number" && typeof snapshot.previousClose === "number"
      ? snapshot.price - snapshot.previousClose
      : 0;
  const changePercent =
    typeof snapshot.previousClose === "number" && snapshot.previousClose !== 0
      ? (change / snapshot.previousClose) * 100
      : 0;

  return {
    code,
    name: fallbackName,
    market: snapshot.market,
    category,
    price: formatMarketPrice(snapshot.price, category),
    change: formatMarketChange(change, category),
    changePercent: Math.abs(changePercent).toFixed(2),
    direction: directionFromChange(change),
    tradedAt: snapshot.tradedAt,
    history: snapshot.history,
    investorFlow
  };
}

function getQuote(symbol: StockSymbol, options: FetchFreshOptions): Promise<StockQuote> {
  if (symbol.provider === "yahoo") {
    return getYahooQuote(symbol.code, symbol.fallbackName, symbol.category, options);
  }

  return getStockQuote(symbol.code, symbol.fallbackName, symbol.yahooCode, options);
}

export async function getStockQuotes(options: FetchFreshOptions = {}): Promise<StockQuote[]> {
  const results = await Promise.allSettled(
    stockSymbols().map((symbol) => getQuote(symbol, options))
  );
  const quotes = results
    .filter((result): result is PromiseFulfilledResult<StockQuote> => result.status === "fulfilled")
    .map((result) => result.value);

  if (quotes.length === 0) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    throw firstFailure?.reason ?? new Error("Stock request failed");
  }

  return quotes;
}
