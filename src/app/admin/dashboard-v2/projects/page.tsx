"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, FolderKanban } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";

type ProjectCard = {
  key: string;
  name: string;
  href: string;
  teaser_label: string | null;
  teaser_value: number | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCard[]>([]);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <DashboardV2Nav />

        <header>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Projects</h1>
          <p className="text-stone-500 text-sm mt-1">
            Standalone initiatives outside the main lead funnel, each with its own dashboard.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <button
              key={p.key}
              onClick={() => router.push(p.href)}
              className="text-left bg-white border border-stone-200 hover:border-blue-300 p-6 rounded-[24px] shadow-sm transition-colors flex flex-col justify-between gap-8"
            >
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-2xl bg-stone-50 text-blue-600">
                  <FolderKanban size={22} />
                </div>
                <ArrowRight size={16} className="text-stone-300" />
              </div>
              <div>
                <h2 className="font-black text-lg tracking-tight">{p.name}</h2>
                {p.teaser_label && (
                  <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mt-1">
                    {p.teaser_value} {p.teaser_label}
                  </p>
                )}
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-stone-400 col-span-full">No projects yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
