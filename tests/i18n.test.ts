import { describe, expect, it } from "vitest";
import { builtinDicts, en, fmt, resolveDict } from "@/lib/i18n";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();

describe("interface strings", () => {
  for (const [code, dict] of Object.entries(builtinDicts)) {
    it(`${code} has every string, with the same placeholders as English`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[key], `${code}.${key}`).toBeTruthy();
        expect(placeholders(dict[key]), `${code}.${key}`).toEqual(placeholders(en[key]));
      }
    });
  }

  it("fills placeholders", () => {
    expect(fmt("Guest lessons left: {n}", { n: 2 })).toBe("Guest lessons left: 2");
    expect(fmt("{a} and {b}", { a: "x" })).toBe("x and ");
  });

  it("uses translated strings for an added language and English for any gaps", () => {
    const d = resolveDict("de", { generate: "Lektion erstellen" });
    expect(d.generate).toBe("Lektion erstellen");
    expect(d.save).toBe(en.save);
    expect(resolveDict("el", { generate: "x" }).generate).toBe(builtinDicts.el.generate);
  });
});
