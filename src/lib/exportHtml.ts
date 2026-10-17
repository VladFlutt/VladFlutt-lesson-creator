// Builds a standalone, printable HTML file of a lesson for download.

import type { Dict } from "./i18n";
import type { LessonContent, NewsItem, Video } from "./lesson";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function lessonToHtml(p: {
  content: LessonContent;
  dict: Dict;
  blocks: string[];
  meta: string;
  comments?: string | null;
  includeTutor: boolean;
}) {
  const { content: c, dict: t, blocks } = p;
  const has = (b: string) => blocks.includes(b);
  const out: string[] = [];
  const section = (title: string, body: string) => out.push(`<section><h2>${esc(title)}</h2>${body}</section>`);

  if (has("intro") && c.intro) {
    section(c.title, `<p>${esc(c.intro.description)}</p><h3>${esc(t.objectives)}</h3><ul>${c.intro.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>`);
  }
  if (c.timing?.length) section(t.timing, `<ul>${c.timing.map((x) => `<li>${esc(x.block)}: ${x.minutes} ${esc(t.minutes)}</li>`).join("")}</ul>`);
  if (has("warmup") && c.warmup) section(t.warmup, `<ol>${c.warmup.questions.map((q) => `<li>${esc(q.question)}<br><i>${esc(q.translation)}</i></li>`).join("")}</ol>`);
  if (has("cards") && c.cards) {
    section(
      t.cards,
      `<table><tbody>${c.cards
        .map((x) => `<tr><td><b>${esc(x.term)}</b></td><td>${esc(x.translation)}</td><td>${esc(x.example)}<br><i>${esc(x.exampleTranslation)}</i></td></tr>`)
        .join("")}</tbody></table>`
    );
  }
  if (has("grammar") && c.grammar) {
    section(
      t.grammar,
      c.grammar.topics
        .map(
          (g) =>
            `<h3>${esc(g.title)}</h3><p class="pre">${esc(g.explanation)}</p>` +
            (g.forms.length ? `<table><tbody>${g.forms.map((f) => `<tr><td><b>${esc(f.form)}</b></td><td>${esc(f.note)}</td></tr>`).join("")}</tbody></table>` : "") +
            `<ul>${g.examples.map((x) => `<li>${esc(x.sentence)}<br><i>${esc(x.translation)}</i></li>`).join("")}</ul>` +
            (g.commonMistake ? `<p><b>${esc(t.commonMistake)}:</b> ${esc(g.commonMistake)}</p>` : "")
        )
        .join("")
    );
  }
  if (has("image") && c.image && "url" in c.image) out.push(`<section><img src="${esc(c.image.url)}" alt=""></section>`);
  if (has("text") && c.text) section(c.text.title || t.text, `<p class="pre">${esc(c.text.body)}</p>`);
  if (has("translation") && c.translation) section(t.translation, `<p class="pre">${esc(c.translation.body)}</p>`);
  if (has("exercises") && c.exercises) {
    section(
      t.exercises,
      `<ol>${c.exercises
        .map((e) => `<li>${esc(e.prompt)}${e.options?.length ? `<br>${e.options.map(esc).join(e.type === "word_order" ? " / " : " · ")}` : ""}<br>__________________</li>`)
        .join("")}</ol>`
    );
  }
  if (has("dialogue") && c.dialogue) {
    section(
      t.dialogue,
      `<p><i>${esc(c.dialogue.setting)}</i></p>${c.dialogue.lines
        .map((l) => `<p><b>${esc(l.speaker)}:</b> ${esc(l.text)}<br><i>${esc(l.translation)}</i></p>`)
        .join("")}`
    );
  }
  if (has("news") && Array.isArray(c.news) && c.news.length) {
    section(t.news, `<ul>${(c.news as NewsItem[]).map((a) => `<li><a href="${esc(a.url)}">${esc(a.title)}</a> (${esc(a.source)}, ${esc(a.published)})<br>${esc(a.summary)}</li>`).join("")}</ul>`);
  }
  if (has("video") && c.video && "url" in c.video) {
    const v = c.video as Video;
    section(t.video, `<p><a href="${esc(v.url)}">${esc(v.title)}</a> (${esc(v.channel)})</p>`);
  }
  if (has("summary") && c.summary) section(t.summary, `<ul>${c.summary.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
  if (has("homework") && c.homework) section(t.homework, `<ol>${c.homework.tasks.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`);
  for (const x of c.custom || []) section(x.title, `<p class="pre">${esc(x.body)}</p>`);
  if (p.includeTutor) {
    const key = c.exercises?.length
      ? `<h3>${esc(t.answerKey)}</h3><ol>${c.exercises.map((e) => `<li>${esc(e.answer)}</li>`).join("")}</ol>`
      : "";
    section(t.tutorNotes, `<ul>${(c.tutorTips || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${key}`);
  }
  if (p.comments) section(t.comments, `<p class="pre">${esc(p.comments)}</p>`);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d3340;max-width:820px;margin:32px auto;padding:0 16px;line-height:1.55}
h1{color:#2f6f9f}h2{color:#3c8c70;border-bottom:2px solid #ddf1e8;padding-bottom:4px;margin-top:28px}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #d5e5ea;padding:6px 8px;vertical-align:top}
img{max-width:100%;border-radius:12px}.pre{white-space:pre-wrap}.meta{color:#5b7380}
</style></head><body><h1>${esc(c.title)}</h1><p class="meta">${esc(p.meta)}</p>${out.join("\n")}</body></html>`;
}
