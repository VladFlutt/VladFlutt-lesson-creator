import { createHash } from "crypto";
import { supabaseAdmin, type Viewer } from "./supabase-server";
import { getSettings } from "./catalog";
import { matchRestricted } from "./text";

export function ipHash(h: { get(name: string): string | null }): string {
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "")).digest("hex").slice(0, 32);
}

export type Quota = { ok: true; remaining: number | null } | { ok: false; reason: "guest_limit" | "limit" | "blocked" };

// Only whole-lesson generations count toward limits; extras and single blocks don't.
export async function checkQuota(viewer: Viewer, guestId: string, ip: string): Promise<Quota> {
  const sb = supabaseAdmin();
  const settings = await getSettings();

  if (!viewer.user) {
    const limit = settings.guest_limit ?? 3;
    const { count } = await sb
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("kind", "lesson")
      .is("user_id", null)
      .or(`guest_id.eq.${guestId},ip_hash.eq.${ip}`);
    const used = count || 0;
    return used >= limit ? { ok: false, reason: "guest_limit" } : { ok: true, remaining: limit - used };
  }

  if (viewer.blocked) return { ok: false, reason: "blocked" };
  if (viewer.isAdmin) return { ok: true, remaining: null };

  const { data: profile } = await sb
    .from("profiles")
    .select("limit_day, limit_week, limit_month")
    .eq("id", viewer.user.id)
    .maybeSingle();

  const periods: [number | null, number][] = [
    [profile?.limit_day ?? settings.default_limit_day ?? null, 1],
    [profile?.limit_week ?? settings.default_limit_week ?? null, 7],
    [profile?.limit_month ?? settings.default_limit_month ?? null, 30],
  ];
  let remaining: number | null = null;
  for (const [limit, days] of periods) {
    if (limit === null || limit === undefined) continue;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { count } = await sb
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("kind", "lesson")
      .eq("user_id", viewer.user.id)
      .gte("created_at", since);
    const left = limit - (count || 0);
    if (left <= 0) return { ok: false, reason: "limit" };
    remaining = remaining === null ? left : Math.min(remaining, left);
  }
  return { ok: true, remaining };
}

export async function recordGeneration(row: {
  user_id: string | null;
  guest_id: string | null;
  ip_hash: string | null;
  lesson_id?: string | null;
  kind: string;
  theme?: string | null;
  language_code?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  ok?: boolean;
  error?: string | null;
}) {
  await supabaseAdmin().from("generations").insert(row);
}

export async function findRestrictedWord(theme: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("restricted_words").select("word").eq("status", "active");
  return matchRestricted(theme, (data || []).map((r) => String(r.word || "")));
}

export function cleanGuestId(raw: string | undefined): string {
  return (raw || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "anonymous";
}
