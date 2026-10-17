import { describe, expect, it } from "vitest";
import { normalizeUrl, pickArticles, pickVideo } from "@/lib/news";

const now = Date.parse("2026-10-17T12:00:00Z");
const art = (url: string, published = "2026-10-10", language = "el") => ({ title: "t", url, source: "s", published, language, summary: "x" });
const reply = (articles: unknown[]) => `Here you go:\n${JSON.stringify({ articles })}\nDone.`;

describe("normalizeUrl", () => {
  it("ignores protocol, www, query, hash and trailing slash", () => {
    expect(normalizeUrl("https://www.kathimerini.gr/a/b/?utm=1#top")).toBe("kathimerini.gr/a/b");
    expect(normalizeUrl("http://kathimerini.gr/a/b")).toBe("kathimerini.gr/a/b");
  });
});

describe("pickArticles", () => {
  const seen = new Set(["news.gr/one", "news.gr/two", "news.gr/three", "news.gr/old"]);

  it("drops links the search never returned", () => {
    const out = pickArticles(reply([art("https://news.gr/one"), art("https://made-up.gr/x")]), seen, "el", now);
    expect(out.map((a) => a.url)).toEqual(["https://news.gr/one"]);
  });

  it("drops articles older than a month but keeps undated ones", () => {
    const out = pickArticles(reply([art("https://news.gr/old", "2026-08-01"), art("https://news.gr/two", "")]), seen, "el", now);
    expect(out.map((a) => a.url)).toEqual(["https://news.gr/two"]);
  });

  it("returns at most two", () => {
    const out = pickArticles(reply([art("https://news.gr/one"), art("https://news.gr/two"), art("https://news.gr/three")]), seen, "el", now);
    expect(out).toHaveLength(2);
  });

  it("survives a reply without valid JSON", () => {
    expect(pickArticles("no articles found", seen, "el", now)).toEqual([]);
    expect(pickArticles("{not json}", seen, "el", now)).toEqual([]);
  });
});

describe("pickVideo", () => {
  const v = (id: string, title: string, audioLanguage?: string, language?: string) => ({ id, title, channel: "c", audioLanguage, language });

  it("prefers a video whose spoken language matches", () => {
    expect(pickVideo([v("a", "Learn English in a café", "en"), v("b", "Στο καφέ", "el")], "el")?.id).toBe("b");
  });

  it("falls back to the title's alphabet when there is no language data", () => {
    expect(pickVideo([v("a", "Coffee English lesson"), v("b", "Παραγγελία στο καφέ")], "el")?.id).toBe("b");
    expect(pickVideo([v("a", "Παράγγειλε στα Αγγλικά", "en")], "el")).toBeNull();
  });

  it("uses the top result for Latin-script languages without language data", () => {
    expect(pickVideo([v("a", "Im Café"), v("b", "Beim Bäcker")], "de")?.id).toBe("a");
    expect(pickVideo([], "de")).toBeNull();
  });
});
