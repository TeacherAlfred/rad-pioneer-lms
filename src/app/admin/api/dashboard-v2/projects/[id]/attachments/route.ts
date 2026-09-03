import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

// Persists the row after the client has already uploaded the file via
// /api/storage/upload-project-attachment (which returns r2_key), or links
// an external URL directly - the two-step upload-then-persist mirrors the
// existing cover-image pattern (upload-cover -> updateBookCover).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const filename = (body.filename || '').trim();
  const r2Key = body.r2_key || null;
  const externalUrl = body.external_url || null;

  if (!filename || (!r2Key && !externalUrl) || (r2Key && externalUrl)) {
    return NextResponse.json({ error: 'Provide a filename and exactly one of r2_key or external_url' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('project_attachments')
    .insert({
      project_id: id,
      filename,
      content_type: body.content_type || null,
      size_bytes: body.size_bytes || null,
      r2_key: r2Key,
      external_url: externalUrl,
      uploaded_by: 'admin',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attachment: data });
}
