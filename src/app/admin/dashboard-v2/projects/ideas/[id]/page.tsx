"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { ChecklistEditor, ChecklistItem } from "../../_components/ChecklistEditor";
import { AttachmentsPanel, Attachment } from "../../_components/AttachmentsPanel";

type Project = {
  id: string;
  name: string;
  description: string | null;
};

export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [description, setDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetch(`/admin/api/dashboard-v2/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProject(data.project);
        setDescription(data.project?.description || "");
        setChecklist(data.checklist || []);
        setAttachments(data.attachments || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveDescription() {
    setSavingDescription(true);
    try {
      await fetch(`/admin/api/dashboard-v2/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
    } finally {
      setSavingDescription(false);
    }
  }

  async function convertToProject() {
    if (converting) return;
    setConverting(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/admin/dashboard-v2/projects/${id}`);
    } finally {
      setConverting(false);
    }
  }

  async function deleteIdea() {
    if (!confirm(`Delete idea "${project?.name}"? This can't be undone.`)) return;
    await fetch(`/admin/api/dashboard-v2/projects/${id}`, { method: "DELETE" });
    router.push("/admin/dashboard-v2/projects");
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <DashboardV2Nav />

        <div>
          <Link
            href="/admin/dashboard-v2/projects"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={deleteIdea}
                className="p-2.5 rounded-xl text-stone-400 hover:text-rose-500 hover:bg-white border border-transparent hover:border-stone-200"
                title="Delete idea"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={convertToProject}
                disabled={converting}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                <ArrowUpRight size={14} />
                Convert to Project
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3">Notes</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Jot down the idea, and keep building on it over time..."
            rows={8}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          {savingDescription && <p className="text-[10px] text-stone-400 mt-1">Saving...</p>}
        </div>

        <ChecklistEditor projectId={id} items={checklist} onChange={setChecklist} />
        <AttachmentsPanel projectId={id} attachments={attachments} onChange={setAttachments} />
      </div>
    </div>
  );
}
