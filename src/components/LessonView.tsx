"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LessonContent, LessonRow, NewsItem, Video } from "@/lib/lesson";
import { lessonToHtml } from "@/lib/exportHtml";
import { Speak } from "./Speak";
import { FlipCards } from "./FlipCards";
import { Exercises } from "./Exercises";
import { ttsFor, useUi } from "./UiProvider";

type Mode = "owner" | "guest" | "student";
const EXTRAS = ["image", "news", "video"] as const;
const REGENERABLE = new Set(["intro", "warmup", "cards", "grammar", "text", "translation", "exercises", "dialogue", "summary", "homework"]);

export function LessonView({
  lesson: initial,
  mode,
  names,
}: {
  lesson: LessonRow;
  mode: Mode;
  names: Record<string, string>;
}) {
  const { dict, languages } = useUi();
  const [lesson, setLesson] = useState(initial);
  const [content, setContent] = useState<LessonContent>(initial.content);
  const [showTutor, setShowTutor] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState(initial.comments || "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(initial.saved ? "saved" : "idle");
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const tts = ttsFor(languages, lesson.language_code);
  const uiTts = ttsFor(languages, lesson.interface_code);
  const blocks = lesson.instruments;
  const has = (b: string) => blocks.includes(b);
  const editable = mode !== "student";

  // Fetch any slow block that hasn't been produced yet.
  useEffect(() => {
    if (!editable || started.current) return;
    started.current = true;
    for (const part of EXTRAS) {
      if (has(part) && content[part] === undefined) fillExtra(part);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fillExtra(part: (typeof EXTRAS)[number]) {
    setBusy((b) => ({ ...b, [part]: true }));
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/extras`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ part }),
      });
      const data = await res.json();
      setContent((c) => ({ ...c, [part]: res.ok ? data.value : { error: true } }));
    } catch {
      setContent((c) => ({ ...c, [part]: { error: true } }));
    } finally {
      setBusy((b) => ({ ...b, [part]: false }));
    }
  }

  async function regenerate(block: string) {
    if ((EXTRAS as readonly string[]).includes(block)) return fillExtra(block as (typeof EXTRAS)[number]);
    setBusy((b) => ({ ...b, [block]: true }));
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ block }),
      });
      const data = await res.json();
      if (res.ok) setContent((c) => ({ ...c, [block]: data.value }));
      else alert(dict.errorGeneric);
    } finally {
      setBusy((b) => ({ ...b, [block]: false }));
    }
  }

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("save failed");
    const data = await res.json();
    setLesson(data.lesson);
    return data.lesson as LessonRow;
  }

  async function save() {
    setSaveState("saving");
    try {
      await patch({ saved: true, comments });
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      alert(dict.errorGeneric);
    }
  }

  async function share() {
    const row = lesson.share_token ? lesson : await patch({ saved: true, share: true, comments });
    setSaveState("saved");
    await navigator.clipboard.writeText(`${location.origin}/share/${row.share_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function download() {
    const html = lessonToHtml({
      content,
      dict,
      blocks,
      meta: `${lesson.theme} · ${lesson.level} · ${lesson.duration} ${dict.minutes}`,
      comments,
      includeTutor: mode !== "student",
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(content.title || "lesson").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const head = (block: string, title: string, speakText?: string, lang?: string) => (
    <div className="block-head">
      <h2>
        {title}
        {speakText && <Speak text={speakText} lang={lang || tts} />}
      </h2>
      {editable && (REGENERABLE.has(block) || (EXTRAS as readonly string[]).includes(block)) && (
        <button className="btn ghost small no-print" disabled={busy[block]} onClick={() => regenerate(block)}>
          {busy[block] ? <span className="spinner dark" /> : "↻"} {dict.regenerate}
        </button>
      )}
    </div>
  );

  const pending = (part: string) =>
    busy[part] ? (
      <p className="row muted"><span className="spinner dark" /> {dict.loadingBlock}</p>
    ) : (
      <p className="muted">{dict.unavailable}</p>
    );

  const c = content;
  const sections: Record<string, React.ReactNode> = {
    intro: c.intro && (
      <section className="card block" key="intro">
        {head("intro", names.intro || "")}
        <p>{c.intro.description}</p>
        <h3>{dict.objectives}</h3>
        <ul className="objectives">{c.intro.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </section>
    ),
    warmup: c.warmup && (
      <section className="card block" key="warmup">
        {head("warmup", names.warmup || dict.warmup)}
        {c.warmup.questions.map((q, i) => (
          <div className="line" key={i}>
            <Speak text={q.question} lang={tts} />
            <div>
              <div>{q.question}</div>
              <div className="tr muted small">{q.translation}</div>
            </div>
          </div>
        ))}
      </section>
    ),
    cards: c.cards && (
      <section className="card block" key="cards">
        {head("cards", names.cards || dict.cards)}
        <FlipCards cards={c.cards} tts={tts} />
      </section>
    ),
    grammar: c.grammar && (
      <section className="card block" key="grammar">
        {head("grammar", names.grammar || dict.grammar)}
        {c.grammar.topics.map((g, i) => (
          <div key={i} style={{ marginTop: i ? 18 : 0 }}>
            <h3>{g.title}</h3>
            <div className="reading">{g.explanation}</div>
            {g.forms.length > 0 && (
              <table className="grammar-forms">
                <tbody>
                  {g.forms.map((f, j) => (
                    <tr key={j}>
                      <td>{f.form}</td>
                      <td className="muted">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {g.examples.map((x, j) => (
              <div className="line" key={j}>
                <Speak text={x.sentence} lang={tts} />
                <div>
                  <div>{x.sentence}</div>
                  <div className="tr muted small">{x.translation}</div>
                </div>
              </div>
            ))}
            {g.commonMistake && (
              <div className="mistake small"><b>{dict.commonMistake}:</b> {g.commonMistake}</div>
            )}
          </div>
        ))}
      </section>
    ),
    image: (
      <section className="card block" key="image">
        {head("image", names.image || "")}
        {c.image && "url" in c.image ? <img className="lesson-image" src={c.image.url} alt={c.title} /> : pending("image")}
      </section>
    ),
    text: c.text && (
      <section className="card block" key="text">
        {head("text", c.text.title || dict.text, c.text.body)}
        <div className="reading">{c.text.body}</div>
      </section>
    ),
    translation: c.translation && (
      <section className="card block" key="translation">
        {head("translation", names.translation || dict.translation, c.translation.body, uiTts)}
        <div className="reading">{c.translation.body}</div>
      </section>
    ),
    exercises: c.exercises && (
      <section className="card block" key="exercises">
        {head("exercises", names.exercises || dict.exercises)}
        <Exercises items={c.exercises} />
      </section>
    ),
    dialogue: c.dialogue && (
      <section className="card block" key="dialogue">
        {head("dialogue", names.dialogue || dict.dialogue, c.dialogue.lines.map((l) => l.text).join("\n"))}
        <p className="muted"><i>{c.dialogue.setting}</i></p>
        {c.dialogue.lines.map((l, i) => (
          <div className="line" key={i}>
            <Speak text={l.text} lang={tts} />
            <span className="speaker">{l.speaker}</span>
            <div>
              <div>{l.text}</div>
              <div className="tr">{l.translation}</div>
            </div>
          </div>
        ))}
      </section>
    ),
    news: (
      <section className="card block" key="news">
        {head("news", names.news || dict.news)}
        {Array.isArray(c.news) ? (
          c.news.length ? (
            <ul className="links">
              {(c.news as NewsItem[]).map((a, i) => (
                <li key={i}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"><b>{a.title}</b></a>
                  <div className="small muted">{a.source}{a.published ? ` · ${dict.published} ${a.published}` : ""}</div>
                  <div className="small">{a.summary}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{dict.unavailable}</p>
          )
        ) : (
          pending("news")
        )}
      </section>
    ),
    video: (
      <section className="card block" key="video">
        {head("video", names.video || dict.video)}
        {c.video && "url" in c.video ? (
          <>
            {(c.video as Video).videoId && (
              <div className="video-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${(c.video as Video).videoId}`}
                  title={(c.video as Video).title}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <p className="small" style={{ marginTop: 8 }}>
              <a href={(c.video as Video).url} target="_blank" rel="noopener noreferrer">{(c.video as Video).title}</a>
              <span className="muted"> · {(c.video as Video).channel}</span>
            </p>
          </>
        ) : (
          pending("video")
        )}
      </section>
    ),
    summary: c.summary && (
      <section className="card block" key="summary">
        {head("summary", names.summary || dict.summary)}
        <ul>{c.summary.points.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
    ),
    homework: c.homework && (
      <section className="card block" key="homework">
        {head("homework", names.homework || dict.homework)}
        <ol>{c.homework.tasks.map((x, i) => <li key={i}>{x}</li>)}</ol>
      </section>
    ),
  };

  return (
    <article>
      <div className="card">
        <h1 className="lesson-title">{c.title}</h1>
        <p className="muted">
          {lesson.theme} · {lesson.level} · {lesson.duration} {dict.minutes}
        </p>
        {c.timing?.length > 0 && (
          <>
            <h3 style={{ marginTop: 10 }}>{dict.timing}</h3>
            <div className="timing">
              {c.timing.map((x, i) => (
                <span key={i}>{x.block} · {x.minutes} {dict.minutes}</span>
              ))}
            </div>
          </>
        )}
        {editable && (
          <button className="link small no-print" style={{ marginTop: 12 }} onClick={() => setShowTutor((s) => !s)}>
            {showTutor ? dict.hideTutor : dict.showTutor}
          </button>
        )}
      </div>

      {editable && showTutor && (
        <section className="card tutor">
          <h2>{dict.tutorNotes}</h2>
          <ul>{(c.tutorTips || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
          {c.exercises?.length ? (
            <>
              <h3>{dict.answerKey}</h3>
              <ol>{c.exercises.map((e, i) => <li key={i}>{e.answer}</li>)}</ol>
            </>
          ) : null}
        </section>
      )}

      {blocks.map((b) => (has(b) ? sections[b] : null))}
      {(c.custom || []).map((x) => (
        <section className="card block" key={x.key}>
          <div className="block-head"><h2>{x.title}</h2></div>
          <div className="reading">{x.body}</div>
        </section>
      ))}

      {editable && (
        <section className="card no-print">
          <h2>{dict.comments}</h2>
          <textarea value={comments} placeholder={dict.commentsPlaceholder} onChange={(e) => { setComments(e.target.value); if (saveState === "saved") setSaveState("idle"); }} />
        </section>
      )}

      <div className="actions no-print">
        <div className="row">
          {mode === "owner" && (
            <button className="btn green" onClick={save} disabled={saveState !== "idle"}>
              {saveState === "saving" ? <span className="spinner" /> : null}
              {saveState === "saved" ? `✓ ${dict.saved}` : dict.save}
            </button>
          )}
          {mode === "guest" && <Link className="btn green" href="/login">{dict.signInToSave}</Link>}
          <button className="btn ghost" onClick={download}>{dict.download}</button>
          <button className="btn ghost" onClick={() => window.print()}>{dict.print}</button>
          {mode === "owner" && (
            <button className="btn ghost" onClick={share}>{copied ? `✓ ${dict.copied}` : dict.share}</button>
          )}
        </div>
      </div>
    </article>
  );
}
