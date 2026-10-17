import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { json } from "@/lib/access";

// Called about once a minute while a signed-in user has the app open.
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return json({ ok: false });
  const { seconds } = await req.json().catch(() => ({ seconds: 0 }));
  await supabaseAdmin().rpc("add_time_spent", { p_user: viewer.user.id, p_seconds: Math.round(Number(seconds) || 0) });
  return json({ ok: true });
}
