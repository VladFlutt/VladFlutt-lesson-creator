import { describe, expect, it } from "vitest";
import { matchRestricted, normalize, serviceKeyProblem } from "@/lib/text";

describe("normalize", () => {
  it("ignores case, accents, punctuation and spacing", () => {
    expect(normalize("  Καλημέρα,   Μαρία! ")).toBe("καλημερα μαρια");
    expect(normalize("Ёлка — «да»?")).toBe(normalize("ёлка — да"));
    expect(normalize("Πού είσαι;")).toBe("που εισαι");
  });

  it("treats a typed answer without accents as correct", () => {
    expect(normalize("το σπίτι")).toBe(normalize("Το σπιτι."));
  });
});

describe("matchRestricted", () => {
  it("finds a whole restricted word", () => {
    expect(matchRestricted("The war in history", ["war"])).toBe("war");
  });

  it("does not match inside other words", () => {
    expect(matchRestricted("Buying software", ["war"])).toBeNull();
    expect(matchRestricted("A music class", ["ass"])).toBeNull();
  });

  it("ignores case and accents in Greek and Russian", () => {
    expect(matchRestricted("Ο ΠΟΛΕΜΟΣ σήμερα", ["πόλεμος"])).toBe("πόλεμος");
    expect(matchRestricted("Про Войну", ["войну"])).toBe("войну");
  });

  it("matches multi-word phrases and skips empty entries", () => {
    expect(matchRestricted("Talking about hard drugs today", ["", "hard drugs"])).toBe("hard drugs");
    expect(matchRestricted("At the market", ["", "  "])).toBeNull();
  });

  it("treats regex characters in words literally", () => {
    expect(matchRestricted("price (eur)", ["(eur)"])).toBe("(eur)");
    expect(matchRestricted("anything", ["a.*"])).toBeNull();
  });
});

describe("serviceKeyProblem", () => {
  it("accepts a secret key", () => {
    expect(serviceKeyProblem("sb_secret_abc", "sb_publishable_xyz")).toBeNull();
  });

  it("rejects a missing key, the publishable key and the anon key", () => {
    expect(serviceKeyProblem(undefined, "a")).toMatch(/not set/);
    expect(serviceKeyProblem("sb_publishable_xyz", "other")).toMatch(/publishable/);
    expect(serviceKeyProblem("eyJanon", "eyJanon")).toMatch(/publishable/);
  });
});
