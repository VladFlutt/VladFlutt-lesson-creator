"use client";
import { useRouter } from "next/navigation";
import { useUi } from "./UiProvider";

export function DeleteLessonButton({ id }: { id: string }) {
  const { dict } = useUi();
  const router = useRouter();
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        if (!confirm(dict.confirmDelete)) return;
        await fetch(`/api/lessons/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      {dict.delete}
    </button>
  );
}
