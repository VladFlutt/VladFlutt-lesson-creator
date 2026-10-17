import { randomBytes } from "crypto";
import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { json, loadOwnLesson } from "@/lib/access";

// Save (signed-in users only), update comments, or delete a lesson.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return json({ error: "auth" }, 401);
  if (viewer.blocked) return json({ error: "blocked" }, 403);
  const lesson = await loadOwnLesson(id, viewer);
  if (!lesson) return json({ error: "not_found" }, 404);

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.comments === "string") update.comments = body.comments.slice(0, 5000);
  if (body.saved === true) update.saved = true;
  if (body.share === true && !lesson.share_token) update.share_token = randomBytes(12).toString("hex");

  const { data, error } = await supabaseAdmin().from("lessons").update(update).eq("id", id).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json({ lesson: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return json({ error: "auth" }, 401);
  const lesson = await loadOwnLesson(id, viewer);
  if (!lesson) return json({ error: "not_found" }, 404);
  await supabaseAdmin().from("lessons").delete().eq("id", id);
  return json({ ok: true });
}
