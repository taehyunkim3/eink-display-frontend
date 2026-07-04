import type { NewsHeadline, StockQuote } from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 9000;
const SUMMARY_CACHE_TTL_MS = 30 * 60 * 1000;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

// Serverless instances are reused between invocations, so a module-level
// cache is enough to avoid calling Gemini on every device fetch.
let cachedSummary: { text: string; createdAt: number } | null = null;

function buildPrompt(news: NewsHeadline[], stocks: StockQuote[]): string {
  const headlineLines = news
    .slice(0, 10)
    .map((item) => `- ${item.title}`)
    .join("\n");
  const marketLines = stocks
    .slice(0, 12)
    .map((stock) => {
      const sign = stock.direction === "down" ? "-" : stock.direction === "up" ? "+" : "";
      return `- ${stock.name}: ${stock.price ?? "--"} (${sign}${stock.changePercent ?? "--"}%)`;
    })
    .join("\n");

  return [
    "당신은 증시 요약 어시스턴트입니다. 아래 시장 지표와 뉴스 헤드라인을 바탕으로 오늘 증시 시황을 요약하세요.",
    "",
    "규칙:",
    "- 정확히 3줄, 각 줄 55자 이내",
    "- 불릿/번호/마크다운 없이 줄바꿈으로만 구분",
    "- 간결한 서술체(~함, ~중 등), 이모지 금지",
    "- 숫자는 지표 데이터를 우선 사용",
    "",
    "[시장 지표]",
    marketLines,
    "",
    "[뉴스 헤드라인]",
    headlineLines
  ].join("\n");
}

export async function getMarketSummary(
  news: NewsHeadline[],
  stocks: StockQuote[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || (news.length === 0 && stocks.length === 0)) {
    return null;
  }

  if (cachedSummary && Date.now() - cachedSummary.createdAt < SUMMARY_CACHE_TTL_MS) {
    return cachedSummary.text;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(news, stocks) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return cachedSummary?.text ?? null;
  }

  const normalized = text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3)
    .join("\n");

  cachedSummary = { text: normalized, createdAt: Date.now() };
  return normalized;
}
