import { getViewer } from "@/lib/supabase-server";
import { loadCatalog } from "@/lib/catalog";
import { ipHash, recordGeneration } from "@/lib/usage";
import { guestIdFromCookie, json, loadOwnLesson } from "@/lib/access";
import { generateJson } from "@/lib/ai";
import { BLOCK_GUIDE, BLOCK_SCHEMAS, systemPrompt } from "@/lib/lesson";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 300;

// Rewrites a single text block, keeping the rest of the lesson as context.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { block } = await req.json().catch(() => ({ block: "" }));
  if (!BLOCK_SCHEMAS[block]) return json({ error: "block" }, 400);

  const viewer = await getViewer();
  if (viewer.blocked) return json({ error: "blocked" }, 403);
  const lesson = await loadOwnLesson(id, viewer);
  if (!lesson) return json({ error: "not_found" }, 404);

  const { languages } = await loadCatalog(true);
  const lang = languages.find((l) => l.code === lesson.language_code);
  const ui = languages.find((l) => l.code === lesson.interface_code);
  const { image, news, video, ...rest } = lesson.content;
  void image; void news; void video;

  const schema = { type: "object", properties: { [block]: BLOCK_SCHEMAS[block] }, required: [block], additionalProperties: false };
  const prompt = [
    `Here is an existing ${lesson.duration}-minute ${lesson.level} lesson on "${lesson.theme}".`,
    `LESSON language: ${lang?.name}. INTERFACE language: ${ui?.name}.`,
    JSON.stringify(rest),
    "",
    `Write a fresh, different version of only this block, consistent with the rest of the lesson:`,
    BLOCK_GUIDE[block],
  ].join("\n");

  const guestId = await guestIdFromCookie();
  const who = { user_id: viewer.user?.id ?? null, guest_id: viewer.user ? null : guestId, ip_hash: ipHash(req.headers) };
  try {
    const { data, usage } = await generateJson<Record<string, unknown>>(systemPrompt(), prompt, schema, 16000);
    await supabaseAdmin().rpc("set_lesson_block", { p_lesson: id, p_block: block, p_value: data[block] });
    await recordGeneration({ ...who, lesson_id: id, kind: "block", theme: lesson.theme, language_code: lesson.language_code, ...usage });
    return json({ block, value: data[block] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordGeneration({ ...who, lesson_id: id, kind: "block", theme: lesson.theme, ok: false, error: message });
    return json({ error: "generation", message }, 500);
  }
}
