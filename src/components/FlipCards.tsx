"use client";
import { useState } from "react";
import { Speak } from "./Speak";
import { useUi } from "./UiProvider";
import type { LessonContent } from "@/lib/lesson";

export function FlipCards({ cards, tts }: { cards: NonNullable<LessonContent["cards"]>; tts: string }) {
  const { dict } = useUi();
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <>
      <p className="muted small no-print">{dict.flipHint}</p>
      <div className="flip-grid">
        {cards.map((c, i) => (
          <div key={i} className={`flip ${flipped[i] ? "flipped" : ""}`} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}>
            <div className="flip-inner">
              <div className="flip-face flip-front">
                <Speak text={c.term} lang={tts} />
                <div className="term">{c.term}</div>
                <div className="small muted">{c.example}</div>
              </div>
              <div className="flip-face flip-back">
                <Speak text={c.example} lang={tts} />
                <div className="tr">{c.translation}</div>
                <div>{c.example}</div>
                <div className="muted small">{c.exampleTranslation}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
