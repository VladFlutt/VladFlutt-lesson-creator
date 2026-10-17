"use client";
import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n";

export type UiLanguage = { code: string; name: string; ui_label: string; tts_lang: string; is_guest_default: boolean };

type Ui = { dict: Dict; code: string; languages: UiLanguage[]; signedIn: boolean };

const Ctx = createContext<Ui | null>(null);

export function UiProvider({ value, children }: { value: Ui; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): Ui {
  const v = useContext(Ctx);
  if (!v) throw new Error("UiProvider missing");
  return v;
}

export function ttsFor(languages: UiLanguage[], code: string) {
  return languages.find((l) => l.code === code)?.tts_lang || code;
}
