"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useUi } from "./UiProvider";

export function LoginForm({ initialMode }: { initialMode: "signin" | "signup" }) {
  const { dict } = useUi();
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = supabaseBrowser();
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/login` } });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setInfo(dict.checkEmail);
        setMode("signin");
      }
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  return (
    <form className="card" style={{ maxWidth: 440, margin: "0 auto" }} onSubmit={submit}>
      <h1>{mode === "signup" ? dict.signUp : dict.signIn}</h1>
      <label className="field" style={{ marginTop: 12 }}>
        {dict.email}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 12 }}>
        {dict.password}
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="error">{error}</div>}
      {info && <div className="notice">{info}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy}>
          {busy && <span className="spinner" />}
          {mode === "signup" ? dict.signUp : dict.signIn}
        </button>
        <span className="muted small">
          {mode === "signup" ? dict.haveAccount : dict.noAccount}{" "}
          <button type="button" className="link" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
            {mode === "signup" ? dict.signIn : dict.signUp}
          </button>
        </span>
      </div>
    </form>
  );
}
