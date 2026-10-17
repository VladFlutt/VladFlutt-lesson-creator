import { redirect } from "next/navigation";
import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog, getSettings } from "@/lib/catalog";
import { AdminPanel, type UserRow, type HistoryRow } from "@/components/AdminPanel";

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect("/");
  const sb = supabaseAdmin();

  const [catalog, settings, profilesRes, gensRes, restrictedRes] = await Promise.all([
    loadCatalog(true),
    getSettings(),
    sb.from("profiles").select("*").order("created_at", { ascending: false }),
    sb
      .from("generations")
      .select("id, user_id, guest_id, kind, theme, language_code, input_tokens, output_tokens, ok, error, created_at")
      .order("created_at", { ascending: false })
      .limit(3000),
    sb.from("restricted_words").select("*").order("word"),
  ]);

  const profiles = profilesRes.data || [];
  const gens = gensRes.data || [];
  const emailById = new Map(profiles.map((p) => [p.id, p.email]));

  const users: UserRow[] = profiles.map((p) => {
    const mine = gens.filter((g) => g.user_id === p.id);
    return {
      id: p.id,
      email: p.email,
      status: p.status,
      limit_day: p.limit_day,
      limit_week: p.limit_week,
      limit_month: p.limit_month,
      time_spent_seconds: p.time_spent_seconds,
      last_seen_at: p.last_seen_at,
      created_at: p.created_at,
      lessons: mine.filter((g) => g.kind === "lesson").length,
      tokens: mine.reduce((s, g) => s + (g.input_tokens || 0) + (g.output_tokens || 0), 0),
    };
  });

  const history: HistoryRow[] = gens.map((g) => ({
    id: g.id,
    who: g.user_id ? emailById.get(g.user_id) || "deleted user" : `guest ${String(g.guest_id || "").slice(0, 8)}`,
    kind: g.kind,
    theme: g.theme,
    language_code: g.language_code,
    tokens_in: g.input_tokens,
    tokens_out: g.output_tokens,
    ok: g.ok,
    error: g.error,
    created_at: g.created_at,
  }));

  return (
    <AdminPanel
      languages={catalog.languages}
      levels={catalog.levels}
      durations={catalog.durations}
      instruments={catalog.instruments}
      restricted={restrictedRes.data || []}
      settings={settings}
      users={users}
      history={history}
      selfId={viewer.user!.id}
    />
  );
}
