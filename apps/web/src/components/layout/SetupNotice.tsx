import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Developer hint shown only when the Supabase environment variables are missing. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
      <div className="rounded-2xl border border-[#e9cf86] bg-[#fff8e6] px-4 py-3 text-sm text-[#5c4300] dark:border-[#5a4718] dark:bg-[#2a2212] dark:text-[#f0d27a]">
        <strong>Supabase non configuré.</strong> Copiez <code>apps/web/.env.example</code> vers <code>apps/web/.env.local</code>,
        renseignez l&apos;URL et la clé anon, puis appliquez les migrations (<code>supabase db push</code>) et le seed. Voir README.
      </div>
    </div>
  );
}
