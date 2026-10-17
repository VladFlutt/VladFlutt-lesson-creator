import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase-server";
import { loadCatalog, getUi } from "@/lib/catalog";
import { loadOwnLesson } from "@/lib/access";
import { instrumentNames } from "@/lib/names";
import { LessonView } from "@/components/LessonView";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login");
  const lesson = await loadOwnLesson(id, viewer);
  if (!lesson) notFound();
  const catalog = await loadCatalog(true);
  const ui = await getUi(catalog.languages);
  return <LessonView lesson={lesson} mode="owner" names={instrumentNames(catalog.instruments, ui.code)} />;
}
