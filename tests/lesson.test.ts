import { readFileSync, existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BLOCK_GUIDE, BLOCK_SCHEMAS, EXTRA_BLOCKS, TEXT_BLOCKS, lessonPrompt, lessonSchema } from "@/lib/lesson";
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

describe("lesson blocks", () => {
  it("has a schema and a writing guide for every text block", () => {
    for (const b of TEXT_BLOCKS) {
      expect(BLOCK_SCHEMAS[b], b).toBeTruthy();
      expect(BLOCK_GUIDE[b], b).toBeTruthy();
    }
  });

  it("seeds a built-in instrument for every block", () => {
    const sql = readFileSync(path.join(__dirname, "../supabase/migrations/0001_init.sql"), "utf8");
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

describe("characters", () => {
  it("has a reference picture on disk for every character", () => {
    for (const c of CHARACTERS) {
      expect(c.refs.length, c.id).toBeGreaterThan(0);
      for (const f of c.refs) expect(existsSync(path.join(__dirname, "../public/characters", f)), f).toBe(true);
    }
  });
});
