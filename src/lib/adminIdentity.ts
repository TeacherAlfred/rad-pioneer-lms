import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

// Best-effort "who did this" for admin audit columns (e.g. labs.updated_by).
// Access control itself is the /admin middleware allowlist - this never
// gates anything, it only labels the write.
export async function adminEmail(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerComponentClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
