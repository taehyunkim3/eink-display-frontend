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

const DEFAULT_STOCKS = [
  ["005930", "삼성전자"],
  ["000660", "SK하이닉스"],
  ["035420", "NAVER"],
  ["035720", "카카오"]
] as const;

function stockSymbols(): Array<{ code: string; fallbackName: string }> {
  const raw = process.env.STOCK_SYMBOLS;
  if (!raw) {
    return DEFAULT_STOCKS.map(([code, fallbackName]) => ({ code, fallbackName }));
  }

  const parsed = raw
    .split(",")
    .map((item) => {
      const [code, name] = item.split(":").map((value) => value.trim());
      return code ? { code, fallbackName: name || code } : null;
    })
    .filter((item): item is { code: string; fallbackName: string } => item !== null);

  return parsed.length > 0
    ? parsed.slice(0, 8)
    : DEFAULT_STOCKS.map(([code, fallbackName]) => ({ code, fallbackName }));
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

export async function getStockQuotes(options: FetchFreshOptions = {}): Promise<StockQuote[]> {
  const quotes = await Promise.all(
    stockSymbols().map(({ code, fallbackName }) => getStockQuote(code, fallbackName, options))
  );
  return quotes;
}
