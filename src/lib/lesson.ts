// Lesson content shape and the JSON schema Claude fills in.

import { CHARACTERS } from "./characters";

export type ExerciseType = "choice" | "fill_gap" | "translate_to_target" | "translate_to_native" | "true_false";

export type Exercise = {
  type: ExerciseType;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type NewsItem = { title: string; url: string; source: string; published: string; summary: string };
export type Video = { title: string; url: string; videoId: string | null; channel: string };

export type LessonContent = {
  title: string;
  characters: string[];
  timing: { block: string; minutes: number }[];
  tutorTips: string[];
  imagePrompt: string;
  videoQuery: string;
  newsQuery: string;
  intro?: { description: string; objectives: string[] };
  warmup?: { questions: { question: string; translation: string }[] };
  cards?: { term: string; translation: string; example: string; exampleTranslation: string }[];
  text?: { title: string; body: string };
  translation?: { body: string };
  exercises?: Exercise[];
  dialogue?: { setting: string; lines: { speaker: string; text: string; translation: string }[] };
  summary?: { points: string[] };
  homework?: { tasks: string[] };
  custom?: { key: string; title: string; body: string }[];
  // Filled in after the main generation.
  image?: { url: string } | { error: true };
  news?: NewsItem[] | { error: true };
  video?: Video | { error: true };
};

export type LessonRow = {
  id: string;
  user_id: string | null;
  language_code: string;
  interface_code: string;
  theme: string;
  level: string;
  duration: number;
  instruments: string[];
  content: LessonContent;
  comments: string | null;
  saved: boolean;
  share_token: string | null;
  created_at: string;
};

// Blocks Claude writes. image/news/video are produced by separate calls.
export const TEXT_BLOCKS = ["intro", "warmup", "cards", "text", "translation", "exercises", "dialogue", "summary", "homework"] as const;
export const EXTRA_BLOCKS = ["image", "news", "video"] as const;

const str = { type: "string" };
const strArr = { type: "array", items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const BLOCK_SCHEMAS: Record<string, unknown> = {
  intro: obj({ description: str, objectives: strArr }),
  warmup: obj({ questions: { type: "array", items: obj({ question: str, translation: str }) } }),
  cards: { type: "array", items: obj({ term: str, translation: str, example: str, exampleTranslation: str }) },
  text: obj({ title: str, body: str }),
  translation: obj({ body: str }),
  exercises: {
    type: "array",
    items: obj({
      type: { type: "string", enum: ["choice", "fill_gap", "translate_to_target", "translate_to_native", "true_false"] },
      prompt: str,
      options: strArr,
      answer: str,
      explanation: str,
    }),
  },
  dialogue: obj({
    setting: str,
    lines: { type: "array", items: obj({ speaker: str, text: str, translation: str }) },
  }),
  summary: obj({ points: strArr }),
  homework: obj({ tasks: strArr }),
};

export function lessonSchema(blocks: string[], customKeys: string[]) {
  const props: Record<string, unknown> = {
    title: str,
    characters: { type: "array", items: { type: "string", enum: CHARACTERS.map((c) => c.id) } },
    timing: { type: "array", items: obj({ block: str, minutes: { type: "integer" } }) },
    tutorTips: strArr,
    imagePrompt: str,
    videoQuery: str,
    newsQuery: str,
  };
  for (const b of blocks) if (BLOCK_SCHEMAS[b]) props[b] = BLOCK_SCHEMAS[b];
  if (customKeys.length) {
    props.custom = { type: "array", items: obj({ key: { type: "string", enum: customKeys }, title: str, body: str }) };
  }
  return obj(props);
}

export const BLOCK_GUIDE: Record<string, string> = {
  intro: "intro: the theme and a warm, motivating description (in the INTERFACE language) of what the student will learn, plus 3-5 concrete objectives.",
  warmup: "warmup: 3-4 short personal ice-breaker questions in the LESSON language (with interface-language translation) that link the theme to the student's own life.",
  cards: "cards: 10-16 key words and phrases in the LESSON language (with article/gender where relevant), translation into the INTERFACE language, a short level-appropriate example sentence and its translation.",
  text: "text: a reading text in the LESSON language that uses the card vocabulary; length suited to the level and lesson duration (A1 about 80-120 words, C2 up to 450).",
  translation: "translation: a faithful translation of the text into the INTERFACE language.",
  exercises:
    "exercises: 8-12 interactive exercises mixing every type, in both directions. choice = pick the right word (3-4 options, the answer must be one of them); " +
    "fill_gap = sentence in the LESSON language with ___ for one missing word, options may be empty; translate_to_target = interface-language phrase to translate into the lesson language; " +
    "translate_to_native = lesson-language phrase to translate into the interface language; true_false = statement about the text, options exactly the two words for true and false in the interface language. " +
    "answer is the exact correct answer; explanation is a short kind explanation in the INTERFACE language. Keep translation answers short (2-6 words) so they can be checked.",
  dialogue:
    "dialogue: a natural dialogue of 8-14 lines in the LESSON language between 2-3 of the chosen characters, using the vocabulary; give each speaker a culturally natural name for the lesson language and keep it consistent; include an interface-language translation per line.",
  summary: "summary: 3-6 points (INTERFACE language) recapping what was learned, including the key grammar or phrases.",
  homework: "homework: 2-4 varied, realistic home tasks (INTERFACE language instructions) that reuse the vocabulary, one of them creative or personal.",
};

export function systemPrompt() {
  return [
    "You are an experienced professional language tutor and a high-level educational psychologist.",
    "You design one-to-one lessons for private tutors: clear structure, communicative tasks, spaced recycling of vocabulary,",
    "and a supportive tone that lowers anxiety, builds the student's confidence and keeps motivation high.",
    "Everything must match the student's CEFR level exactly: vocabulary, grammar and sentence length.",
    "Lesson-language content must be accurate, natural and idiomatic, with correct accents and spelling.",
    "Never include unsafe, political-agitation or adult content; keep examples suitable for teenagers and adults.",
  ].join(" ");
}

export function characterList() {
  return CHARACTERS.map((c) => `- ${c.id}: ${c.appearance}`).join("\n");
}

export function lessonPrompt(p: {
  theme: string;
  languageName: string;
  interfaceName: string;
  level: string;
  minutes: number;
  blocks: string[];
  custom: { key: string; description: string }[];
}) {
  const guide = p.blocks.map((b) => BLOCK_GUIDE[b]).filter(Boolean);
  for (const c of p.custom) guide.push(`custom (key "${c.key}"): ${c.description}. Write it with a short title and body.`);
  return [
    `Create a ${p.minutes}-minute lesson.`,
    `Theme: "${p.theme}"`,
    `LESSON language (what the student learns): ${p.languageName}`,
    `INTERFACE language (the tutor's and student's own language, used for translations and instructions): ${p.interfaceName}`,
    `Student level: ${p.level}`,
    "",
    "Always fill these fields:",
    "- title: a short lesson title in the LESSON language.",
    "- characters: pick 1-3 recurring characters from the list below who fit the theme (they appear in the image and the dialogue).",
    "- timing: a plan that splits the full lesson time across the blocks below, in order (block names in the INTERFACE language); minutes must add up to " + p.minutes + ".",
    "- tutorTips: 3-5 practical tips for the tutor (INTERFACE language) on pacing, likely student difficulties, error correction and keeping the student motivated.",
    "- imagePrompt: one English sentence describing a single scene for the lesson illustration with the chosen characters (refer to them by appearance, not id).",
    "- videoQuery: a YouTube search query in the LESSON language that finds a short learner-friendly video on the theme.",
    "- newsQuery: a news search query in the LESSON language for recent articles on the theme.",
    "",
    "Blocks to write:",
    ...guide.map((g) => "- " + g),
    "",
    "Characters:",
    characterList(),
  ].join("\n");
}
