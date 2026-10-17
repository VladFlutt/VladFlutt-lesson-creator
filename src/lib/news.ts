import type { NewsItem } from "./lesson";

export function normalizeUrl(u: string) {
  return u.replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
}

// Parses the model's JSON reply and keeps at most two articles whose URL came
// back from the web search and that were published within the last month.
export function pickArticles(finalText: string, seen: Set<string>, now = Date.now()): NewsItem[] {
  const match = finalText.match(/\{[\s\S]*\}/);
  let articles: NewsItem[] = [];
  if (match) {
    try {
      articles = (JSON.parse(match[0]).articles || []) as NewsItem[];
    } catch {
      articles = [];
    }
  }
  const cutoff = now - 32 * 86400_000;
  return articles
    .filter((a) => {
      if (!a?.url || !seen.has(normalizeUrl(a.url))) return false;
      const t = Date.parse(a.published);
      return Number.isNaN(t) || t >= cutoff;
    })
    .slice(0, 2);
}
