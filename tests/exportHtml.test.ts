import { describe, expect, it } from "vitest";
import { builtinDicts } from "@/lib/i18n";
import { lessonToHtml } from "@/lib/exportHtml";
import type { LessonContent } from "@/lib/lesson";

const content: LessonContent = {
  title: "Στο καφέ <script>alert(1)</script>",
  characters: ["maria"],
  timing: [{ block: "Cards", minutes: 10 }],
  tutorTips: ["Praise effort"],
  imagePrompt: "",
  videoQuery: "",
  newsQuery: "",
  cards: [{ term: "ο καφές", translation: "кофе", example: "Θέλω καφέ.", exampleTranslation: "Я хочу кофе." }],
  exercises: [{ type: "choice", prompt: "Pick", options: ["α", "β"], answer: "α", explanation: "" }],
  dialogue: { setting: "Cafe", lines: [{ speaker: "Μαρία", text: "Γεια!", translation: "Привет!" }] },
  news: [{ title: "N", url: "https://news.gr/a?x=1&y=\"2\"", source: "S", published: "2026-10-10", summary: "" }],
};

const html = (over: Partial<Parameters<typeof lessonToHtml>[0]> = {}) =>
  lessonToHtml({ content, dict: builtinDicts.ru, blocks: ["cards", "exercises", "news"], meta: "A2 · 45", includeTutor: false, ...over });

describe("lessonToHtml", () => {
  it("escapes anything that could run as code", () => {
    const out = html({ comments: "<img src=x onerror=alert(1)>" });
    expect(out).not.toContain("<script>alert");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain('href="https://news.gr/a?x=1&amp;y=&quot;2&quot;"');
  });

  it("includes only the chosen blocks", () => {
    const out = html();
    expect(out).toContain("ο καφές");
    expect(out).not.toContain("Γεια!");
  });

  it("hides tutor notes and answers unless asked", () => {
    expect(html()).not.toContain("Praise effort");
    const withTutor = html({ includeTutor: true });
    expect(withTutor).toContain("Praise effort");
    expect(withTutor).toContain(builtinDicts.ru.answerKey);
  });
});
