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
};

const DEFAULT_STOCKS = [
  ["krx", "005930", "삼성전자"],
  ["krx", "000660", "SK하이닉스"],
  ["krx", "080220", "제주반도체"],
  ["krx", "347850", "디앤디파마텍"],
  ["krx", "011070", "LG이노텍"],
  ["yahoo", "CL=F", "WTI 유가(달러)"]
] as const;

function defaultStockSymbols(): StockSymbol[] {
  return DEFAULT_STOCKS.map(([provider, code, fallbackName]) => ({
    provider,
    code,
    fallbackName
  }));
}

function parseStockSymbol(item: string): StockSymbol | null {
  const parts = item.split(":").map((value) => value.trim());
  if (parts.length === 0) return null;

  const [first, second, third] = parts;
  const provider = first.toLowerCase();

  if ((provider === "krx" || provider === "yahoo") && second) {
    return {
      provider,
      code: second,
      fallbackName: third || second
    };
  }

  return first
    ? {
        provider: "krx",
        code: first,
        fallbackName: second || first
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

  return parsed.length > 0 ? parsed.slice(0, 8) : defaultStockSymbols();
}

function directionFrom(item: NaverStockItem): StockQuote["direction"] {
  const code = item.compareToPreviousPrice?.code;
  const text = item.compareToPreviousPrice?.text ?? "";

  if (code === "2" || text.includes("상승")) return "up";
  if (code === "5" || text.includes("하락")) return "down";
  if (code === "3" || text.includes("보합")) return "flat";
  return "unknown";
}

async function getStockQuote(
  code: string,
  fallbackName: string,
  options: FetchFreshOptions
): Promise<StockQuote> {
  const url = new URL(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`);
  url.searchParams.set("query", `SERVICE_ITEM:${code}`);

  const response = await fetch(
    url,
    options.forceRefresh ? { cache: "no-store" } : { next: { revalidate: 60 } }
  );

  if (!response.ok) {
    throw new Error(`Stock request failed: ${code} ${response.status}`);
  }

  const data = (await response.json()) as NaverStockResponse;
  const item = data.datas?.[0] ?? {};

  return {
    code: item.itemCode ?? code,
    name: item.stockName ?? fallbackName,
    market: item.stockExchangeType?.nameKor ?? null,
    price: item.closePrice ?? null,
    change: item.compareToPreviousClosePrice ?? null,
    changePercent: item.fluctuationsRatio ?? null,
    direction: directionFrom(item),
    tradedAt: item.localTradedAt ?? null
  };
}

function formatUsdPrice(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : null;
}

function formatUsdChange(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.abs(value).toFixed(2) : null;
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

async function getYahooQuote(
  code: string,
  fallbackName: string,
  options: FetchFreshOptions
): Promise<StockQuote> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");

  const response = await fetch(
    url,
    options.forceRefresh
      ? { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } }
      : { next: { revalidate: 60 }, headers: { "User-Agent": "Mozilla/5.0" } }
  );

  if (!response.ok) {
    throw new Error(`Market request failed: ${code} ${response.status}`);
  }

  const data = (await response.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const latestClose = latestNumber(closes);
  const price = result?.meta?.regularMarketPrice ?? latestClose;
  const previousClose = result?.meta?.previousClose ?? result?.meta?.chartPreviousClose;
  const change =
    typeof price === "number" && typeof previousClose === "number" ? price - previousClose : 0;
  const changePercent =
    typeof previousClose === "number" && previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    code,
    name: fallbackName,
    market: result?.meta?.currency ?? result?.meta?.exchangeName ?? null,
    price: formatUsdPrice(price),
    change: formatUsdChange(change),
    changePercent: Math.abs(changePercent).toFixed(2),
    direction: directionFromChange(change),
    tradedAt: result?.meta?.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : null
  };
}

function getQuote(symbol: StockSymbol, options: FetchFreshOptions): Promise<StockQuote> {
  if (symbol.provider === "yahoo") {
    return getYahooQuote(symbol.code, symbol.fallbackName, options);
  }

  return getStockQuote(symbol.code, symbol.fallbackName, options);
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
