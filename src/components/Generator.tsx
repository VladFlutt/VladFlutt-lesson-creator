"use client";
import { useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/i18n";
import type { LessonRow } from "@/lib/lesson";
import { LessonView } from "./LessonView";
import { useUi } from "./UiProvider";

type Option = { code: string; label: string };
type Inst = { key: string; label: string; description: string; default_on: boolean };

export function Generator(props: {
  languages: Option[];
  levels: Option[];
  durations: number[];
  instruments: Inst[];
  guestRemaining: number | null;
  guestLimit: number;
  signedIn: boolean;
  blocked: boolean;
}) {
  const { dict } = useUi();
  const [languageCode, setLanguageCode] = useState(props.languages[0]?.code || "el");
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState(props.levels[0]?.code || "A1");
  const [duration, setDuration] = useState(props.durations.includes(60) ? 60 : props.durations[0]);
  const [picked, setPicked] = useState<string[]>(props.instruments.filter((i) => i.default_on).map((i) => i.key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [guestLeft, setGuestLeft] = useState(props.guestRemaining);

  const names = Object.fromEntries(props.instruments.map((i) => [i.key, i.label]));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setLesson(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ languageCode, theme, level, duration, instruments: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages: Record<string, string> = {
          guest_limit: dict.guestLimitReached,
          limit: dict.limitReached,
          blocked: dict.blockedAccount,
          restricted: fmt(dict.restrictedTheme, { w: data.word || "" }),
        };
        setError(messages[data.error] || dict.errorGeneric);
        if (data.error === "guest_limit") setGuestLeft(0);
        return;
      }
      setLesson(data.lesson);
      if (!props.signedIn && data.remaining !== null && data.remaining !== undefined) setGuestLeft(data.remaining);
      setTimeout(() => document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  if (props.blocked) return <div className="error">{dict.blockedAccount}</div>;

  return (
    <>
      <form className="card no-print" onSubmit={submit}>
        <h1>{dict.generator}</h1>
        <p className="muted">{dict.tagline}</p>
        {!props.signedIn && (
          <div className="notice small">
            {fmt(dict.guestNote, { n: props.guestLimit })}{" "}
            <b>{fmt(dict.guestLeft, { n: guestLeft ?? 0 })}</b> · <Link href="/login?mode=signup">{dict.signUp}</Link>
          </div>
        )}
        <div className="grid" style={{ marginTop: 14 }}>
          <label className="field">
            {dict.lessonLanguage}
            <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
              {props.languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field">
            {dict.level}
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {props.levels.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field">
            {dict.duration}
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {props.durations.map((d) => <option key={d} value={d}>{d} {dict.minutes}</option>)}
            </select>
          </label>
        </div>
        <label className="field" style={{ marginTop: 16 }}>
          {dict.theme}
          <input value={theme} maxLength={200} required placeholder={dict.themePlaceholder} onChange={(e) => setTheme(e.target.value)} />
        </label>
        <div style={{ marginTop: 16 }}>
          <div className="field" style={{ marginBottom: 8 }}>{dict.instruments}</div>
          <div className="checks">
            {props.instruments.map((i) => (
              <label key={i.key} className={`check ${picked.includes(i.key) ? "on" : ""}`} title={i.description}>
                <input type="checkbox" checked={picked.includes(i.key)} onChange={() => toggle(i.key)} />
                {i.label}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn green" disabled={loading || !theme.trim() || !picked.length || guestLeft === 0}>
            {loading && <span className="spinner" />}
            {loading ? dict.generating : dict.generate}
          </button>
        </div>
      </form>
      {lesson && (
        <div id="lesson">
          <LessonView key={lesson.id} lesson={lesson} mode={props.signedIn ? "owner" : "guest"} names={names} />
        </div>
      )}
    </>
  );
}
