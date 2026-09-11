"use client";

import { use } from "react";
import TutorialSeriesEditor from "@/components/admin/tutorials/TutorialSeriesEditor";

export default function TutorialSeriesEditorPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = use(params);
  return <TutorialSeriesEditor seriesId={seriesId} />;
}
