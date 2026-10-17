import Anthropic from "@anthropic-ai/sdk";
import { CHARACTERS, STYLE } from "./characters";
import type { Video } from "./lesson";
import { normalizeUrl, pickArticles, pickVideo, type VideoCandidate } from "./news";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export type Usage = { input_tokens: number; output_tokens: number };

function usageOf(msg: { usage?: { input_tokens?: number; output_tokens?: number } }): Usage {
  return { input_tokens: msg.usage?.input_tokens || 0, output_tokens: msg.usage?.output_tokens || 0 };
}

function textOf(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
}

// One structured-output call. Streams so long lessons don't hit HTTP timeouts.
export async function generateJson<T>(system: string, prompt: string, schema: unknown, maxTokens = 32000) {
  const params = {
    model: MODEL(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = anthropic().beta.messages.stream(params as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg: any = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this theme.");
  if (msg.stop_reason === "max_tokens") throw new Error("The lesson was too long to finish. Try fewer instruments.");
  const data = JSON.parse(textOf(msg.content)) as T;
  return { data, usage: usageOf(msg) };
}

// Finds recent articles with Claude's web search, keeping only URLs that the
// search actually returned so links can't be invented.
export async function findNews(p: { query: string; theme: string; languageName: string; languageCode: string; interfaceName: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 31 * 86400_000).toISOString().slice(0, 10);
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    {
      role: "user",
      content:
        `Today is ${today}. Find 2 news articles about "${p.theme}" (search ideas: ${p.query}) published between ${monthAgo} and ${today}. ` +
        `The articles must be written in ${p.languageName} on news sites in ${p.languageName}; never use articles in any other language, ` +
        `and return fewer than 2 rather than break this rule. Search in ${p.languageName}. Use only articles that appear in your search results. ` +
        `Reply with JSON only: {"articles":[{"title":"","url":"","source":"","published":"YYYY-MM-DD","language":"","summary":""}]} ` +
        `where language is the ISO 639-1 code of the article's language (${p.languageCode} for ${p.languageName}) and ` +
        `summary is one sentence in ${p.interfaceName}.`,
    },
  ];
  const usage: Usage = { input_tokens: 0, output_tokens: 0 };
  const seen = new Set<string>();
  let finalText = "";
  for (let i = 0; i < 4; i++) {
    const params = {
      model: MODEL(),
      max_tokens: 8000,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg: any = await anthropic().beta.messages.create(params as any);
    usage.input_tokens += msg.usage?.input_tokens || 0;
    usage.output_tokens += msg.usage?.output_tokens || 0;
    for (const block of msg.content || []) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) seen.add(normalizeUrl(r.url));
      }
    }
    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    finalText = textOf(msg.content || []);
    break;
  }
  return { articles: pickArticles(finalText, seen, p.languageCode), usage };
}

export async function findVideo(query: string, langCode: string): Promise<Video> {
  const key = process.env.YOUTUBE_API_KEY;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  if (!key) return { title: query, url: searchUrl, videoId: null, channel: "YouTube" };
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.search = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "10",
    relevanceLanguage: langCode,
    safeSearch: "strict",
    videoEmbeddable: "true",
    key,
  }).toString();
  const res = await fetch(u);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status})`);
  const data = await res.json();
  const ids: string[] = (data.items || []).map((i: { id: { videoId: string } }) => i.id.videoId).filter(Boolean);
  if (!ids.length) return { title: query, url: searchUrl, videoId: null, channel: "YouTube" };

  // The search only biases by language, so read each video's language metadata.
  const details = new URL("https://www.googleapis.com/youtube/v3/videos");
  details.search = new URLSearchParams({ part: "snippet", id: ids.join(","), key }).toString();
  const dres = await fetch(details);
  const meta = new Map<string, { defaultAudioLanguage?: string; defaultLanguage?: string }>();
  if (dres.ok) for (const v of (await dres.json()).items || []) meta.set(v.id, v.snippet || {});
  const candidates: VideoCandidate[] = (data.items || []).map((i: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }) => ({
    id: i.id.videoId,
    title: decodeEntities(i.snippet.title),
    channel: i.snippet.channelTitle,
    audioLanguage: meta.get(i.id.videoId)?.defaultAudioLanguage,
    language: meta.get(i.id.videoId)?.defaultLanguage,
  }));
  const pick = pickVideo(candidates, langCode);
  if (!pick) return { title: query, url: searchUrl, videoId: null, channel: "YouTube" };
  return { title: pick.title, url: `https://www.youtube.com/watch?v=${pick.id}`, videoId: pick.id, channel: pick.channel };
}

function decodeEntities(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// Draws the lesson scene with Gemini, passing the character references.
// Lesson illustration. Uses OpenAI images when OPENAI_API_KEY is set, Gemini when
// GEMINI_API_KEY is set, and otherwise (or when drawing fails) falls back to the
// closest reference picture.
export type DrawnImage = { bytes: Buffer; mime: string } | { url: string; failed?: string };

export async function drawImage(p: { scene: string; characterIds: string[]; origin: string }): Promise<DrawnImage> {
  const chars = CHARACTERS.filter((c) => p.characterIds.includes(c.id)).slice(0, 3);
  const files = Array.from(new Set(chars.flatMap((c) => c.refs))).slice(0, 4);
  if (!files.length) files.push("friends-alex-nikos.jpg");
  const prompt =
    `${STYLE}\nScene: ${p.scene}\n` +
    (chars.length ? `Characters in the scene: ${chars.map((c) => c.appearance).join("; ")}.` : "") +
    "\nWide 4:3 composition.";

  const fallback = `${p.origin}/characters/${files[0]}`;
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return { url: fallback };

  const refs: { name: string; bytes: Buffer }[] = [];
  for (const f of files) {
    const res = await fetch(`${p.origin}/characters/${f}`);
    if (res.ok) refs.push({ name: f, bytes: Buffer.from(await res.arrayBuffer()) });
  }
  try {
    return process.env.OPENAI_API_KEY ? await drawWithOpenAI(prompt, refs) : await drawWithGemini(prompt, refs);
  } catch (e) {
    // Out of credit or a provider outage shouldn't leave the lesson without a picture.
    return { url: fallback, failed: e instanceof Error ? e.message : String(e) };
  }
}

async function drawWithOpenAI(prompt: string, refs: { name: string; bytes: Buffer }[]): Promise<DrawnImage> {
  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", "1536x1024");
  form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
  for (const r of refs) form.append("image[]", new Blob([new Uint8Array(r.bytes)], { type: "image/jpeg" }), r.name);

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image model returned no image");
  return { bytes: Buffer.from(b64, "base64"), mime: "image/png" };
}

async function drawWithGemini(prompt: string, refs: { name: string; bytes: Buffer }[]): Promise<DrawnImage> {
  const parts: unknown[] = refs.map((r) => ({ inlineData: { mimeType: "image/jpeg", data: r.bytes.toString("base64") } }));
  parts.push({ text: prompt });

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return { bytes: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
    }
  }
  throw new Error("Image model returned no image");
}

// Translates the interface strings for a newly added language.
export async function translateUi(strings: Record<string, string>, languageName: string) {
  const props: Record<string, unknown> = {};
  for (const k of Object.keys(strings)) props[k] = { type: "string" };
  const schema = { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
  return generateJson<Record<string, string>>(
    "You translate software interface strings. Keep placeholders like {n}, {w}, {a} unchanged. Keep strings short.",
    `Translate every value of this JSON into ${languageName}. Keep the keys.\n${JSON.stringify(strings, null, 1)}`,
    schema,
    16000
  );
}
