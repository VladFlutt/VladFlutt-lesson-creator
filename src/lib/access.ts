import { cookies } from "next/headers";
import { supabaseAdmin, type Viewer } from "./supabase-server";
import { cleanGuestId } from "./usage";
import type { LessonRow } from "./lesson";
import { serviceKeyProblem } from "./text";

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

// Long AI work: answer at once and send a space every few seconds so browsers and
// networks don't drop the idle connection; the JSON result follows (leading spaces are
// valid JSON). Failures are reported as {error} in the body, since the status is already sent.
export function streamJson(work: () => Promise<unknown>, everyMs = 5000) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(" "));
      const beat = setInterval(() => controller.enqueue(enc.encode(" ")), everyMs);
      let result: unknown;
      try {
        result = await work();
      } catch (e) {
        result = { error: "generation", message: e instanceof Error ? e.message : String(e) };
      }
      clearInterval(beat);
      controller.enqueue(enc.encode(JSON.stringify(result)));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

// Stops a request before any paid AI call when the server can't write to the database.
export function configError(): Response | null {
  const problem = serviceKeyProblem(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!problem) return null;
  console.error(problem);
  return json({ error: "config" }, 500);
}
