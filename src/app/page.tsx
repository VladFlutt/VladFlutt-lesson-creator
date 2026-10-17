import { loadCatalog, getUi, getSettings, instrumentName } from "@/lib/catalog";
import { getViewer } from "@/lib/supabase-server";
import { checkQuota } from "@/lib/usage";
import { guestIdFromCookie } from "@/lib/access";
import { Generator } from "@/components/Generator";
import { headers } from "next/headers";
import { ipHash } from "@/lib/usage";

export default async function Home() {
  const [catalog, viewer, settings] = await Promise.all([loadCatalog(), getViewer(), getSettings()]);
  const ui = await getUi(catalog.languages);
  const languages = viewer.user ? catalog.languages : catalog.languages.filter((l) => l.is_guest_default);

  let guestRemaining: number | null = null;
  if (!viewer.user) {
    const h = await headers();
    const quota = await checkQuota(viewer, await guestIdFromCookie(), ipHash(h));
    guestRemaining = quota.ok ? quota.remaining : 0;
  }

  return (
    <Generator
      languages={languages.map((l) => ({ code: l.code, label: `${l.native_name} (${l.ui_label})` }))}
      levels={catalog.levels.map((l) => ({ code: l.code, label: l.code }))}
      durations={catalog.durations.map((d) => d.minutes)}
      instruments={catalog.instruments.map((i) => ({
        key: i.key,
        label: instrumentName(i, ui.code),
        description: i.description,
        default_on: i.default_on,
      }))}
      guestRemaining={guestRemaining}
      guestLimit={settings.guest_limit ?? 3}
      signedIn={!!viewer.user}
      blocked={viewer.blocked}
    />
  );
}
