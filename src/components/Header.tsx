"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useUi } from "./UiProvider";

export function Header({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const { dict, code, languages } = useUi();
  const router = useRouter();

  const setLang = (c: string) => {
    document.cookie = `ui_lang=${c}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="logo">
          <span className="logo-mark" aria-hidden /> {dict.appName}
        </Link>
        <div className="lang-switch" role="group" aria-label={dict.interfaceLanguage}>
          {languages.map((l) => (
            <button key={l.code} className={l.code === code ? "active" : ""} onClick={() => setLang(l.code)} title={l.name}>
              {l.ui_label}
            </button>
          ))}
        </div>
        <nav className="nav">
          <Link href="/">{dict.generator}</Link>
          {email && <Link href="/lessons">{dict.myLessons}</Link>}
          {isAdmin && <Link href="/admin">{dict.admin}</Link>}
          {email ? (
            <button className="link" onClick={signOut} title={email}>
              {dict.signOut}
            </button>
          ) : (
            <Link href="/login">{dict.signIn}</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
