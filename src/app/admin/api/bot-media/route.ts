import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lives under /admin so src/middleware.ts's existing auth guard (only the
// site owner gets past /admin/*) protects this route automatically.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'bot-media';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bot_media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

// Creates a new media item. Either upload a file (multipart, stored in the
// bot-media bucket) or supply file_url directly (e.g. an existing R2 link) -
// no need to re-upload something that's already hosted somewhere public.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title = String(form.get('title') || '').trim();
    const caption = String(form.get('caption') || '').trim();
    const keywordsRaw = String(form.get('trigger_keywords') || '');
    const trigger_keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
    const tag_filter = String(form.get('tag_filter') || '').trim() || null;
    const buttonsRaw = String(form.get('buttons') || '[]');
    let buttons: any[] = [];
    try { buttons = JSON.parse(buttonsRaw); } catch { buttons = []; }

    if (!title || !caption || trigger_keywords.length === 0) {
      return NextResponse.json({ error: 'title, caption, and at least one trigger keyword are required' }, { status: 400 });
    }

    let file_url = String(form.get('file_url') || '').trim();
    let filename = String(form.get('filename') || '').trim();
    const file = form.get('file') as File | null;

    if (file && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
      });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      file_url = pub.publicUrl;
      filename = filename || file.name;
    }

    if (!file_url) {
      return NextResponse.json({ error: 'Provide a file to upload or a file_url' }, { status: 400 });
    }
    if (!filename) filename = file_url.split('/').pop() || 'file';

    const { data, error } = await supabaseAdmin
      .from('bot_media')
      .insert([{
        key: String(form.get('key') || '').trim() || null,
        title, caption, trigger_keywords, tag_filter, buttons,
        file_url, filename,
        file_type: String(form.get('file_type') || 'document'),
        active: true,
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Field edits only - swap the file by adding a new entry and deactivating
// the old one rather than replacing in place.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed = ['key', 'title', 'trigger_keywords', 'tag_filter', 'caption', 'buttons', 'active', 'archived', 'file_url', 'filename'];
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key];
    }

    const { data, error } = await supabaseAdmin
      .from('bot_media')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('bot_media').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
