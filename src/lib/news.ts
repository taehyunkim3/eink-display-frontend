import type { NewsHeadline } from "./types";

type FetchFreshOptions = {
  forceRefresh?: boolean;
};

const NEWS_FEEDS = [
  { url: "https://www.hankyung.com/feed/finance", source: "한경증권" },
  { url: "https://www.hankyung.com/feed/economy", source: "한경경제" }
] as const;
const NEWS_FETCH_TIMEOUT_MS = 4000;
const MAX_HEADLINES = 12;

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return raw.length > 0 ? decodeXmlEntities(raw) : null;
}

function parseRssItems(xml: string, source: string): NewsHeadline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const headlines: NewsHeadline[] = [];

  for (const item of items) {
    const title = extractTag(item, "title");
    if (!title) continue;
    const pubDate = extractTag(item, "pubDate");
    const publishedAt = pubDate ? new Date(pubDate) : null;
    headlines.push({
      title,
      source,
      publishedAt:
        publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt.toISOString() : null
    });
  }

  return headlines;
}

export async function getNewsHeadlines(options: FetchFreshOptions = {}): Promise<NewsHeadline[]> {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (eink-dashboard)" },
        signal: AbortSignal.timeout(NEWS_FETCH_TIMEOUT_MS),
        ...(options.forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } })
      });
      if (!response.ok) {
        throw new Error(`News feed ${feed.source} HTTP ${response.status}`);
      }
      return parseRssItems(await response.text(), feed.source);
    })
  );

  const merged: NewsHeadline[] = [];
  const seenTitles = new Set<string>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const headline of result.value) {
      const key = headline.title.replace(/\s+/g, "");
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      merged.push(headline);
    }
  }

  merged.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return merged.slice(0, MAX_HEADLINES);
}
