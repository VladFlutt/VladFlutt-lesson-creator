import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog, getUi, grammarLabel } from "@/lib/catalog";
import { checkQuota, findRestrictedWord, ipHash, recordGeneration } from "@/lib/usage";
import { configError, guestIdFromCookie, json } from "@/lib/access";
import { generateJson } from "@/lib/ai";
import { blockPrompt, blockSchema, isEmptyBlock, lessonPrompt, lessonSchema, splitBlocks, systemPrompt, TEXT_BLOCKS, type LessonContent } from "@/lib/lesson";

export const maxDuration = 300;

export async function POST(req: Request) {
  const misconfigured = configError();
  if (misconfigured) return misconfigured;
  const body = await req.json().catch(() => ({}));
  const theme = String(body.theme || "").trim().slice(0, 200);
  const languageCode = String(body.languageCode || "");
  const level = String(body.level || "");
  const duration = Number(body.duration);
  const wanted: string[] = Array.isArray(body.instruments) ? body.instruments.map(String) : [];
  const grammarIds: string[] = Array.isArray(body.grammar) ? body.grammar.map(String) : [];
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

  // Up to three grammar topics of the lesson language, only with the grammar block.
  const wantsGrammar = instruments.some((i) => i.key === "grammar");
  const grammarTopics = wantsGrammar
    ? catalog.grammar.filter((g) => grammarIds.includes(g.id) && g.language_code === language.code)
    : [];
  if (grammarIds.length > 3 || (wantsGrammar && grammarTopics.length !== new Set(grammarIds).size)) {
    return json({ error: "grammar" }, 400);
  }
  const grammarFocus = grammarTopics.map(grammarLabel);

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
    const base = { theme, languageName: language.name, interfaceName: interfaceLang?.name || "Greek", level, minutes: duration, grammarFocus };
    const customKeys = custom.map((c) => c.key);
    const [first, second] = splitBlocks(blocks, custom.length > 0);
    const part1 = await generateJson<LessonContent>(
      systemPrompt(),
      lessonPrompt({ ...base, blocks: first, custom: second.length ? [] : custom, later: second }),
      lessonSchema(first, second.length ? [] : customKeys)
    );
    let content = part1.data;
    const usage = { ...part1.usage };
    if (second.length) {
      const part2 = await generateJson<Partial<LessonContent>>(
        systemPrompt(),
        lessonPrompt({ ...base, blocks: second, custom, soFar: part1.data }),
        lessonSchema(second, customKeys, false)
      );
      content = { ...content, ...part2.data };
      usage.input_tokens += part2.usage.input_tokens;
      usage.output_tokens += part2.usage.output_tokens;
    }
    if (grammarFocus.length) content = { ...content, grammarFocus };

    // Rarely a block comes back without its content; ask for it once more.
    for (const block of blocks.filter((b) => isEmptyBlock(content[b as keyof LessonContent]))) {
      const retry = await generateJson<Record<string, unknown>>(
        systemPrompt(),
        blockPrompt({ ...base, content, block, fresh: false }),
        blockSchema(block),
        16000
      );
      content = { ...content, [block]: retry.data[block] };
      usage.input_tokens += retry.usage.input_tokens;
      usage.output_tokens += retry.usage.output_tokens;
    }

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
