"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUi } from "./UiProvider";

export type UserRow = {
  id: string;
  email: string;
  status: string;
  limit_day: number | null;
  limit_week: number | null;
  limit_month: number | null;
  time_spent_seconds: number;
  last_seen_at: string | null;
  created_at: string;
  lessons: number;
  tokens: number;
};

export type HistoryRow = {
  id: string;
  who: string;
  kind: string;
  theme: string | null;
  language_code: string | null;
  tokens_in: number;
  tokens_out: number;
  ok: boolean;
  error: string | null;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Admin labels (the admin panel isn't machine-translated for added languages).
const L = {
  ru: {
    languages: "Языки", levels: "Уровни", durations: "Длительность", instruments: "Инструменты", grammar: "Грамматика", restricted: "Запрещённые слова",
    users: "Пользователи", history: "История", limits: "Лимиты", add: "Добавить", save: "Сохранить", block: "Заблокировать",
    unblock: "Разблокировать", delete: "Удалить", status: "Статус", confirm: "Удалить без возможности восстановления?",
    guestLimit: "Попыток для гостей (всего)", defDay: "Генераций в день", defWeek: "Генераций в неделю", defMonth: "Генераций в месяц",
    defaultsNote: "Лимиты по умолчанию для всех пользователей. Пусто = без ограничений. Индивидуальные лимиты задаются во вкладке «Пользователи».",
    email: "Email", password: "Пароль", time: "Время в приложении", lessonsCount: "Уроков", tokens: "Токены", lastSeen: "Был(а)",
    perUser: "Лимиты день / неделя / месяц (пусто = по умолчанию)", who: "Кто", kind: "Тип", theme: "Тема", when: "Когда",
    filter: "Фильтр по email или теме", totalTokens: "Всего токенов", totalLessons: "Всего уроков", totalUsers: "Пользователей",
    newLangNote: "Интерфейс для нового языка переводится автоматически при добавлении.", saved: "Сохранено",
  },
  el: {
    languages: "Γλώσσες", levels: "Επίπεδα", durations: "Διάρκειες", instruments: "Εργαλεία", grammar: "Γραμματική", restricted: "Απαγορευμένες λέξεις",
    users: "Χρήστες", history: "Ιστορικό", limits: "Όρια", add: "Προσθήκη", save: "Αποθήκευση", block: "Αποκλεισμός",
    unblock: "Άρση αποκλεισμού", delete: "Διαγραφή", status: "Κατάσταση", confirm: "Οριστική διαγραφή;",
    guestLimit: "Προσπάθειες επισκέπτη (σύνολο)", defDay: "Δημιουργίες ανά ημέρα", defWeek: "Δημιουργίες ανά εβδομάδα", defMonth: "Δημιουργίες ανά μήνα",
    defaultsNote: "Προεπιλεγμένα όρια για όλους τους χρήστες. Κενό = χωρίς όριο. Ατομικά όρια ορίζονται στην καρτέλα «Χρήστες».",
    email: "Email", password: "Κωδικός", time: "Χρόνος στην εφαρμογή", lessonsCount: "Μαθήματα", tokens: "Tokens", lastSeen: "Τελευταία φορά",
    perUser: "Όρια ημέρα / εβδομάδα / μήνας (κενό = προεπιλογή)", who: "Ποιος", kind: "Τύπος", theme: "Θέμα", when: "Πότε",
    filter: "Φίλτρο κατά email ή θέμα", totalTokens: "Σύνολο tokens", totalLessons: "Σύνολο μαθημάτων", totalUsers: "Χρήστες",
    newLangNote: "Η διεπαφή για νέα γλώσσα μεταφράζεται αυτόματα κατά την προσθήκη.", saved: "Αποθηκεύτηκε",
  },
  en: {
    languages: "Languages", levels: "Levels", durations: "Durations", instruments: "Instruments", grammar: "Grammar", restricted: "Restricted words",
    users: "Users", history: "History", limits: "Limits", add: "Add", save: "Save", block: "Block",
    unblock: "Unblock", delete: "Delete", status: "Status", confirm: "Delete permanently?",
    guestLimit: "Guest attempts (total)", defDay: "Generations per day", defWeek: "Generations per week", defMonth: "Generations per month",
    defaultsNote: "Default limits for every user. Empty = unlimited. Per-user limits are on the Users tab.",
    email: "Email", password: "Password", time: "Time in app", lessonsCount: "Lessons", tokens: "Tokens", lastSeen: "Last seen",
    perUser: "Limits day / week / month (empty = default)", who: "Who", kind: "Kind", theme: "Theme", when: "When",
    filter: "Filter by email or theme", totalTokens: "Total tokens", totalLessons: "Total lessons", totalUsers: "Users",
    newLangNote: "The interface for a new language is translated automatically when you add it.", saved: "Saved",
  },
};

type Col = { key: string; label: string; type?: "text" | "number" | "bool" | "json"; width?: number };

async function call(body: Row) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function ListEditor({ table, rows, cols, t, blank }: { table: string; rows: Row[]; cols: Col[]; t: typeof L.en; blank: Row }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [draft, setDraft] = useState<Row>(blank);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (body: Row, after?: () => void) => {
    setErr(null);
    setBusy(true);
    try {
      await call({ table, ...body, data: body.data ? prepare(body.data) : undefined });
      after?.();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const parse = (c: Col, v: string | boolean) => {
    if (c.type === "number") return v === "" ? null : Number(v);
    return v; // json columns stay raw text until saved
  };
  const show = (c: Col, v: unknown) => (c.type === "json" && typeof v !== "string" ? JSON.stringify(v ?? {}) : v ?? "");

  // Parses json columns that were edited as text.
  const prepare = (data: Row) => {
    const out = { ...data };
    for (const c of cols) {
      if (c.type === "json" && typeof out[c.key] === "string") out[c.key] = JSON.parse(out[c.key]);
    }
    return out;
  };

  const input = (c: Col, value: unknown, onChange: (v: unknown) => void) =>
    c.type === "bool" ? (
      <input type="checkbox" style={{ width: "auto" }} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    ) : (
      <input
        type={c.type === "number" ? "number" : "text"}
        style={{ minWidth: c.width || 90 }}
        value={String(show(c, value))}
        onChange={(e) => onChange(parse(c, e.target.value))}
      />
    );

  return (
    <>
      {err && <div className="error">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>{t.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = edits[r.id] || {};
              const val = (k: string) => (k in e ? e[k] : r[k]);
              return (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td key={c.key}>{input(c, val(c.key), (v) => setEdits((all) => ({ ...all, [r.id]: { ...e, [c.key]: v } })))}</td>
                  ))}
                  <td className={`status-${r.status}`}>{r.status}</td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      {edits[r.id] && (
                        <button className="btn small" disabled={busy} onClick={() => run({ action: "update", id: r.id, data: e }, () => setEdits((a) => { const n = { ...a }; delete n[r.id]; return n; }))}>
                          {t.save}
                        </button>
                      )}
                      <button className="btn ghost small" disabled={busy} onClick={() => run({ action: "update", id: r.id, data: { status: r.status === "active" ? "blocked" : "active" } })}>
                        {r.status === "active" ? t.block : t.unblock}
                      </button>
                      <button className="btn danger small" disabled={busy} onClick={() => confirm(t.confirm) && run({ action: "delete", id: r.id })}>
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              {cols.map((c) => (
                <td key={c.key}>{input(c, draft[c.key], (v) => setDraft((d) => ({ ...d, [c.key]: v })))}</td>
              ))}
              <td />
              <td>
                <button className="btn green small" disabled={busy} onClick={() => run({ action: "create", data: draft }, () => setDraft(blank))}>
                  + {t.add}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Users({ users, t, selfId }: { users: UserRow[]; t: typeof L.en; selfId: string }) {
  const router = useRouter();
  const [limits, setLimits] = useState<Record<string, Row>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = async (body: Row) => {
    setErr(null);
    try {
      await call({ table: "users", ...body });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <input style={{ maxWidth: 240 }} placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={{ maxWidth: 200 }} placeholder={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn green small" onClick={() => run({ action: "create", data: { email, password } }).then(() => { setEmail(""); setPassword(""); })}>
          + {t.add}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.email}</th>
              <th>{t.lessonsCount}</th>
              <th>{t.tokens}</th>
              <th>{t.time}</th>
              <th>{t.lastSeen}</th>
              <th>{t.perUser}</th>
              <th>{t.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const l = limits[u.id] || { limit_day: u.limit_day ?? "", limit_week: u.limit_week ?? "", limit_month: u.limit_month ?? "" };
              const set = (k: string, v: string) => setLimits((a) => ({ ...a, [u.id]: { ...l, [k]: v } }));
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.lessons}</td>
                  <td>{u.tokens.toLocaleString()}</td>
                  <td>{fmtTime(u.time_spent_seconds)}</td>
                  <td className="small">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "—"}</td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      {(["limit_day", "limit_week", "limit_month"] as const).map((k) => (
                        <input key={k} type="number" min={0} style={{ width: 70 }} value={l[k]} onChange={(e) => set(k, e.target.value)} />
                      ))}
                      {limits[u.id] && (
                        <button className="btn small" onClick={() => run({ action: "limits", id: u.id, data: l }).then(() => setLimits((a) => { const n = { ...a }; delete n[u.id]; return n; }))}>
                          {t.save}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={`status-${u.status}`}>{u.status}</td>
                  <td>
                    {u.id !== selfId && (
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <button className="btn ghost small" onClick={() => run({ action: u.status === "active" ? "block" : "unblock", id: u.id })}>
                          {u.status === "active" ? t.block : t.unblock}
                        </button>
                        <button className="btn danger small" onClick={() => confirm(t.confirm) && run({ action: "delete", id: u.id })}>
                          {t.delete}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function History({ rows, users, t }: { rows: HistoryRow[]; users: UserRow[]; t: typeof L.en }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.toLowerCase();
    return s ? rows.filter((r) => r.who.toLowerCase().includes(s) || (r.theme || "").toLowerCase().includes(s)) : rows;
  }, [q, rows]);
  const totalTokens = rows.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0);
  const totalLessons = rows.filter((r) => r.kind === "lesson").length;

  return (
    <>
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="stat">{t.totalUsers}<b>{users.length}</b></div>
        <div className="stat">{t.totalLessons}<b>{totalLessons}</b></div>
        <div className="stat">{t.totalTokens}<b>{totalTokens.toLocaleString()}</b></div>
      </div>
      <input placeholder={t.filter} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360, marginBottom: 12 }} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.when}</th>
              <th>{t.who}</th>
              <th>{t.kind}</th>
              <th>{t.theme}</th>
              <th>{t.tokens}</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 500).map((r) => (
              <tr key={r.id}>
                <td className="small">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.who}</td>
                <td>
                  <span className={r.ok ? "" : "status-blocked"} title={r.error || ""}>{r.kind}</span>
                  {r.language_code ? <span className="muted small"> · {r.language_code}</span> : null}
                </td>
                <td>{r.theme}</td>
                <td className="small">{r.tokens_in.toLocaleString()} / {r.tokens_out.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Limits({ settings, t }: { settings: Record<string, number | null>; t: typeof L.en }) {
  const router = useRouter();
  const keys = [
    ["guest_limit", t.guestLimit],
    ["default_limit_day", t.defDay],
    ["default_limit_week", t.defWeek],
    ["default_limit_month", t.defMonth],
  ] as const;
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(keys.map(([k]) => [k, settings[k] === null || settings[k] === undefined ? "" : String(settings[k])]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <p className="muted">{t.defaultsNote}</p>
      <div className="grid">
        {keys.map(([k, label]) => (
          <label className="field" key={k}>
            {label}
            <input type="number" min={0} value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="btn"
          onClick={async () => {
            try {
              await call({ table: "settings", action: "update", data: vals });
              setMsg(t.saved);
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          {t.save}
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </>
  );
}

export function AdminPanel(props: {
  languages: Row[];
  levels: Row[];
  durations: Row[];
  instruments: Row[];
  grammar: Row[];
  restricted: Row[];
  settings: Record<string, number | null>;
  users: UserRow[];
  history: HistoryRow[];
  selfId: string;
}) {
  const { code } = useUi();
  const t = (L as Record<string, typeof L.en>)[code] || L.en;
  const tabs = ["languages", "levels", "durations", "instruments", "grammar", "restricted", "users", "history", "limits"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("users");

  return (
    <div className="card">
      <div className="tabs">
        {tabs.map((k) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {t[k]}
          </button>
        ))}
      </div>
      {tab === "languages" && (
        <>
          <p className="muted small">{t.newLangNote}</p>
          <ListEditor
            table="languages"
            rows={props.languages}
            t={t}
            cols={[
              { key: "code", label: "Code", width: 50 },
              { key: "name", label: "Name (English)" },
              { key: "native_name", label: "Native name" },
              { key: "ui_label", label: "Switch label", width: 50 },
              { key: "tts_lang", label: "Speech (BCP-47)", width: 70 },
              { key: "is_guest_default", label: "Guest default", type: "bool" },
              { key: "sort", label: "Sort", type: "number", width: 50 },
            ]}
            blank={{ code: "", name: "", native_name: "", ui_label: "", tts_lang: "", is_guest_default: false, sort: 100 }}
          />
        </>
      )}
      {tab === "levels" && (
        <ListEditor
          table="levels"
          rows={props.levels}
          t={t}
          cols={[
            { key: "code", label: "Code", width: 50 },
            { key: "description", label: "Description" },
            { key: "sort", label: "Sort", type: "number", width: 50 },
          ]}
          blank={{ code: "", description: "", sort: 100 }}
        />
      )}
      {tab === "durations" && (
        <ListEditor table="durations" rows={props.durations} t={t} cols={[{ key: "minutes", label: "Minutes", type: "number" }]} blank={{ minutes: 60 }} />
      )}
      {tab === "instruments" && (
        <ListEditor
          table="instruments"
          rows={props.instruments}
          t={t}
          cols={[
            { key: "key", label: "Key", width: 80 },
            { key: "name", label: 'Name {"el","ru","en"}', type: "json", width: 220 },
            { key: "description", label: "What to generate", width: 220 },
            { key: "default_on", label: "On by default", type: "bool" },
            { key: "sort", label: "Sort", type: "number", width: 50 },
          ]}
          blank={{ key: "", name: { el: "", ru: "", en: "" }, description: "", default_on: false, sort: 100 }}
        />
      )}
      {tab === "grammar" && (
        <ListEditor
          table="grammar_topics"
          rows={props.grammar}
          t={t}
          cols={[
            { key: "language_code", label: "Language code", width: 50 },
            { key: "level", label: "Level", width: 50 },
            { key: "name", label: 'Name {"el","ru","en"}', type: "json", width: 320 },
            { key: "sort", label: "Sort", type: "number", width: 50 },
          ]}
          blank={{ language_code: "el", level: "A1", name: { el: "", ru: "", en: "" }, sort: 100 }}
        />
      )}
      {tab === "restricted" && (
        <ListEditor table="restricted_words" rows={props.restricted} t={t} cols={[{ key: "word", label: "Word", width: 200 }]} blank={{ word: "" }} />
      )}
      {tab === "users" && <Users users={props.users} t={t} selfId={props.selfId} />}
      {tab === "history" && <History rows={props.history} users={props.users} t={t} />}
      {tab === "limits" && <Limits settings={props.settings} t={t} />}
    </div>
  );
}
