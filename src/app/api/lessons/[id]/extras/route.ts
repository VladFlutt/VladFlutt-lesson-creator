import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog } from "@/lib/catalog";
import { ipHash, recordGeneration } from "@/lib/usage";
import { guestIdFromCookie, json, loadOwnLesson } from "@/lib/access";
import { drawImage, findNews, findVideo } from "@/lib/ai";

export const maxDuration = 300;

// Fills one of the slower blocks (image, news, video) after the main lesson.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { part } = await req.json().catch(() => ({ part: "" }));
  if (!["image", "news", "video"].includes(part)) return json({ error: "part" }, 400);

  const viewer = await getViewer();
  if (viewer.blocked) return json({ error: "blocked" }, 403);
  const lesson = await loadOwnLesson(id, viewer);
  if (!lesson) return json({ error: "not_found" }, 404);

  const guestId = await guestIdFromCookie();
  const who = { user_id: viewer.user?.id ?? null, guest_id: viewer.user ? null : guestId, ip_hash: ipHash(req.headers) };
  const { languages } = await loadCatalog(true);
  const lang = languages.find((l) => l.code === lesson.language_code);
  const ui = languages.find((l) => l.code === lesson.interface_code);
  const c = lesson.content;

  let value: unknown;
  try {
    if (part === "news") {
      const { articles, usage } = await findNews({
        query: c.newsQuery || lesson.theme,
        theme: lesson.theme,
        languageName: lang?.name || "Greek",
        interfaceName: ui?.name || "Greek",
      });
      value = articles;
      await recordGeneration({ ...who, lesson_id: id, kind: "news", theme: lesson.theme, language_code: lesson.language_code, ...usage });
    } else if (part === "video") {
      value = await findVideo(c.videoQuery || lesson.theme, lesson.language_code);
      await recordGeneration({ ...who, lesson_id: id, kind: "video", theme: lesson.theme, language_code: lesson.language_code });
    } else {
      const origin = new URL(req.url).origin;
      const img = await drawImage({ scene: c.imagePrompt || lesson.theme, characterIds: c.characters || [], origin });
      if ("url" in img) {
        value = { url: img.url };
      } else {
        const ext = img.mime.includes("jpeg") ? "jpg" : "png";
        const path = `${id}/${Date.now()}.${ext}`;
        const sb = supabaseAdmin();
        const up = await sb.storage.from("lesson-images").upload(path, img.bytes, { contentType: img.mime, upsert: true });
        if (up.error) throw new Error(up.error.message);
        value = { url: sb.storage.from("lesson-images").getPublicUrl(path).data.publicUrl };
      }
      await recordGeneration({ ...who, lesson_id: id, kind: "image", theme: lesson.theme, language_code: lesson.language_code });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`extras ${part} failed`, message);
    await recordGeneration({ ...who, lesson_id: id, kind: part, theme: lesson.theme, ok: false, error: message });
    value = { error: true };
  }

  await supabaseAdmin().rpc("set_lesson_block", { p_lesson: id, p_block: part, p_value: value });
  return json({ part, value });
}
