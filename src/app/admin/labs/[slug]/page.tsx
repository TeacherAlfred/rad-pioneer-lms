'use client';

import { useParams } from 'next/navigation';
import { LabEditor } from '@/components/admin/labs/LabEditor';

export default function AdminLabEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  return <LabEditor slug={slug} />;
}
