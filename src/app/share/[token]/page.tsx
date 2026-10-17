import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog, getUi } from "@/lib/catalog";
import { instrumentNames } from "@/lib/names";
import { LessonView } from "@/components/LessonView";
import type { LessonRow } from "@/lib/lesson";

// Student view: no tutor notes, answer key, regenerate or comments.
export default async function SharedLesson({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{24}$/.test(token)) notFound();
  const { data } = await supabaseAdmin().from("lessons").select("*").eq("share_token", token).maybeSingle();
  if (!data) notFound();
  const lesson = { ...(data as LessonRow), comments: null };
  const catalog = await loadCatalog(true);
  const ui = await getUi(catalog.languages);
  return <LessonView lesson={lesson} mode="student" names={instrumentNames(catalog.instruments, ui.code)} />;
}
