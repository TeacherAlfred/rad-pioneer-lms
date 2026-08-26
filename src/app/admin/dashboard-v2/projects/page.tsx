"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, GraduationCap, Eye, Bell, Gift, MessageCircle, Mail, ArrowRight } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { LightStatTile } from "../_components/LightStatTile";

type IreneFitnessSummary = {
  total_responses: number;
  total_children: number;
  consent_public_display: number;
  consent_updates: number;
  consent_marketing: number;
  whatsapp_provided: number;
  email_provided: number;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ireneFitness, setIreneFitness] = useState<IreneFitnessSummary | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects")
      .then((r) => r.json())
      .then((data) => setIreneFitness(data.irene_fitness?.summary || null))
      .finally(() => setLoading(false));
  }, []);

  function viewDetail(filter: string) {
    router.push(`/admin/dashboard-v2/projects/irene-fitness?filter=${filter}`);
  }

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
            Per-project summaries, outside the main lead funnel. More projects will land here over time.
          </p>
        </header>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">
              Irene Primary Fitness Community
            </h2>
            <button
              onClick={() => viewDetail("all")}
              className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
            >
              View all responses <ArrowRight size={12} />
            </button>
          </div>
          {ireneFitness ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <LightStatTile onClick={() => viewDetail("all")} label="Total Responses" value={ireneFitness.total_responses} icon={Users} color="text-blue-600" />
              <LightStatTile onClick={() => viewDetail("all")} label="Children Registered" value={ireneFitness.total_children} icon={GraduationCap} color="text-violet-600" />
              <LightStatTile onClick={() => viewDetail("public_display")} label="Public Display Consent" value={ireneFitness.consent_public_display} icon={Eye} color="text-emerald-600" />
              <LightStatTile onClick={() => viewDetail("updates")} label="Community Updates Opt-in" value={ireneFitness.consent_updates} icon={Bell} color="text-amber-600" />
              <LightStatTile onClick={() => viewDetail("marketing")} label="Marketing Guide Opt-in" value={ireneFitness.consent_marketing} icon={Gift} color="text-rose-600" />
              <LightStatTile onClick={() => viewDetail("whatsapp")} label="WhatsApp Provided" value={ireneFitness.whatsapp_provided} icon={MessageCircle} color="text-teal-600" />
              <LightStatTile onClick={() => viewDetail("email")} label="Email Provided" value={ireneFitness.email_provided} icon={Mail} color="text-slate-600" />
            </div>
          ) : (
            <p className="text-sm text-stone-400">Couldn&apos;t load Irene Fitness data.</p>
          )}
        </section>
      </div>
    </div>
  );
}
