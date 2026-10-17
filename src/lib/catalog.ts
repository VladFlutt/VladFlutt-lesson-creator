import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-server";
import { resolveDict, type Dict } from "./i18n";

export type Language = {
  id: string;
  code: string;
  name: string;
  native_name: string;
  tts_lang: string;
  ui_label: string;
  ui_strings: Record<string, string> | null;
  is_guest_default: boolean;
  status: "active" | "blocked";
  sort: number;
};
export type Level = { id: string; code: string; description: string | null; status: string; sort: number };
export type Duration = { id: string; minutes: number; status: string };
export type Instrument = {
  id: string;
  key: string;
  name: Record<string, string>;
  description: string;
  is_builtin: boolean;
  default_on: boolean;
  status: string;
  sort: number;
};

export type GrammarItem = {
  id: string;
  language_code: string;
  level: string | null;
  name: Record<string, string>;
  status: string;
  sort: number;
};

export async function loadCatalog(includeBlocked = false) {
  const sb = supabaseAdmin();
  const q = <T,>(table: string, order: string) => {
    let query = sb.from(table).select("*").order(order);
    if (!includeBlocked) query = query.eq("status", "active");
    return query.then(({ data }) => (data || []) as T[]);
  };
  const [languages, levels, durations, instruments, grammar] = await Promise.all([
    q<Language>("languages", "sort"),
    q<Level>("levels", "sort"),
    q<Duration>("durations", "minutes"),
    q<Instrument>("instruments", "sort"),
    q<GrammarItem>("grammar_topics", "sort"),
  ]);
  return { languages, levels, durations, instruments, grammar };
}

export async function getSettings(): Promise<Record<string, number | null>> {
  const { data } = await supabaseAdmin().from("settings").select("key, value");
  const out: Record<string, number | null> = {};
  for (const row of data || []) out[row.key] = row.value === null ? null : Number(row.value);
  return out;
}

// Interface language comes from the ui_lang cookie; Greek by default.
export async function getUi(languages: Language[]): Promise<{ code: string; dict: Dict }> {
  const store = await cookies();
  const wanted = store.get("ui_lang")?.value || "el";
  const lang = languages.find((l) => l.code === wanted) || languages.find((l) => l.code === "el");
  const code = lang?.code || "el";
  return { code, dict: resolveDict(code, lang?.ui_strings) };
}

// Names a grammar topic for the prompt: English plus the lesson language's own term.
export function grammarLabel(g: GrammarItem) {
  const native = g.name[g.language_code];
  return native && native !== g.name.en ? `${g.name.en || native} (${native})` : g.name.en || native || "";
}

export function instrumentName(i: Instrument, ui: string) {
  return i.name[ui] || i.name.en || i.key;
}
