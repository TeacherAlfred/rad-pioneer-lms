import { createClient } from '@supabase/supabase-js';

// Shared service-role client for the new finance-v2 API routes - the tables
// they touch (leads, quotes, invoices, quote_line_items, invoice_payments,
// programs, sessions, email_templates) are all RLS-locked with zero anon
// policies, so every read/write against them must go through a server route
// using this client, never the browser `supabase` client directly.
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
