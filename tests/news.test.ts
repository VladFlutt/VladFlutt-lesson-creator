import { describe, expect, it } from "vitest";
import { normalizeUrl, pickArticles } from "@/lib/news";

const now = Date.parse("2026-10-17T12:00:00Z");
const art = (url: string, published = "2026-10-10") => ({ title: "t", url, source: "s", published, summary: "x" });
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
    const out = pickArticles(reply([art("https://news.gr/one"), art("https://made-up.gr/x")]), seen, now);
    expect(out.map((a) => a.url)).toEqual(["https://news.gr/one"]);
  });

  it("drops articles older than a month but keeps undated ones", () => {
    const out = pickArticles(reply([art("https://news.gr/old", "2026-08-01"), art("https://news.gr/two", "")]), seen, now);
    expect(out.map((a) => a.url)).toEqual(["https://news.gr/two"]);
  });

  it("returns at most two", () => {
    const out = pickArticles(reply([art("https://news.gr/one"), art("https://news.gr/two"), art("https://news.gr/three")]), seen, now);
    expect(out).toHaveLength(2);
  });

  it("survives a reply without valid JSON", () => {
    expect(pickArticles("no articles found", seen, now)).toEqual([]);
    expect(pickArticles("{not json}", seen, now)).toEqual([]);
  });
});
