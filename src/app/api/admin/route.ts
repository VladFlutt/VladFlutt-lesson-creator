import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { json } from "@/lib/access";
import { translateUi } from "@/lib/ai";
import { builtinDicts, en } from "@/lib/i18n";
import { recordGeneration } from "@/lib/usage";

// Columns the admin may write, per table.
const TABLES: Record<string, string[]> = {
  languages: ["code", "name", "native_name", "tts_lang", "ui_label", "is_guest_default", "status", "sort"],
  levels: ["code", "description", "status", "sort"],
  durations: ["minutes", "status"],
  instruments: ["key", "name", "description", "default_on", "status", "sort"],
  restricted_words: ["word", "status"],
};

function pick(data: Record<string, unknown>, cols: string[]) {
  const out: Record<string, unknown> = {};
  for (const c of cols) if (data[c] !== undefined) out[c] = data[c];
  return out;
}

const nullableInt = (v: unknown) => (v === "" || v === null || v === undefined ? null : Math.max(0, Math.round(Number(v))));

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return json({ error: "forbidden" }, 403);
  const sb = supabaseAdmin();
  const { action, table, id, data = {} } = await req.json().catch(() => ({}));

  // Reference lists: languages, levels, durations, instruments, restricted words.
  if (TABLES[table]) {
    const row = pick(data, TABLES[table]);
    if (action === "create") {
      if (table === "instruments") Object.assign(row, { is_builtin: false });
      if (table === "languages" && row.code && !builtinDicts[String(row.code)]) {
        try {
          const { data: strings, usage } = await translateUi(en as Record<string, string>, String(row.name));
          row.ui_strings = strings;
          await recordGeneration({ user_id: viewer.user!.id, guest_id: null, ip_hash: null, kind: "ui_translation", theme: String(row.name), ...usage });
        } catch (e) {
          console.error("UI translation failed", e);
        }
      }
      const { error } = await sb.from(table).insert(row);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (action === "update" && id) {
      if (table === "instruments") {
        // Built-in instruments keep their key; renderers depend on it.
        const { data: cur } = await sb.from("instruments").select("is_builtin").eq("id", id).maybeSingle();
        if (cur?.is_builtin) delete row.key;
      }
      if (table === "languages" && row.is_guest_default === true) {
        await sb.from("languages").update({ is_guest_default: false }).neq("id", id);
      }
      const { error } = await sb.from(table).update(row).eq("id", id);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (action === "delete" && id) {
      if (table === "instruments") {
        const { data: cur } = await sb.from("instruments").select("is_builtin").eq("id", id).maybeSingle();
        if (cur?.is_builtin) return json({ error: "Built-in instruments can be blocked but not deleted." }, 400);
      }
      if (table === "languages") {
        const { data: cur } = await sb.from("languages").select("code").eq("id", id).maybeSingle();
        if (cur?.code === "el" || cur?.code === "ru") return json({ error: "Greek and Russian can be blocked but not deleted." }, 400);
      }
      const { error } = await sb.from(table).delete().eq("id", id);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    return json({ error: "action" }, 400);
  }

  if (table === "users") {
    if (action === "create") {
      const { error } = await sb.auth.admin.createUser({
        email: String(data.email || "").trim(),
        password: String(data.password || ""),
        email_confirm: true,
      });
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (!id) return json({ error: "id" }, 400);
    if (id === viewer.user!.id && (action === "block" || action === "delete")) {
      return json({ error: "You can't block or delete your own admin account." }, 400);
    }
    if (action === "block" || action === "unblock") {
      const blocked = action === "block";
      await sb.from("profiles").update({ status: blocked ? "blocked" : "active" }).eq("id", id);
      const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: blocked ? "876000h" : "none" });
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (action === "delete") {
      const { error } = await sb.auth.admin.deleteUser(id);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (action === "limits") {
      const { error } = await sb
        .from("profiles")
        .update({ limit_day: nullableInt(data.limit_day), limit_week: nullableInt(data.limit_week), limit_month: nullableInt(data.limit_month) })
        .eq("id", id);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    return json({ error: "action" }, 400);
  }

  if (table === "settings" && action === "update") {
    const allowed = ["guest_limit", "default_limit_day", "default_limit_week", "default_limit_month"];
    const rows = allowed
      .filter((k) => data[k] !== undefined)
      .map((k) => ({ key: k, value: nullableInt(data[k]) }));
    const { error } = await sb.from("settings").upsert(rows);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  return json({ error: "table" }, 400);
}
