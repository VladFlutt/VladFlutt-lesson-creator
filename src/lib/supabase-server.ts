import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Session-aware client bound to the request cookies (acts as the signed-in user).
export async function supabaseAuth() {
  const store = await cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

// Service-role client. Server only; bypasses RLS.
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "vladimir.sadikovv@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: User | null): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

export type Viewer = {
  user: User | null;
  isAdmin: boolean;
  blocked: boolean;
};

export async function getViewer(): Promise<Viewer> {
  const sb = await supabaseAuth();
  const { data } = await sb.auth.getUser();
  const user = data.user ?? null;
  let blocked = false;
  if (user) {
    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    blocked = profile?.status === "blocked";
  }
  return { user, isAdmin: isAdminUser(user), blocked };
}
