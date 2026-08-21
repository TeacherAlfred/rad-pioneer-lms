"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Users, ChevronDown, ChevronUp, Mail, Phone,
  Calendar, MapPin, Layers,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type Registration = {
  id: string;
  created_at: string;
  lead_id: string;
  program_id: string | null;
  program_title: string;
  series: string | null;
  location: string | null;
  date_option_id: string | null;
  date_label: string | null;
  number_of_children: number;
  preferred_channel: string | null;
  source: string | null;
};

type Program = {
  id: string;
  title: string;
  series: string | null;
  location: string | null;
  live_from: string;
  live_until: string;
  draft: boolean;
};

type LeadInfo = { name: string | null; email: string | null; phone: string | null };

type InstanceAgg = {
  key: string;
  title: string;
  location: string | null;
  series: string | null;
  date: string;
  isOrphan: boolean;
  registrations: Registration[];
  registrationCount: number;
  attendeeCount: number;
};

type SeriesGroup = {
  key: string;
  label: string;
  instances: InstanceAgg[];
  instanceCount: number;
  totalRegistrations: number;
  totalAttendees: number;
  mostRecent: string;
};

const UNGROUPED = "__ungrouped__";

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RegistrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [leadsById, setLeadsById] = useState<Record<string, LeadInfo>>({});

  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [metric, setMetric] = useState<'registrations' | 'attendees'>('registrations');
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/admin/api/registrations');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load registrations');
        setRegistrations(data.registrations || []);
        setPrograms(data.programs || []);
        setLeadsById(data.leadsById || {});
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredRegistrations = useMemo(() => {
    if (!dateFrom && !dateTo) return registrations;
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    // dateTo is a plain date input - treat it as end-of-day so the boundary day is included.
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    return registrations.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= from && t < to;
    });
  }, [registrations, dateFrom, dateTo]);

  const seriesGroups = useMemo<SeriesGroup[]>(() => {
    const regsByProgramId = new Map<string, Registration[]>();
    // Registrations whose program was later deleted lose their program_id
    // (on delete set null - see the migration) but keep their snapshotted
    // title, so those get grouped by title instead as a best-effort fallback.
    const orphansByTitle = new Map<string, Registration[]>();
    for (const r of filteredRegistrations) {
      if (r.program_id) {
        const list = regsByProgramId.get(r.program_id) || [];
        list.push(r);
        regsByProgramId.set(r.program_id, list);
      } else {
        const list = orphansByTitle.get(r.program_title) || [];
        list.push(r);
        orphansByTitle.set(r.program_title, list);
      }
    }

    const instances: InstanceAgg[] = [];
    for (const p of programs) {
      const regs = regsByProgramId.get(p.id) || [];
      instances.push({
        key: p.id,
        title: p.title,
        location: p.location,
        series: p.series,
        date: p.live_from,
        isOrphan: false,
        registrations: regs,
        registrationCount: regs.length,
        attendeeCount: regs.reduce((sum, r) => sum + r.number_of_children, 0),
      });
    }
    for (const [title, regs] of orphansByTitle) {
      const sample = regs[0];
      instances.push({
        key: `orphan:${title}`,
        title: `${title} (deleted)`,
        location: sample.location,
        series: sample.series,
        date: regs.reduce((min, r) => r.created_at < min ? r.created_at : min, regs[0].created_at),
        isOrphan: true,
        registrations: regs,
        registrationCount: regs.length,
        attendeeCount: regs.reduce((sum, r) => sum + r.number_of_children, 0),
      });
    }

    const groups = new Map<string, InstanceAgg[]>();
    for (const inst of instances) {
      const key = inst.series || UNGROUPED;
      const list = groups.get(key) || [];
      list.push(inst);
      groups.set(key, list);
    }

    const result: SeriesGroup[] = [];
    for (const [key, insts] of groups) {
      insts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      result.push({
        key,
        label: key === UNGROUPED ? 'Ungrouped (one-off events)' : key,
        instances: insts,
        instanceCount: insts.length,
        totalRegistrations: insts.reduce((sum, i) => sum + i.registrationCount, 0),
        totalAttendees: insts.reduce((sum, i) => sum + i.attendeeCount, 0),
        mostRecent: insts.reduce((max, i) => i.date > max ? i.date : max, insts[0]?.date || ''),
      });
    }
    result.sort((a, b) => new Date(b.mostRecent).getTime() - new Date(a.mostRecent).getTime());
    return result;
  }, [filteredRegistrations, programs]);

  const selectedGroup = seriesGroups.find(g => g.key === selectedSeriesKey) || null;

  const chartData = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.instances.map(inst => ({
      name: fmtMonth(inst.date),
      title: inst.title,
      registrations: inst.registrationCount,
      attendees: inst.attendeeCount,
    }));
  }, [selectedGroup]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <Link href="/admin/featured-programs" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            Manage Featured Programs
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={20} className="text-blue-500" /> Registrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every Register Interest submission from the events pages, grouped by the Series tag set on each Featured Program so you can compare recurring events instance to instance.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-600">Clear</button>
          )}
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : !selectedGroup ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Series</th>
                  <th className="px-4 py-3 text-right">Instances</th>
                  <th className="px-4 py-3 text-right">Registrations</th>
                  <th className="px-4 py-3 text-right">Attendees</th>
                  <th className="px-4 py-3 text-right">Most Recent</th>
                </tr>
              </thead>
              <tbody>
                {seriesGroups.map(g => (
                  <tr
                    key={g.key} onClick={() => setSelectedSeriesKey(g.key)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                      <Layers size={14} className="text-blue-400 shrink-0" /> {g.label}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{g.instanceCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{g.totalRegistrations}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{g.totalAttendees}</td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">{g.mostRecent ? fmtMonth(g.mostRecent) : '—'}</td>
                  </tr>
                ))}
                {seriesGroups.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400">No registrations{dateFrom || dateTo ? ' in this date range' : ' yet'}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => { setSelectedSeriesKey(null); setExpandedInstance(null); }} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ArrowLeft size={14} /> All Series
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{selectedGroup.label}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedGroup.instanceCount} instance{selectedGroup.instanceCount === 1 ? '' : 's'} · {selectedGroup.totalRegistrations} registration{selectedGroup.totalRegistrations === 1 ? '' : 's'} · {selectedGroup.totalAttendees} attendee{selectedGroup.totalAttendees === 1 ? '' : 's'} · avg {(selectedGroup.totalRegistrations / selectedGroup.instanceCount).toFixed(1)}/instance
                  </p>
                </div>
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs font-black uppercase tracking-widest">
                  <button onClick={() => setMetric('registrations')} className={`px-3 py-1.5 rounded-lg ${metric === 'registrations' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Registrations</button>
                  <button onClick={() => setMetric('attendees')} className={`px-3 py-1.5 rounded-lg ${metric === 'attendees' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Attendees</button>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ''}
                    />
                    <Bar dataKey={metric} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {selectedGroup.instances.map(inst => {
                const expanded = expandedInstance === inst.key;
                return (
                  <div key={inst.key} className="border-b border-slate-50 last:border-0">
                    <button onClick={() => setExpandedInstance(expanded ? null : inst.key)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{inst.title}</div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Calendar size={11} /> {fmtMonth(inst.date)}</span>
                          {inst.location && <span className="flex items-center gap-1"><MapPin size={11} /> {inst.location}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-800">{inst.registrationCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">Regs</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-800">{inst.attendeeCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">Attendees</div>
                        </div>
                        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4">
                        {inst.registrations.length === 0 ? (
                          <p className="text-xs text-slate-400 py-3">No registrations for this instance.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                <th className="py-2 pr-3">Name</th>
                                <th className="py-2 pr-3">Contact</th>
                                <th className="py-2 pr-3">Date Chosen</th>
                                <th className="py-2 pr-3 text-right">Count</th>
                                <th className="py-2 text-right">Submitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inst.registrations
                                .slice()
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map(r => {
                                  const lead = leadsById[r.lead_id];
                                  return (
                                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                                      <td className="py-2 pr-3 font-bold text-slate-700">{lead?.name || '—'}</td>
                                      <td className="py-2 pr-3 text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                          {r.preferred_channel === 'whatsapp' ? <Phone size={11} /> : <Mail size={11} />}
                                          {r.preferred_channel === 'whatsapp' ? (lead?.phone || '—') : (lead?.email || '—')}
                                        </div>
                                      </td>
                                      <td className="py-2 pr-3 text-slate-500">{r.date_label || '—'}</td>
                                      <td className="py-2 pr-3 text-right text-slate-700 font-bold">{r.number_of_children}</td>
                                      <td className="py-2 text-right text-slate-400">{fmtDateTime(r.created_at)}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
