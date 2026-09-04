import { NextResponse } from 'next/server';
import { PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, BUCKET_NAME } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BACKUP_PREFIX = 'irene-fitness-backups/';
const TABLES = [
  'irene_fitness_families',
  'irene_fitness_responses',
  'irene_fitness_children',
  'irene_fitness_response_story',
  'irene_fitness_votes',
  'irene_fitness_voting_settings',
  'irene_fitness_faq_items',
] as const;

function backupKey(date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-'); // colon-free, safe as both an R2 key and a filename
  return `${BACKUP_PREFIX}${stamp}.json`;
}

// On-demand only, no schedule - triggered by "Back Up Now" on the Settings
// page. One JSON snapshot of every Irene Fitness table, uploaded to the
// same private R2 bucket already used for library/project storage
// (src/lib/storage.ts) under its own key prefix - no new bucket or
// credentials. Deliberately backup-only: restoring from one of these is a
// manual process (download the JSON, someone writes/reviews the actual
// restore when it's genuinely needed), not a one-click overwrite of live
// data - that's a meaningfully more dangerous action than this button.
// No isAdmin() check here: this route already lives under /admin/api/,
// which src/middleware.ts gates on its own, same as every other route in
// this project's admin API.
export async function POST() {
  const supabase = supabaseAdmin();

  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*');
      return { table, data, error };
    })
  );
  const failed = results.find((r) => r.error);
  if (failed) return NextResponse.json({ error: `${failed.table}: ${failed.error!.message}` }, { status: 500 });

  const now = new Date();
  const row_counts = Object.fromEntries(results.map((r) => [r.table, (r.data || []).length]));
  const payload = {
    backed_up_at: now.toISOString(),
    row_counts,
    tables: Object.fromEntries(results.map((r) => [r.table, r.data || []])),
  };

  const key = backupKey(now);
  const body = Buffer.from(JSON.stringify(payload, null, 2));
  await r2Client.send(
    new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: body, ContentType: 'application/json' })
  );

  return NextResponse.json({ ok: true, key, created_at: now.toISOString(), size_bytes: body.length, row_counts });
}

// Lists past backups, newest first, each with a short-lived presigned
// download link - the bucket is private, so there's no public URL to hand
// back directly.
export async function GET() {
  const list = await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: BACKUP_PREFIX }));
  const objects = (list.Contents || []).filter((o) => o.Key && o.Key !== BACKUP_PREFIX);

  const items = await Promise.all(
    objects.map(async (o) => ({
      key: o.Key!,
      size_bytes: o.Size || 0,
      created_at: o.LastModified ? o.LastModified.toISOString() : null,
      download_url: await getSignedUrl(r2Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: o.Key! }), {
        expiresIn: 600,
      }),
    }))
  );
  items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return NextResponse.json({ items });
}
