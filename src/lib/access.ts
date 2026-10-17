import { cookies } from "next/headers";
import { supabaseAdmin, type Viewer } from "./supabase-server";
import { cleanGuestId } from "./usage";
import type { LessonRow } from "./lesson";

export async function guestIdFromCookie() {
  const store = await cookies();
  return cleanGuestId(store.get("guest_id")?.value);
}

// A lesson is editable by its owner, or by the guest browser that created it.
export async function loadOwnLesson(id: string, viewer: Viewer): Promise<LessonRow | null> {
  const { data } = await supabaseAdmin().from("lessons").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  if (viewer.user) return data.user_id === viewer.user.id ? (data as LessonRow) : null;
  const guestId = await guestIdFromCookie();
  return !data.user_id && data.guest_id === guestId ? (data as LessonRow) : null;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
