import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client for the Code the Block workbook. Reuses rad-pioneer's
 * existing Supabase project (tables prefixed `ctb_`) via the service role
 * key, so this must never be imported from client components.
 */
export function getCtbSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
