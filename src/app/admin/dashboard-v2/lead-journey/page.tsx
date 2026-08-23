"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, ChevronDown, CheckCircle2, XCircle, X, ClipboardCheck } from "lucide-react";
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
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null);

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

  // Both actions merge the server's response straight into local state
  // instead of refetching the whole board - a full refetch calls loadLeads(),
  // which sets loading=true and replaces the entire Kanban board with the
  // full-page spinner on every single click, which is the "screen locks"
  // behaviour being fixed here. The server response is still the source of
  // truth for what changed (e.g. whether a failed check also moved the lead
  // to lost) - the client isn't guessing at business logic, just applying it.
  async function handleMove(leadId: string, toStage: string) {
    setMovingId(leadId);
    setOpenMoveMenu(null);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/leads/${leadId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to move lead");
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, lifecycle_stage: json.lifecycle_stage, stage_entered_at: json.stage_entered_at } : l))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMovingId(null);
    }
  }

  async function handleQualify(leadId: string, stageKey: string, passed: boolean, detail?: string) {
    setQualifyingId(leadId);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/leads/${leadId}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_key: stageKey, passed, detail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save qualification check");
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const otherChecks = (l.qualification_checks || []).filter((c: any) => c.stage_key !== stageKey);
          const nextTags = json.taggedYoungAdult && !(l.tags || []).some((t: string) => t.toLowerCase() === "young adult track")
            ? [...(l.tags || []), "Young Adult Track"]
            : l.tags;
          return {
            ...l,
            qualification_checks: [...otherChecks, json.check],
            tags: nextTags,
            ...(json.movedToLost ? { lifecycle_stage: "lost", stage_entered_at: json.stage_entered_at } : {}),
          };
        })
      );
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

                    // Opted-out is a POPIA-respect exit, not just another
                    // stage - no contact link, no qualification prompts, no
                    // move menu, nothing that invites further action. Name
                    // only, so the column is still an accurate count without
                    // surfacing detail about someone who asked to be left alone.
                    if (lead.lifecycle_stage === "opted_out") {
                      return (
                        <div key={lead.id} className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
                          <p className="font-bold text-sm text-stone-500 leading-tight">{lead.name || "Unnamed"}</p>
                        </div>
                      );
                    }

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
                          const sequenceBroken = !qualified && !pending;
                          const pendingStage = pending ? QUALIFICATION_STAGES.find((s) => s.key === pending) : null;
                          const failedCheck = sequenceBroken ? checks.find((c: any) => !c.passed) : null;
                          const isTooOld = failedCheck?.detail === "too_old";

                          // Answered stages no longer render their buttons inline once
                          // decided - they just take up card space with no further
                          // purpose. One compact row opens the full breakdown (and, if
                          // still applicable, the next question to answer) in a modal.
                          return (
                            <button
                              onClick={() => setViewingLeadId(lead.id)}
                              className="w-full flex items-center justify-between gap-2 mb-3 px-2.5 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-100 rounded-lg transition-colors text-left"
                            >
                              <span
                                className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest truncate ${
                                  qualified ? "text-emerald-600" : isTooOld ? "text-amber-600" : sequenceBroken ? "text-rose-500" : "text-stone-500"
                                }`}
                              >
                                {qualified ? (
                                  <><CheckCircle2 size={12} className="shrink-0" /> Qualified</>
                                ) : isTooOld ? (
                                  <><ClipboardCheck size={12} className="shrink-0" /> Too Old · Young Adult Track</>
                                ) : sequenceBroken ? (
                                  <><XCircle size={12} className="shrink-0" /> Not qualified</>
                                ) : pendingStage ? (
                                  <><ClipboardCheck size={12} className="shrink-0" /> <span className="truncate">{pendingStage.question}</span></>
                                ) : (
                                  <><ClipboardCheck size={12} className="shrink-0" /> Not checked</>
                                )}
                              </span>
                              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest shrink-0">View</span>
                            </button>
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

      {viewingLeadId && (() => {
        const lead = leads.find((l) => l.id === viewingLeadId);
        if (!lead) return null;
        const checks = lead.qualification_checks || [];
        const qualified = isLeadQualified(checks);
        const pending = nextStageToCheck(checks);
        const sequenceBroken = !qualified && !pending;

        return (
          <div className="fixed inset-0 bg-stone-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
                <div>
                  <h3 className="text-[16px] font-semibold text-stone-900">{lead.name || "Unnamed"}</h3>
                  <p className="text-[13px] text-stone-400 mt-0.5">
                    {lead.phone ? `+${lead.phone} · ` : ""}{getSourceLane(lead.source)} · {daysAgo(lead.stage_entered_at)}d in stage
                  </p>
                </div>
                <button onClick={() => setViewingLeadId(null)} className="h-7 w-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 shrink-0"><X size={13} /></button>
              </div>

              <div className="px-6 pt-4 pb-5 space-y-2 overflow-y-auto">
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Qualification</label>
                {QUALIFICATION_STAGES.map((stage) => {
                  const check = checks.find((c: any) => c.stage_key === stage.key);
                  if (!check && stage.key !== pending) return null;
                  const answered = !!check;
                  // Uniform list of choices for this stage: pass, the standard
                  // fail, and (child_age_fits_program only) any extra fail-like
                  // options such as Too Old - each still records passed:false,
                  // just with its own detail so the specific reason survives.
                  const options = [
                    { label: stage.passLabel, passed: true, detail: undefined as string | undefined, tone: "emerald" as const },
                    { label: stage.failLabel, passed: false, detail: stage.failDetail, tone: "rose" as const },
                    ...(stage.extraFailOptions || []).map((o) => ({ label: o.label, passed: false, detail: o.detail as string | undefined, tone: "amber" as const })),
                  ];
                  return (
                    <div key={stage.key} className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                      <p className="text-[10px] font-bold text-stone-500 mb-1.5">{stage.question}</p>
                      <div className="flex gap-1.5">
                        {options.map((opt) => {
                          const isMatch = answered && check.passed === opt.passed && (check.detail || undefined) === opt.detail;
                          const toneClasses = opt.tone === "emerald" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : opt.tone === "amber" ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-200";
                          const matchClasses = opt.tone === "emerald" ? "bg-emerald-500 text-white" : opt.tone === "amber" ? "bg-amber-500 text-white" : "bg-rose-500 text-white";
                          return (
                            <button
                              key={opt.label}
                              disabled={qualifyingId === lead.id}
                              onClick={() => handleQualify(lead.id, stage.key, opt.passed, opt.detail)}
                              className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                                isMatch ? matchClasses : answered ? "bg-stone-100 text-stone-300" : toneClasses
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {qualified && (
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-600 pt-1">
                    <CheckCircle2 size={13} /> Qualified
                  </div>
                )}
                {sequenceBroken && (() => {
                  const failedCheck = checks.find((c: any) => !c.passed);
                  if (failedCheck?.detail === "too_old") {
                    return (
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-amber-600 pt-1">
                        <ClipboardCheck size={13} /> Too Old · Young Adult Track
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-rose-500 pt-1">
                      <XCircle size={13} /> Not qualified
                    </div>
                  );
                })()}
              </div>

              <div className="shrink-0 border-t border-stone-100 px-6 py-4">
                <button onClick={() => setViewingLeadId(null)} className="w-full py-2.5 rounded-xl text-[14px] font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors duration-150">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
