// One-off export of all session_reviews (student kiosk reviews) with student
// name and event/programme name joined in, for a report requested outside
// the app. Prints JSON to stdout; no writes.
//
// Usage: node scripts/export-session-reviews.mjs > out.json

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('session_reviews')
  .select(
    '*, kids(id, name), sessions(id, starts_at, programme_id, programs(id, code, name))'
  )
  .order('submitted_at', { ascending: false });

if (error) {
  console.error('Query failed:', error);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
