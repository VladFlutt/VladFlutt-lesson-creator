import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog, getUi } from "@/lib/catalog";
import { checkQuota, findRestrictedWord, ipHash, recordGeneration } from "@/lib/usage";
import { guestIdFromCookie, json } from "@/lib/access";
import { generateJson } from "@/lib/ai";
import { lessonPrompt, lessonSchema, systemPrompt, TEXT_BLOCKS, type LessonContent } from "@/lib/lesson";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const theme = String(body.theme || "").trim().slice(0, 200);
  const languageCode = String(body.languageCode || "");
  const level = String(body.level || "");
  const duration = Number(body.duration);
  const wanted: string[] = Array.isArray(body.instruments) ? body.instruments.map(String) : [];
  if (!theme) return json({ error: "theme" }, 400);

  const viewer = await getViewer();
  const guestId = await guestIdFromCookie();
  const ip = ipHash(req.headers);
  if (viewer.blocked) return json({ error: "blocked" }, 403);

  const catalog = await loadCatalog();
  const ui = await getUi(catalog.languages);
  const language = catalog.languages.find((l) => l.code === languageCode);
  if (!language) return json({ error: "language" }, 400);
  if (!viewer.user && !language.is_guest_default) return json({ error: "guest_language" }, 403);
  if (!catalog.levels.some((l) => l.code === level)) return json({ error: "level" }, 400);
  if (!catalog.durations.some((d) => d.minutes === duration)) return json({ error: "duration" }, 400);
  const instruments = catalog.instruments.filter((i) => wanted.includes(i.key));
  if (!instruments.length) return json({ error: "instruments" }, 400);

  const restricted = await findRestrictedWord(theme);
  if (restricted) return json({ error: "restricted", word: restricted }, 400);

  const quota = await checkQuota(viewer, guestId, ip);
  if (!quota.ok) return json({ error: quota.reason }, 429);

  const keys = instruments.map((i) => i.key);
  const blocks = TEXT_BLOCKS.filter((b) => keys.includes(b));
  const custom = instruments.filter((i) => !i.is_builtin).map((i) => ({ key: i.key, description: i.description }));
  const interfaceLang = catalog.languages.find((l) => l.code === ui.code);
  const who = { user_id: viewer.user?.id ?? null, guest_id: viewer.user ? null : guestId, ip_hash: ip };

  try {
    const { data: content, usage } = await generateJson<LessonContent>(
      systemPrompt(),
      lessonPrompt({
        theme,
        languageName: language.name,
        interfaceName: interfaceLang?.name || "Greek",
        level,
        minutes: duration,
        blocks,
        custom,
      }),
      lessonSchema(blocks, custom.map((c) => c.key))
    );

    const { data: lesson, error } = await supabaseAdmin()
      .from("lessons")
      .insert({
        ...(viewer.user ? { user_id: viewer.user.id } : { guest_id: guestId }),
        language_code: language.code,
        interface_code: ui.code,
        theme,
        level,
        duration,
        instruments: keys,
        content,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await recordGeneration({ ...who, lesson_id: lesson.id, kind: "lesson", theme, language_code: language.code, ...usage });
    return json({ lesson, remaining: quota.remaining === null ? null : quota.remaining - 1 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordGeneration({ ...who, kind: "lesson_failed", theme, language_code: language.code, ok: false, error: message });
    return json({ error: "generation", message }, 500);
  }
}
