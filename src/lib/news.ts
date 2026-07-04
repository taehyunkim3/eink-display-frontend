import type { NewsHeadline } from "./types";

type FetchFreshOptions = {
  forceRefresh?: boolean;
};

const NEWS_FEEDS = [
  { url: "https://www.hankyung.com/feed/finance", source: "한경증권" },
  { url: "https://www.hankyung.com/feed/economy", source: "한경경제" }
] as const;
// Korean news sites often block overseas datacenter IPs, so Google News RSS
// (globally reachable) acts as the fallback when the primary feeds fail.
const FALLBACK_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko",
    source: "구글뉴스"
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko",
    source: "구글경제"
  }
] as const;
const NEWS_FETCH_TIMEOUT_MS = 8000;
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

function parseRssItems(xml: string, fallbackSource: string): NewsHeadline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const headlines: NewsHeadline[] = [];

  for (const item of items) {
    let title = extractTag(item, "title");
    if (!title) continue;
    // Google News titles carry a trailing " - 언론사" suffix; the publisher
    // also comes as a dedicated <source> tag.
    const itemSource = extractTag(item, "source");
    if (itemSource) {
      title = title.replace(new RegExp(`\\s*-\\s*${itemSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
    }
    const pubDate = extractTag(item, "pubDate");
    const publishedAt = pubDate ? new Date(pubDate) : null;
    headlines.push({
      title,
      source: itemSource ?? fallbackSource,
      publishedAt:
        publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt.toISOString() : null
    });
  }

  return headlines;
}

type NewsFeed = { url: string; source: string };

async function fetchFeeds(
  feeds: readonly NewsFeed[],
  options: FetchFreshOptions
): Promise<NewsHeadline[]> {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
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

export async function getNewsHeadlines(options: FetchFreshOptions = {}): Promise<NewsHeadline[]> {
  const primary = await fetchFeeds(NEWS_FEEDS, options);
  if (primary.length > 0) {
    return primary;
  }
  return fetchFeeds(FALLBACK_FEEDS, options);
}
