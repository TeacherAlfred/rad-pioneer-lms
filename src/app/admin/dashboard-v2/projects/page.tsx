"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, FolderKanban, Lightbulb, Lock, Plus } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";

type Idea = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  checklist: { done: number; total: number } | null;
};

type Project = {
  id: string;
  key: string;
  name: string;
  category: "private" | "public";
  status: "draft" | "uat" | "live";
  href: string | null;
  locked: boolean;
  teaser_label: string | null;
  teaser_value: number | null;
  checklist: { done: number; total: number } | null;
};

const STATUS_ORDER = ["live", "uat", "draft"] as const;
const STATUS_LABEL: Record<string, string> = { draft: "Draft", uat: "UAT", live: "Live" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-stone-100 text-stone-500",
  uat: "bg-amber-100 text-amber-700",
  live: "bg-emerald-100 text-emerald-700",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newIdeaName, setNewIdeaName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/admin/api/dashboard-v2/projects");
    const data = await res.json();
    setIdeas(data.ideas || []);
    setProjects(data.projects || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createIdea() {
    const name = newIdeaName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNewIdeaName("");
      router.push(`/admin/dashboard-v2/projects/ideas/${json.project.id}`);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  const byCategory: Record<string, Project[]> = { public: [], private: [] };
  for (const p of projects) byCategory[p.category].push(p);

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        <DashboardV2Nav />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Projects</h1>
          <p className="text-stone-500 text-sm mt-1">
            Ideas you&apos;re building on, and standalone initiatives outside the main lead funnel.
          </p>
        </header>

        {/* Ideas */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-amber-500" />
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">Ideas</h2>
          </div>

          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-2 mb-4 flex gap-2">
            <input
              value={newIdeaName}
              onChange={(e) => setNewIdeaName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createIdea()}
              placeholder="Jot down a new project idea..."
              className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none"
            />
            <button
              onClick={createIdea}
              disabled={creating || !newIdeaName.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 shrink-0"
            >
              <Plus size={13} />
              Add Idea
            </button>
          </div>

          {ideas.length === 0 ? (
            <p className="text-sm text-stone-400 px-2">No ideas yet — jot one down above.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ideas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => router.push(`/admin/dashboard-v2/projects/ideas/${idea.id}`)}
                  className="text-left bg-white border border-stone-200 hover:border-amber-300 p-5 rounded-[20px] shadow-sm transition-colors"
                >
                  <h3 className="font-black text-sm tracking-tight truncate">{idea.name}</h3>
                  {idea.description && <p className="text-xs text-stone-400 mt-1 line-clamp-2">{idea.description}</p>}
                  {idea.checklist && idea.checklist.total > 0 && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-2">
                      {idea.checklist.done}/{idea.checklist.total} checklist
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Projects, grouped by category then status */}
        {(["public", "private"] as const).map((category) => (
          <section key={category}>
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban size={16} className="text-blue-600" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">
                {category === "public" ? "Public Projects" : "Private Projects"}
              </h2>
            </div>

            {byCategory[category].length === 0 ? (
              <p className="text-sm text-stone-400 px-2">None yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {byCategory[category]
                  .slice()
                  .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
                  .map((p) => (
                    <button
                      key={p.key}
                      onClick={() => router.push(p.href || `/admin/dashboard-v2/projects/${p.id}`)}
                      className="text-left bg-white border border-stone-200 hover:border-blue-300 p-6 rounded-[24px] shadow-sm transition-colors flex flex-col justify-between gap-8"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-2xl bg-stone-50 text-blue-600">
                          <FolderKanban size={22} />
                        </div>
                        <div className="flex items-center gap-2">
                          {p.locked && <Lock size={13} className="text-rose-500" />}
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${STATUS_COLOR[p.status]}`}>
                            {STATUS_LABEL[p.status]}
                          </span>
                          <ArrowRight size={16} className="text-stone-300" />
                        </div>
                      </div>
                      <div>
                        <h2 className="font-black text-lg tracking-tight">{p.name}</h2>
                        {p.teaser_label && (
                          <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mt-1">
                            {p.teaser_value} {p.teaser_label}
                          </p>
                        )}
                        {!p.teaser_label && p.checklist && p.checklist.total > 0 && (
                          <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mt-1">
                            {p.checklist.done}/{p.checklist.total} checklist
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
