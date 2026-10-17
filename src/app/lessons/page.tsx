import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, supabaseAdmin } from "@/lib/supabase-server";
import { loadCatalog, getUi } from "@/lib/catalog";
import { DeleteLessonButton } from "@/components/DeleteLessonButton";

export default async function MyLessons() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login");
  const { languages } = await loadCatalog(true);
  const { dict } = await getUi(languages);
  const { data: lessons } = await supabaseAdmin()
    .from("lessons")
    .select("id, theme, level, duration, language_code, created_at, content->title")
    .eq("user_id", viewer.user.id)
    .eq("saved", true)
    .order("created_at", { ascending: false });

  return (
    <div className="card">
      <h1>{dict.myLessons}</h1>
      {!lessons?.length ? (
        <p className="muted">{dict.noLessons}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/lessons/${l.id}`}><b>{String(l.title || l.theme)}</b></Link>
                    <div className="small muted">{l.theme}</div>
                  </td>
                  <td>{languages.find((x) => x.code === l.language_code)?.ui_label || l.language_code}</td>
                  <td>{l.level}</td>
                  <td>{l.duration} {dict.minutes}</td>
                  <td className="small muted">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td><DeleteLessonButton id={l.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
