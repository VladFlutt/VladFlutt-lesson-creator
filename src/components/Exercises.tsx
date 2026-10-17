"use client";
import { useState } from "react";
import { fmt } from "@/lib/i18n";
import { normalize } from "@/lib/text";
import type { Exercise } from "@/lib/lesson";
import { useUi } from "./UiProvider";

function One({ ex, n }: { ex: Exercise; n: number }) {
  const { dict } = useUi();
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const hasOptions = ex.options && ex.options.length > 0;
  const ok = normalize(value) === normalize(ex.answer);

  return (
    <div className="exercise">
      <div className="prompt">
        {n}. {ex.prompt}
      </div>
      {hasOptions ? (
        <div className="options">
          {ex.options.map((o) => {
            const cls = !checked
              ? value === o ? "picked" : ""
              : normalize(o) === normalize(ex.answer) ? "right" : value === o ? "wrong" : "";
            return (
              <button key={o} type="button" className={`option ${cls}`} onClick={() => { setValue(o); setChecked(true); }}>
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="row">
          <input
            style={{ maxWidth: 420 }}
            value={value}
            placeholder={dict.yourAnswer}
            onChange={(e) => { setValue(e.target.value); setChecked(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") setChecked(true); }}
          />
          <button type="button" className="btn small" onClick={() => setChecked(true)} disabled={!value.trim()}>
            {dict.check}
          </button>
        </div>
      )}
      {checked && (
        <div className={`feedback ${ok ? "ok" : "bad"}`}>
          {ok ? dict.correct : fmt(dict.incorrect, { a: ex.answer })}
          {ex.explanation && <div className="muted small" style={{ fontWeight: 400 }}>{ex.explanation}</div>}
        </div>
      )}
    </div>
  );
}

export function Exercises({ items }: { items: Exercise[] }) {
  return (
    <>
      {items.map((ex, i) => (
        <One key={i} ex={ex} n={i + 1} />
      ))}
    </>
  );
}
