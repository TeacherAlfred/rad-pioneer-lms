"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Baby, Users2, BookOpen, ShoppingBag, Search, X,
  MapPin, Globe, ExternalLink, ChevronRight, ChevronDown, MessageSquareQuote, Copy, Check, RotateCcw, Bell,
} from "lucide-react";
import { formatLabel } from "@/lib/programs";
import { ENJOYMENT_FACES } from "@/lib/sessionReview";

type ProgramRef = { id: string; code: string; name: string };
type Venue = { id: string; name: string; type: string; maps_url: string | null } | null;
type EnrolledKid = { id: string; name: string; status: string; attended: boolean | null };

type Session = {
  id: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  capacity: number | null;
  price: number | null;
  currency: string;
  programs: ProgramRef | null;
  venues: Venue;
  enrolment_count: number;
  enrolled_kids: EnrolledKid[];
};

type Enrolment = {
  id: string;
  status: string;
  attended: boolean | null;
  kids: { id: string; name: string; phone: string | null } | null;
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
}

const BUCKET_ORDER = ['Today', 'Tomorrow', 'This Week', 'Later', 'No Date Set', 'Past'];

function bucketFor(startsAt: string | null): string {
  if (!startsAt) return 'No Date Set';
  const d = new Date(startsAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfter = new Date(startOfTomorrow); startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);
  const startOfWeekEnd = new Date(startOfToday); startOfWeekEnd.setDate(startOfWeekEnd.getDate() + 7);
  if (d < startOfToday) return 'Past';
  if (d < startOfTomorrow) return 'Today';
  if (d < startOfDayAfter) return 'Tomorrow';
  if (d < startOfWeekEnd) return 'This Week';
  return 'Later';
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPastAndCancelled, setShowPastAndCancelled] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/sessions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
      setSessions(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = sessions.filter(s => {
      if (!showPastAndCancelled && s.status === 'cancelled') return false;
      if (!showPastAndCancelled && bucketFor(s.starts_at) === 'Past') return false;
      if (q && !`${s.programs?.code || ''} ${s.programs?.name || ''} ${s.venues?.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const buckets = new Map<string, Session[]>();
    for (const s of filtered) {
      const key = bucketFor(s.starts_at);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(s);
    }
    return BUCKET_ORDER.filter(b => buckets.has(b)).map(b => ({ label: b, sessions: buckets.get(b)! }));
  }, [sessions, search, showPastAndCancelled]);

  // --- Roster slide-over ---
  const [panelSession, setPanelSession] = useState<Session | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [rosterEnrolments, setRosterEnrolments] = useState<Enrolment[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  async function openPanel(s: Session) {
    setPanelSession(s);
    requestAnimationFrame(() => setPanelVisible(true));
    setRosterLoading(true);
    setRosterError(null);
    try {
      const res = await fetch(`/admin/api/enrolments?sessionId=${encodeURIComponent(s.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load roster');
      setRosterEnrolments(data.rows || []);
    } catch (err: any) {
      setRosterError(err.message);
    } finally {
      setRosterLoading(false);
    }
  }

  function closePanel() {
    setPanelVisible(false);
    setTimeout(() => setPanelSession(null), 250);
    setKioskUrl(null);
    setKioskError(null);
  }

  // --- Kiosk link (child post-session review) ---
  const [kioskUrl, setKioskUrl] = useState<string | null>(null);
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskError, setKioskError] = useState<string | null>(null);
  const [kioskCopied, setKioskCopied] = useState(false);

  async function generateKioskLink() {
    if (!panelSession) return;
    setKioskLoading(true);
    setKioskError(null);
    try {
      const res = await fetch('/admin/api/kiosk-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: panelSession.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate kiosk link');
      setKioskUrl(data.url);
    } catch (err: any) {
      setKioskError(err.message);
    } finally {
      setKioskLoading(false);
    }
  }

  async function copyKioskUrl() {
    if (!kioskUrl) return;
    await navigator.clipboard.writeText(kioskUrl);
    setKioskCopied(true);
    setTimeout(() => setKioskCopied(false), 2000);
  }

  async function revokeKioskLink() {
    if (!panelSession) return;
    setKioskLoading(true);
    try {
      await fetch('/admin/api/kiosk-tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: panelSession.id }),
      });
      await generateKioskLink();
    } finally {
      setKioskLoading(false);
    }
  }

  async function markAttendance(enrolmentId: string, attended: boolean | null) {
    setRosterEnrolments(prev => prev.map(e => e.id === enrolmentId ? { ...e, attended } : e));
    await fetch('/admin/api/enrolments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: enrolmentId, attended }),
    });
    // Keep the underlying session list's counts/avatars in sync without a full reload.
    setSessions(prev => prev.map(s => s.id !== panelSession?.id ? s : {
      ...s,
      enrolled_kids: s.enrolled_kids.map(k => k.id === rosterEnrolments.find(e => e.id === enrolmentId)?.kids?.id ? { ...k, attended } : k),
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Users2 size={14} /> Lead Funnel
            </Link>
            <Link href="/admin/kids" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Baby size={14} /> Kids
            </Link>
            <Link href="/admin/programs" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <BookOpen size={14} /> Programmes
            </Link>
            <Link href="/admin/commerce" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ShoppingBag size={14} /> Commerce
            </Link>
            <Link href="/admin/reviews" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <MessageSquareQuote size={14} /> Reviews
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Upcoming Sessions</h1>
          <p className="text-sm text-slate-500 mt-1">Who's registered, at a glance. Click a session for the full roster and attendance.</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search programme or venue..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showPastAndCancelled} onChange={e => setShowPastAndCancelled(e.target.checked)} /> Show past &amp; cancelled
              </label>
            </div>

            {grouped.length === 0 && (
              <div className="py-20 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No sessions match.</div>
            )}

            <div className="space-y-8">
              {grouped.map(group => (
                <div key={group.label}>
                  <h2 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{group.label}</h2>
                  <div className="space-y-2.5">
                    {group.sessions.map(s => {
                      const pct = s.capacity ? Math.min(100, Math.round((s.enrolment_count / s.capacity) * 100)) : null;
                      const full = s.capacity !== null && s.enrolment_count >= s.capacity;
                      return (
                        <button
                          key={s.id}
                          onClick={() => openPanel(s)}
                          className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-150 px-5 py-4 flex items-center gap-4"
                        >
                          <div className="w-20 shrink-0">
                            {s.starts_at ? (
                              <>
                                <div className="text-[13px] font-semibold text-slate-800">{fmtDate(s.starts_at)}</div>
                                <div className="text-[12px] text-slate-400">{fmtTime(s.starts_at)}</div>
                              </>
                            ) : (
                              <div className="text-[12px] text-slate-300">No date</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-slate-900 truncate">{s.programs?.name}</span>
                              {s.status !== 'confirmed' && s.status !== 'selling' && (
                                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{formatLabel(s.status)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-0.5">
                              {s.venues ? (
                                s.venues.type === 'online' ? <Globe size={11} /> : <MapPin size={11} />
                              ) : null}
                              <span className="truncate">{s.venues?.name || 'Venue TBC'}</span>
                            </div>
                          </div>

                          <div className="hidden sm:flex items-center -space-x-2 shrink-0">
                            {s.enrolled_kids.slice(0, 5).map(k => (
                              <div
                                key={k.id}
                                title={k.name}
                                className={`h-7 w-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-semibold ${avatarColor(k.id)}`}
                              >
                                {initials(k.name)}
                              </div>
                            ))}
                            {s.enrolled_kids.length > 5 && (
                              <div className="h-7 w-7 rounded-full ring-2 ring-white bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-semibold">
                                +{s.enrolled_kids.length - 5}
                              </div>
                            )}
                          </div>

                          <div className="w-28 shrink-0 text-right">
                            <div className={`text-[13px] font-semibold ${full ? 'text-rose-500' : 'text-slate-700'}`}>
                              {s.enrolment_count}{s.capacity ? ` / ${s.capacity}` : ''}
                            </div>
                            {pct !== null && (
                              <div className="h-1 w-full bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${full ? 'bg-rose-400' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>

                          <ChevronRight size={16} className="text-slate-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Roster slide-over */}
      {panelSession && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={closePanel}
            className={`absolute inset-0 bg-slate-900/25 backdrop-blur-sm transition-opacity duration-300 ${panelVisible ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${panelVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="px-7 pt-7 pb-4 shrink-0 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold text-slate-900 tracking-tight">{panelSession.programs?.name}</h3>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    {panelSession.programs?.code} · {panelSession.starts_at ? `${fmtDate(panelSession.starts_at)} · ${fmtTime(panelSession.starts_at)}` : 'No date set'}
                  </p>
                </div>
                <button onClick={closePanel} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <X size={15} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-2">
                {panelSession.venues ? (
                  panelSession.venues.type === 'online' ? (
                    <span className="flex items-center gap-1"><Globe size={11} /> {panelSession.venues.name}</span>
                  ) : panelSession.venues.maps_url ? (
                    <a href={panelSession.venues.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-600 hover:underline">
                      <MapPin size={11} /> {panelSession.venues.name} <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="flex items-center gap-1"><MapPin size={11} /> {panelSession.venues.name}</span>
                  )
                ) : <span>Venue TBC</span>}
              </div>

              {kioskUrl ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-500 truncate">{kioskUrl}</div>
                  <button onClick={copyKioskUrl} title="Copy kiosk link" className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                    {kioskCopied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button onClick={revokeKioskLink} title="Revoke and issue a fresh link" className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center text-slate-500 shrink-0">
                    <RotateCcw size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateKioskLink}
                  disabled={kioskLoading}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-50"
                >
                  <MessageSquareQuote size={12} /> {kioskLoading ? 'Generating…' : 'Get kiosk link for post-session review'}
                </button>
              )}
              {kioskError && <p className="text-[11px] text-rose-500 mt-1">{kioskError}</p>}

              <Link
                href={`/admin/session-photos/${panelSession.id}`}
                className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-500 hover:text-blue-700 w-fit"
              >
                <ChevronRight size={12} /> Manage session photos
              </Link>
              <Link
                href={`/admin/session-reports/${panelSession.id}`}
                className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-blue-500 hover:text-blue-700 w-fit"
              >
                <ChevronRight size={12} /> View session report
              </Link>
            </div>

            <ReviewsStatusPanel sessionId={panelSession.id} />

            {!rosterLoading && rosterEnrolments.length > 0 && (
              <div className="flex items-center gap-4 px-7 py-3 text-[12px] text-slate-500 shrink-0 border-b border-slate-50">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {rosterEnrolments.filter(e => e.attended === true).length} present</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> {rosterEnrolments.filter(e => e.attended === false).length} absent</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> {rosterEnrolments.filter(e => e.attended === null).length} unmarked</span>
                <span className="ml-auto text-slate-400">{rosterEnrolments.length} enrolled</span>
              </div>
            )}

            <div className="overflow-y-auto flex-1 px-7 py-4">
              {rosterLoading ? (
                <div className="py-12 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
              ) : rosterError ? (
                <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{rosterError}</div>
              ) : rosterEnrolments.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-6 text-center">No one registered yet.</p>
              ) : (
                <div className="space-y-1">
                  {rosterEnrolments.map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${avatarColor(e.kids?.id || e.id)}`}>
                          {initials(e.kids?.name || '?')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-slate-800 truncate">{e.kids?.name || '(unknown)'}</div>
                          <div className="text-[12px] text-slate-400">{formatLabel(e.status)}{e.kids?.phone ? ` · +${e.kids.phone}` : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => markAttendance(e.id, e.attended === true ? null : true)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
                            e.attended === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => markAttendance(e.id, e.attended === false ? null : false)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
                            e.attended === false ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ReviewRosterEntry = { kidId: string; kidName: string; review: { hold_status: string; completed_at: string | null; enjoyment: number | null; difficulty: string | null; wants_more: string | null } | null };
type ReviewsReport = {
  counts: { booked: number; reviewed: number };
  rating: { value: number | null; responseCount: number; rosterSize: number; confidence: 'low' | 'normal' };
  roster: ReviewRosterEntry[];
};

function emojiFor(v: number | null) {
  return ENJOYMENT_FACES.find(f => f.value === v)?.emoji || '—';
}

// The REVIEWS status widget (RAD_Post_Session_Review_Spec.md S9.1) -
// highest-value in the last 10 minutes of a session, while the
// not-yet-submitted kids are still in the room to chase. Sorted to the
// top on purpose; the submitted list collapses since the count and
// rating already carry its summary.
function ReviewsStatusPanel({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<ReviewsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedId, setRemindedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/admin/api/session-reports?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setReport(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  async function remind(kidId: string) {
    setRemindingId(kidId);
    try {
      const res = await fetch('/admin/api/kiosk-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const deepLink = `${data.url}?student=${kidId}`;
      await navigator.clipboard.writeText(deepLink);
      setRemindedId(kidId);
      setTimeout(() => setRemindedId(null), 2000);
    } catch {
      // best-effort - the plain kiosk link in the section above still works as a fallback
    } finally {
      setRemindingId(null);
    }
  }

  if (loading || !report) {
    return <div className="px-7 py-4 border-b border-slate-50"><Loader2 size={14} className="animate-spin text-slate-300" /></div>;
  }
  if (report.counts.booked === 0) return null;

  const notSubmitted = report.roster.filter(r => !r.review);
  const submitted = report.roster.filter(r => r.review);
  const pct = report.counts.booked > 0 ? Math.round((report.counts.reviewed / report.counts.booked) * 100) : 0;

  return (
    <div className="px-7 py-4 border-b border-slate-50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Reviews</span>
        <span className="text-[12px] text-slate-500">{report.counts.reviewed} / {report.counts.booked}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      {report.rating.value !== null && (
        <div className="flex items-center gap-1.5 mb-3 text-[12px] text-slate-500">
          <span className="font-semibold text-slate-800">{report.rating.value.toFixed(1)} ★</span>
          <span className="text-slate-400">({report.rating.responseCount} of {report.rating.rosterSize})</span>
          {report.rating.confidence === 'low' && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Low confidence</span>
          )}
        </div>
      )}

      {notSubmitted.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[11px] font-medium text-slate-400">Not yet submitted ({notSubmitted.length})</p>
          {notSubmitted.map(r => (
            <div key={r.kidId} className="flex items-center justify-between gap-2 py-1">
              <span className="text-[13px] text-slate-700">{r.kidName}</span>
              <button
                onClick={() => remind(r.kidId)}
                disabled={remindingId === r.kidId}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                {remindedId === r.kidId ? <><Check size={11} /> Copied</> : <><Bell size={11} /> Remind</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {submitted.length > 0 && (
        <div>
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600">
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /> Submitted ({submitted.length})
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-1">
              {submitted.map(r => (
                <div key={r.kidId} className="flex items-center gap-2 py-1 text-[12px]">
                  <span className="text-slate-700 w-24 truncate shrink-0">{r.kidName}</span>
                  <span>{emojiFor(r.review!.enjoyment)}</span>
                  <span className="text-slate-400 truncate">{r.review!.difficulty || '—'}</span>
                  <span className="text-slate-400 truncate">{r.review!.wants_more || '—'}</span>
                  {r.review!.hold_status === 'held' && (
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full shrink-0">Held</span>
                  )}
                  {!r.review!.completed_at && r.review!.hold_status !== 'held' && (
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">In progress</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
