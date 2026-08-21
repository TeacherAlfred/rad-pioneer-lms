"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { DashboardV2Nav } from "../_components/DashboardV2Nav";
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS, VALID_STAGE_TRANSITIONS } from "@/lib/funnelStages";
import { getSourceLane, SourceLane } from "@/lib/leadSourceLane";
import { QUALIFICATION_STAGES, isLeadQualified, nextStageToCheck } from "@/lib/leadQualification";

const LANE_OPTIONS: (SourceLane | "All")[] = ["All", "Meta", "Irene", "Warm List", "Organic", "Unknown"];
const HEALTH_OPTIONS = ["All", "active", "stalled", "dormant"];

const HEALTH_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  stalled: "bg-amber-100 text-amber-700",
  dormant: "bg-stone-200 text-stone-600",
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function LeadJourneyPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [laneFilter, setLaneFilter] = useState<(SourceLane | "All")>("All");
  const [healthFilter, setHealthFilter] = useState("All");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [openMoveMenu, setOpenMoveMenu] = useState<string | null>(null);
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const res = await fetch("/admin/api/dashboard-v2/leads");
    const { leads: data } = await res.json();
    setLeads(data || []);
    setLoading(false);
  }

  async function handleMove(leadId: string, toStage: string) {
    setMovingId(leadId);
    setOpenMoveMenu(null);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/leads/${leadId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to move lead");
      }
      await loadLeads();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMovingId(null);
    }
  }

  async function handleQualify(leadId: string, stageKey: string, passed: boolean) {
    setQualifyingId(leadId);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/leads/${leadId}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_key: stageKey, passed }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save qualification check");
      }
      await loadLeads();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setQualifyingId(null);
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (laneFilter !== "All" && getSourceLane(l.source) !== laneFilter) return false;
      if (healthFilter !== "All" && l.stage_health !== healthFilter) return false;
      return true;
    });
  }, [leads, laneFilter, healthFilter]);

  const columns = useMemo(() => {
    return LIFECYCLE_STAGES.map((stage) => ({
      stage,
      label: LIFECYCLE_STAGE_LABELS[stage],
      leads: filteredLeads.filter((l) => l.lifecycle_stage === stage),
    }));
  }, [filteredLeads]);

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <DashboardV2Nav />

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Lead Journey</h1>
            <p className="text-stone-500 text-sm mt-1">Where every lead actually is, and what to do about it.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={laneFilter} onChange={(e) => setLaneFilter(e.target.value as any)} className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm">
              {LANE_OPTIONS.map((l) => <option key={l} value={l}>{l === "All" ? "All Lanes" : l}</option>)}
            </select>
            <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm">
              {HEALTH_OPTIONS.map((h) => <option key={h} value={h}>{h === "All" ? "All Health" : h.charAt(0).toUpperCase() + h.slice(1)}</option>)}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-stone-300" size={32} /></div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6">
            {columns.map((col) => (
              <div key={col.stage} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-600">{col.label}</h3>
                  <span className="text-[10px] font-bold text-stone-400 bg-white border border-stone-200 rounded-full px-2 py-0.5">{col.leads.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {col.leads.map((lead) => {
                    const validNext = VALID_STAGE_TRANSITIONS[lead.lifecycle_stage] || [];
                    return (
                      <div key={lead.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm relative">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-bold text-sm text-stone-900 leading-tight pr-2">{lead.name || "Unnamed"}</p>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${HEALTH_COLOR[lead.stage_health] || "bg-stone-100 text-stone-500"}`}>
                            {lead.stage_health}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-stone-400 mb-3">
                          <span className="font-bold">{getSourceLane(lead.source)}</span>
                          <span>{daysAgo(lead.stage_entered_at)}d in stage</span>
                        </div>
                        {lead.phone && (
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] text-stone-500 hover:text-emerald-600 mb-3">
                            <Phone size={11} /> {lead.phone}
                          </a>
                        )}

                        {(() => {
                          const checks = lead.qualification_checks || [];
                          const qualified = isLeadQualified(checks);
                          const pending = nextStageToCheck(checks);
                          const failedStage = QUALIFICATION_STAGES.find((s) => checks.some((c: any) => c.stage_key === s.key && !c.passed));
                          return (
                            <div className="mb-3">
                              {qualified ? (
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600">
                                  <CheckCircle2 size={12} /> Qualified
                                </div>
                              ) : failedStage ? (
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-rose-500">
                                  <XCircle size={12} /> Not qualified: {failedStage.label}
                                </div>
                              ) : pending ? (
                                <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                                  <p className="text-[10px] font-bold text-stone-500 mb-1.5">{QUALIFICATION_STAGES.find((s) => s.key === pending)?.question}</p>
                                  <div className="flex gap-1.5">
                                    <button
                                      disabled={qualifyingId === lead.id}
                                      onClick={() => handleQualify(lead.id, pending, true)}
                                      className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-emerald-200 transition-colors disabled:opacity-50"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      disabled={qualifyingId === lead.id}
                                      onClick={() => handleQualify(lead.id, pending, false)}
                                      className="flex-1 py-1.5 bg-rose-100 text-rose-700 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-rose-200 transition-colors disabled:opacity-50"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {validNext.length > 0 && (
                          <div className="relative">
                            <button
                              onClick={() => setOpenMoveMenu(openMoveMenu === lead.id ? null : lead.id)}
                              disabled={movingId === lead.id}
                              className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-stone-600 transition-colors"
                            >
                              {movingId === lead.id ? "Moving…" : "Move to…"}
                              <ChevronDown size={12} />
                            </button>
                            {openMoveMenu === lead.id && (
                              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                                {validNext.map((stage) => (
                                  <button
                                    key={stage}
                                    onClick={() => handleMove(lead.id, stage)}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-stone-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                  >
                                    {LIFECYCLE_STAGE_LABELS[stage]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {col.leads.length === 0 && <p className="text-[10px] text-stone-300 italic px-1">No leads</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
