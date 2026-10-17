"use client";
import { useEffect, useState } from "react";
import { useUi } from "./UiProvider";

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split("-")[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) || voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
}

// Text-to-speech button using the browser's built-in voices.
export function Speak({ text, lang }: { text: string; lang: string }) {
  const { dict } = useUi();
  const [on, setOn] = useState(false);

  useEffect(() => () => {
    if (on) window.speechSynthesis?.cancel();
  }, [on]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (on) {
      synth.cancel();
      setOn(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = () => setOn(false);
    u.onerror = () => setOn(false);
    setOn(true);
    synth.speak(u);
  };

  return (
    <button type="button" className={`speak ${on ? "on" : ""}`} onClick={toggle} title={on ? dict.stop : dict.listen} aria-label={on ? dict.stop : dict.listen}>
      {on ? (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path d="M16 8.5a4.5 4.5 0 010 7M18.5 6a8 8 0 010 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
