"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, AlertTriangle, Camera } from "lucide-react";
import { DIFFICULTY_OPTIONS, COMPLETION_OPTIONS, WANTS_MORE_OPTIONS, ENJOYMENT_FACES } from "@/lib/sessionReview";

type Report = {
  session: { id: string; starts_at: string | null; programs: { code: string; name: string } | null };
  counts: { booked: number; present: number; marked: number; reviewed: number };
  rating: { value: number | null; responseCount: number; rosterSize: number; responseRate: number; confidence: 'low' | 'normal' };
  distributions: {
    enjoyment: Record<string, number>; difficulty: Record<string, number>;
    completion: Record<string, number>; wantsMore: Record<string, number>;
  };
  roster: { kidId: string; kidName: string; review: any }[];
  quoteHarvest: { kidId: string; kidName: string; builtText: string | null; openText: string | null; quoteConsent: boolean }[];
  followUps: { held: { reviewId: string; kidName: string }[]; pendingPhotoConsent: { kidId: string; kidName: string }[] };
};

function fmtDate(iso: string | null) {
  if (!iso) return 'No date set';
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' });
}

function DistributionBar({ label, counts, order }: { label: string; counts: Record<string, number>; order: string[] }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-1.5">
        {order.map(opt => {
          const n = counts[opt] || 0;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div key={opt} className="flex items-center gap-2">
              <span className="text-[12px] text-slate-500 w-28 shrink-0 truncate">{opt}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[12px] text-slate-400 w-6 text-right shrink-0">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SessionReportPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/admin/api/session-reports?sessionId=${sessionId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setReport(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;
  if (error || !report) return <div className="min-h-screen flex items-center justify-center text-rose-500 text-sm">{error || 'Not found'}</div>;

  const enjoymentOrder = ENJOYMENT_FACES.map(f => String(f.value));
  const enjoymentCounts: Record<string, number> = {};
  for (const f of ENJOYMENT_FACES) enjoymentCounts[String(f.value)] = report.distributions.enjoyment[f.value] || 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b border-slate-100 px-6 py-5">
        <Link href="/admin/sessions" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-2 w-fit">
          <ArrowLeft size={13} /> Back to sessions
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{report.session.programs?.name} - Session Report</h1>
        <p className="text-[13px] text-slate-400 mt-1">
          {report.session.programs?.code} · {fmtDate(report.session.starts_at)} · Booked {report.counts.booked} · Present {report.counts.present || '-'} · Reviewed {report.counts.reviewed}
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Session rating</p>
            {report.rating.value !== null ? (
              <p className="text-3xl font-semibold text-slate-900">
                {report.rating.value.toFixed(1)} <span className="text-amber-400">★</span>
                <span className="text-[14px] font-normal text-slate-400 ml-2">({report.rating.responseCount} of {report.rating.rosterSize})</span>
              </p>
            ) : (
              <p className="text-slate-400">No responses yet</p>
            )}
            {report.rating.confidence === 'low' && report.rating.value !== null && (
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low confidence - under 50% response</span>
            )}
          </div>
          <div className="text-right text-[12px] text-slate-400">
            <p>Wants more 40% · Enjoyment 30%</p>
            <p>Completion 20% · Difficulty fit 10%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <DistributionBar label="Enjoyment" counts={enjoymentCounts} order={enjoymentOrder} />
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Difficulty</p>
              <span className="text-[10px] text-slate-300">(shown as a spread, never averaged - a flat split looks like "just right" on paper and isn't)</span>
            </div>
            <DistributionBar label="" counts={report.distributions.difficulty} order={DIFFICULTY_OPTIONS} />
          </div>
          <DistributionBar label="Completion" counts={report.distributions.completion} order={COMPLETION_OPTIONS} />
          <DistributionBar label="Wants more" counts={report.distributions.wantsMore} order={WANTS_MORE_OPTIONS} />
        </div>

        {(report.followUps.held.length > 0 || report.followUps.pendingPhotoConsent.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-amber-700 flex items-center gap-1.5"><AlertTriangle size={14} /> Follow-up actions</h3>
            {report.followUps.held.length > 0 && (
              <div>
                <p className="text-[12px] text-amber-700 mb-1">{report.followUps.held.length} review{report.followUps.held.length === 1 ? '' : 's'} held for review:</p>
                <p className="text-[12px] text-amber-600">{report.followUps.held.map(h => h.kidName).join(', ')} - <Link href="/admin/reviews" className="underline">go to Reviews</Link></p>
              </div>
            )}
            {report.followUps.pendingPhotoConsent.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Camera size={13} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[12px] text-amber-600">{report.followUps.pendingPhotoConsent.length} child{report.followUps.pendingPhotoConsent.length === 1 ? '' : 'ren'} with no photo consent on file yet: {report.followUps.pendingPhotoConsent.map(p => p.kidName).join(', ')}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide mb-4">Quote harvest</h3>
          {report.quoteHarvest.length === 0 ? (
            <p className="text-[13px] text-slate-400">No free-text answers yet.</p>
          ) : (
            <div className="space-y-3">
              {report.quoteHarvest.map(q => (
                <div key={q.kidId} className="border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[13px] font-medium text-slate-700">{q.kidName}</span>
                    {q.quoteConsent ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600"><ShieldCheck size={11} /> Quote consent on file</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-rose-500"><ShieldAlert size={11} /> No quote consent</span>
                    )}
                  </div>
                  {q.builtText && <p className="text-[13px] text-slate-600 italic">"{q.builtText}"</p>}
                  {q.openText && <p className="text-[12px] text-slate-400 mt-0.5">{q.openText}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
