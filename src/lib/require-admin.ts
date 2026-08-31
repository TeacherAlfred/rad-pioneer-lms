import { createClient } from "@/utils/supabase/server";

// Same check as src/app/projects/(private)/layout.tsx, duplicated here because
// API routes aren't covered by that page-level layout gate. Keep both in sync
// if this ID ever changes.
const ADMIN_ID = "adfefd6c-954c-4e13-9423-5519aa89980a";

/**
 * Returns true if the current request is authenticated as the admin user.
 * Use in API routes, which aren't covered by the (private) layout's auth gate.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.id === ADMIN_ID;
}
