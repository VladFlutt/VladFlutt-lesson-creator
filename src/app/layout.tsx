import type { Metadata } from "next";
import "./globals.css";
import { loadCatalog, getUi } from "@/lib/catalog";
import { getViewer } from "@/lib/supabase-server";
import { UiProvider } from "@/components/UiProvider";
import { Header } from "@/components/Header";
import { Heartbeat } from "@/components/Heartbeat";

export const metadata: Metadata = {
  title: "LessonCreator",
  description: "Methodical lesson builder for private language tutors",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ languages }, viewer] = await Promise.all([loadCatalog(), getViewer()]);
  const ui = await getUi(languages);
  const uiLanguages = languages.map((l) => ({
    code: l.code,
    name: l.name,
    ui_label: l.ui_label,
    tts_lang: l.tts_lang,
    is_guest_default: l.is_guest_default,
  }));

  return (
    <html lang={ui.code}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <UiProvider value={{ dict: ui.dict, code: ui.code, languages: uiLanguages, signedIn: !!viewer.user }}>
          <Header email={viewer.user?.email ?? null} isAdmin={viewer.isAdmin} />
          {viewer.user && <Heartbeat />}
          <main>
            <div className="container">{children}</div>
          </main>
        </UiProvider>
      </body>
    </html>
  );
}
