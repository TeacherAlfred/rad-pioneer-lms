"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";
import { ChecklistEditor, ChecklistItem } from "../_components/ChecklistEditor";
import { AttachmentsPanel, Attachment } from "../_components/AttachmentsPanel";
import { LockBanner, ProjectLockState } from "../_components/LockBanner";

type Project = {
  id: string;
  name: string;
  description: string | null;
  category: "private" | "public";
  status: "draft" | "uat" | "live";
  locked: boolean;
  lock_branch_name: string | null;
  lock_risk_notes: string | null;
  locked_at: string | null;
};

// Generic active-project dashboard, used only when the project has no
// bespoke sub-app (href) built for it yet - once one exists (like Irene
// Fitness), the Projects hub links straight to it instead of here.
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [description, setDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

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

  async function updateField(field: "category" | "status", value: string) {
    setProject((p) => (p ? { ...p, [field]: value } : p));
    await fetch(`/admin/api/dashboard-v2/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{project.name}</h1>
        </div>

        <LockBanner
          projectId={id}
          state={{ locked: project.locked, lock_branch_name: project.lock_branch_name, lock_risk_notes: project.lock_risk_notes, locked_at: project.locked_at }}
          onChange={(state: ProjectLockState) => setProject((p) => (p ? { ...p, ...state } : p))}
        />

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6 flex flex-col sm:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Category</label>
            <div className="flex gap-2">
              {(["private", "public"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => updateField("category", c)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    project.category === c ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Status</label>
            <div className="flex gap-2">
              {(["draft", "uat", "live"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateField("status", s)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    project.status === s ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3">Description</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={6}
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
