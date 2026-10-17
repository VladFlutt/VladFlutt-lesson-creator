// Pure text helpers shared by the client and the server.

// Lenient comparison: case, punctuation, spacing and accents don't matter.
export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:«»"'()¿¡·…\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// First restricted word or phrase found in the theme as a whole word, so
// "war" blocks "the war" but not "software". Accents and case are ignored.
export function matchRestricted(theme: string, words: string[]): string | null {
  const t = ` ${normalize(theme)} `;
  for (const word of words) {
    const w = normalize(word || "");
    if (!w) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");
    if (re.test(t)) return word;
  }
  return null;
}

// Why a server key can't be used as the service-role key, or null if it looks right.
export function serviceKeyProblem(key: string | undefined, anonKey: string | undefined): string | null {
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is not set";
  if (key.startsWith("sb_publishable_") || key === anonKey) {
    return "SUPABASE_SERVICE_ROLE_KEY holds the publishable key; use the secret key (sb_secret_…) instead";
  }
  return null;
}
