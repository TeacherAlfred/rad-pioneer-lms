import { NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { r2Client, BUCKET_NAME } from '@/lib/storage';
import { isAdmin } from '@/lib/require-admin';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { attachmentId } = await params;
  const supabase = supabaseAdmin();

  const { data: attachment } = await supabase.from('project_attachments').select('r2_key').eq('id', attachmentId).single();

  const { error } = await supabase.from('project_attachments').delete().eq('id', attachmentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (attachment?.r2_key) {
    await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.r2_key }));
  }

  return NextResponse.json({ ok: true });
}
