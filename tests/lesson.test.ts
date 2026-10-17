import { readFileSync, existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BLOCK_GUIDE, BLOCK_SCHEMAS, EXERCISE_TYPES, EXTRA_BLOCKS, TEXT_BLOCKS, lessonPrompt, lessonSchema, splitBlocks } from "@/lib/lesson";
import { CHARACTERS } from "@/lib/characters";

type Node = { type?: string; properties?: Record<string, Node>; required?: string[]; additionalProperties?: boolean; items?: Node };

// Structured outputs need every object closed and every property required.
function checkStrict(node: Node, where = "root") {
  if (node.type === "object") {
    expect(node.additionalProperties, where).toBe(false);
    expect([...(node.required || [])].sort(), where).toEqual(Object.keys(node.properties || {}).sort());
    for (const [k, v] of Object.entries(node.properties || {})) checkStrict(v, `${where}.${k}`);
  }
  if (node.items) checkStrict(node.items, `${where}[]`);
}

describe("lessonSchema", () => {
  it("is strict for every block combination", () => {
    checkStrict(lessonSchema([...TEXT_BLOCKS], ["my_tool"]) as Node);
    checkStrict(lessonSchema([], []) as Node);
  });

  it("contains only the chosen blocks plus the always-filled fields", () => {
    const s = lessonSchema(["cards", "dialogue"], []) as Node;
    expect(Object.keys(s.properties!).sort()).toEqual(
      ["cards", "characters", "dialogue", "imagePrompt", "newsQuery", "tutorTips", "timing", "title", "videoQuery"].sort()
    );
  });

  it("limits characters to the known cast and custom keys to the chosen ones", () => {
    const s = lessonSchema([], ["k1", "k2"]) as { properties: Record<string, { items: { enum?: string[]; properties?: Record<string, { enum?: string[] }> } }> };
    expect(s.properties.characters.items.enum).toEqual(CHARACTERS.map((c) => c.id));
    expect(s.properties.custom.items.properties!.key.enum).toEqual(["k1", "k2"]);
  });
});

describe("splitBlocks", () => {
  it("keeps small lessons in one call", () => {
    expect(splitBlocks(["cards", "grammar", "exercises"], false)).toEqual([["cards", "grammar", "exercises"], []]);
  });

  it("writes practice blocks in a second call for big lessons", () => {
    const [first, second] = splitBlocks([...TEXT_BLOCKS], true);
    expect(second).toEqual(["exercises", "summary", "homework"]);
    expect(first).toEqual(["intro", "warmup", "cards", "grammar", "text", "translation", "dialogue"]);
  });

  // The full schema before the grammar block was accepted; adding grammar to it was not.
  it("keeps every call's schema smaller than the largest schema the API accepted", () => {
    const accepted = JSON.stringify(lessonSchema(TEXT_BLOCKS.filter((b) => b !== "grammar"), [])).length;
    const [first, second] = splitBlocks([...TEXT_BLOCKS], true);
    expect(JSON.stringify(lessonSchema(first, [])).length).toBeLessThan(accepted);
    expect(JSON.stringify(lessonSchema(second, ["custom1"], false)).length).toBeLessThan(accepted);
  });

  it("asks the second call for only its blocks, with the first part as context", () => {
    const p = lessonPrompt({ theme: "x", languageName: "Greek", interfaceName: "Russian", level: "A2", minutes: 45, blocks: ["exercises"], custom: [], soFar: { title: "Στο χωριό" } });
    expect(p).toContain("Στο χωριό");
    expect(p).toContain(BLOCK_GUIDE.exercises);
    expect(p).not.toContain("Always fill these fields");
    const s = lessonSchema(["exercises"], [], false) as { properties: Record<string, unknown> };
    expect(Object.keys(s.properties)).toEqual(["exercises"]);
  });
});

describe("lesson blocks", () => {
  it("has a schema and a writing guide for every text block", () => {
    for (const b of TEXT_BLOCKS) {
      expect(BLOCK_SCHEMAS[b], b).toBeTruthy();
      expect(BLOCK_GUIDE[b], b).toBeTruthy();
    }
  });

  it("seeds a built-in instrument for every block", () => {
    const dir = path.join(__dirname, "../supabase/migrations");
    const sql = readFileSync(path.join(dir, "0001_init.sql"), "utf8") + readFileSync(path.join(dir, "0002_grammar.sql"), "utf8");
    for (const b of [...TEXT_BLOCKS, ...EXTRA_BLOCKS]) expect(sql, b).toContain(`('${b}', '{`);
    expect(sql).toMatch(/\('guest_limit', '3'\)/);
  });

  it("mentions the theme, level, languages and only the chosen blocks in the prompt", () => {
    const p = lessonPrompt({ theme: "Στο καφέ", languageName: "Greek", interfaceName: "Russian", level: "A2", minutes: 45, blocks: ["cards"], custom: [] });
    expect(p).toContain("Στο καφέ");
    expect(p).toContain("A2");
    expect(p).toContain("Greek");
    expect(p).toContain("Russian");
    expect(p).toContain(BLOCK_GUIDE.cards);
    expect(p).not.toContain(BLOCK_GUIDE.dialogue);
  });
});

describe("exercises and grammar", () => {
  it("offers only linguistic exercise types", () => {
    const s = lessonSchema(["exercises"], []) as unknown as { properties: { exercises: { items: { properties: { type: { enum: string[] } } } } } };
    expect(s.properties.exercises.items.properties.type.enum).toEqual([...EXERCISE_TYPES]);
    expect(EXERCISE_TYPES).not.toContain("true_false");
    expect(BLOCK_GUIDE.exercises).toMatch(/LINGUISTIC/);
  });

  it("passes the tutor's grammar topics into the prompt", () => {
    const base = { theme: "x", languageName: "Greek", interfaceName: "Russian", level: "A2", minutes: 45, custom: [] };
    const p = lessonPrompt({ ...base, blocks: ["grammar", "exercises"], grammarFocus: ["Simple past (aorist) (Αόριστος)", "Future tense (θα)"] });
    expect(p).toContain("GRAMMAR FOCUS chosen by the tutor: Simple past (aorist) (Αόριστος); Future tense (θα)");
    expect(p).toContain(BLOCK_GUIDE.grammar);
    expect(lessonPrompt({ ...base, blocks: ["grammar"] })).not.toContain("GRAMMAR FOCUS chosen");
  });

  it("seeds grammar topics with names in every interface language", () => {
    const sql = readFileSync(path.join(__dirname, "../supabase/migrations/0002_grammar.sql"), "utf8");
    const names = [...sql.matchAll(/\('(el|ru)', '(A1|A2|B1|B2|C1|C2)', '(\{.*?\})', \d+\)/g)];
    expect(names.length).toBeGreaterThan(30);
    for (const [, , , json] of names) {
      const n = JSON.parse(json);
      expect(n.el && n.ru && n.en, json).toBeTruthy();
    }
  });
});

describe("characters", () => {
  it("has a reference picture on disk for every character", () => {
    for (const c of CHARACTERS) {
      expect(c.refs.length, c.id).toBeGreaterThan(0);
      for (const f of c.refs) expect(existsSync(path.join(__dirname, "../public/characters", f)), f).toBe(true);
    }
  });
});
