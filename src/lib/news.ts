import type { NewsItem } from "./lesson";

export function normalizeUrl(u: string) {
  return u.replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
}

// Parses the model's JSON reply and keeps at most two articles whose URL came
// back from the web search, that are written in the lesson language and that
// were published within the last month.
export function pickArticles(finalText: string, seen: Set<string>, langCode: string, now = Date.now()): NewsItem[] {
  const match = finalText.match(/\{[\s\S]*\}/);
  let articles: NewsItem[] = [];
  if (match) {
    try {
      articles = (JSON.parse(match[0]).articles || []) as (NewsItem & { language?: string })[];
    } catch {
      articles = [];
    }
  }
  const cutoff = now - 32 * 86400_000;
  return articles
    .filter((a) => {
      if (!a?.url || !seen.has(normalizeUrl(a.url))) return false;
      if (!sameLanguage((a as { language?: string }).language, langCode)) return false;
      const t = Date.parse(a.published);
      return Number.isNaN(t) || t >= cutoff;
    })
    .slice(0, 2)
    .map(({ title, url, source, published, summary }) => ({ title, url, source, published, summary }));
}

const sameLanguage = (code: string | undefined, langCode: string) =>
  !!code && code.toLowerCase().split(/[-_]/)[0] === langCode.toLowerCase().split(/[-_]/)[0];

// Writing systems that identify a language family from its letters alone.
const SCRIPTS: Record<string, RegExp> = {
  el: /\p{Script=Greek}/u,
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  bg: /\p{Script=Cyrillic}/u,
  sr: /\p{Script=Cyrillic}/u,
  ka: /\p{Script=Georgian}/u,
  hy: /\p{Script=Armenian}/u,
  he: /\p{Script=Hebrew}/u,
  ar: /\p{Script=Arabic}/u,
  zh: /\p{Script=Han}/u,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
};

export type VideoCandidate = { id: string; title: string; channel: string; audioLanguage?: string; language?: string };

// Picks the first video spoken in the lesson language: by YouTube's language
// metadata first, then by the title's writing system, then the top result.
export function pickVideo(items: VideoCandidate[], langCode: string): VideoCandidate | null {
  if (!items.length) return null;
  const byMeta = items.find((v) => sameLanguage(v.audioLanguage, langCode) || (!v.audioLanguage && sameLanguage(v.language, langCode)));
  if (byMeta) return byMeta;
  const script = SCRIPTS[langCode.toLowerCase().split(/[-_]/)[0]];
  const byScript = script && items.find((v) => script.test(v.title) && !v.audioLanguage);
  return byScript || (script ? null : items[0]);
}
