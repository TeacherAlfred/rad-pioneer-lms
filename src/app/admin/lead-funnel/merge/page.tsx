"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, GitMerge, Loader2, X, CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";

type Lead = {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  school?: string | null;
  class?: string | null;
  source?: string | null;
  household_id?: string | null;
  household_name?: string | null;
  preferred_channel?: string | null;
  number_of_children?: number | null;
  interested_program_id?: string | null;
  interested_date_label?: string | null;
  tags?: string[] | null;
  children_names?: string[] | null;
  created_at?: string | null;
  merged_into_id?: string | null;
};

const LABEL_CLS = "text-[10px] font-black uppercase tracking-widest text-slate-400";
const CARD_CLS = "bg-white rounded-2xl border border-slate-200 p-4";

type ContactMode = 'A' | 'B' | 'both';
type ContactChoice = { mode: ContactMode; primary: 'A' | 'B' };
type PickChoice = 'A' | 'B';

type DuplicatePair = { id: string; lead_a_id: string; lead_b_id: string; reason: string };

// Mirrors lead_phone_key() in 20260925170000_lead_duplicate_candidates.sql -
// 0738... and 27738... are the same number.
function phoneKey(p: string | null | undefined): string {
  let d = String(p || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.length === 10 && d.startsWith('0')) d = '27' + d.slice(1);
  else if (d.length === 9) d = '27' + d;
  return d;
}

// The 27... form is what WhatsApp itself uses, so it's the safer record to
// keep the phone of.
function isIntlFormat(p: string | null | undefined): boolean {
  return String(p || '').replace(/\D/g, '').startsWith('27');
}

function displayVal(v: any) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>;
  return String(v);
}

function LeadPicker({ label, leads, excludeId, selected, onSelect }: { label: string; leads: Lead[]; excludeId?: string; selected: Lead | null; onSelect: (l: Lead) => void }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leads
      .filter(l => l.id !== excludeId)
      .filter(l => `${l.name || ''} ${l.email || ''} ${l.phone || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [leads, query, excludeId]);

  if (selected) {
    return (
      <div className={CARD_CLS}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={LABEL_CLS}>{label}</p>
            <p className="font-bold text-slate-800 mt-1">{selected.name || '(no name)'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{selected.email || 'no email'} · +{selected.phone || 'no phone'}</p>
          </div>
          <button onClick={() => onSelect(null as any)} className="text-slate-300 hover:text-rose-500"><X size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={CARD_CLS}>
      <p className={`${LABEL_CLS} mb-2`}>{label}</p>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          autoFocus={label === 'Lead A'}
          placeholder="Search name, email, or phone..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
          {matches.map(l => (
            <button
              key={l.id}
              onClick={() => { onSelect(l); setQuery(''); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200"
            >
              <p className="text-sm font-bold text-slate-800">{l.name || '(no name)'}</p>
              <p className="text-xs text-slate-400">{l.email || 'no email'} · +{l.phone || 'no phone'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MergeLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leadA, setLeadA] = useState<Lead | null>(null);
  const [leadB, setLeadB] = useState<Lead | null>(null);
  const [survivor, setSurvivor] = useState<'A' | 'B'>('A');

  const [name, setName] = useState<PickChoice>('A');
  const [emailChoice, setEmailChoice] = useState<ContactChoice>({ mode: 'A', primary: 'A' });
  const [phoneChoice, setPhoneChoice] = useState<ContactChoice>({ mode: 'A', primary: 'A' });
  const [school, setSchool] = useState<PickChoice>('A');
  const [klass, setKlass] = useState<PickChoice>('A');
  const [source, setSource] = useState<PickChoice>('A');
  const [household, setHousehold] = useState<PickChoice>('A');
  const [preferredChannel, setPreferredChannel] = useState<PickChoice>('A');
  const [numberOfChildren, setNumberOfChildren] = useState<PickChoice>('A');
  const [interest, setInterest] = useState<PickChoice>('A');

  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);

  function loadPairs() {
    fetch('/admin/api/leads/duplicates')
      .then(res => res.json())
      .then(data => setPairs(data.pairs || []))
      .catch(() => { /* non-fatal - manual merge still works without the suggestions */ });
  }

  useEffect(() => {
    fetch('/admin/api/lead-funnel')
      .then(res => res.json())
      .then(data => setLeads(data.rows || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    loadPairs();
  }, []);

  const leadsById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

  const suggestions = useMemo(() => {
    return pairs
      .map(p => {
        const x = leadsById.get(p.lead_a_id);
        const y = leadsById.get(p.lead_b_id);
        if (!x || !y) return null;
        // 27... record first (becomes Lead A / the survivor by default).
        const [a, b] = isIntlFormat(x.phone) || !isIntlFormat(y.phone) ? [x, y] : [y, x];
        return { id: p.id, a, b };
      })
      .filter((s): s is { id: string; a: Lead; b: Lead } => !!s);
  }, [pairs, leadsById]);

  function reviewPair(a: Lead, b: Lead) {
    setSurvivor('A');
    setLeadA(a);
    setLeadB(b);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function dismissPair(id: string) {
    setPairs(prev => prev.filter(p => p.id !== id));
    await fetch('/admin/api/leads/duplicates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  // Re-seed every picker's default choice whenever the pair changes -
  // default to whichever side is non-empty, or the survivor's side if
  // both are.
  useEffect(() => {
    if (!leadA || !leadB) return;
    const pick = (getVal: (l: Lead) => any): PickChoice => {
      const a = getVal(leadA), b = getVal(leadB);
      const aEmpty = a === null || a === undefined || a === '';
      const bEmpty = b === null || b === undefined || b === '';
      if (aEmpty && !bEmpty) return 'B';
      if (!aEmpty && bEmpty) return 'A';
      return survivor;
    };
    setName(pick(l => l.name));
    setSchool(pick(l => l.school));
    setKlass(pick(l => l.class));
    setSource(pick(l => l.source));
    setHousehold(pick(l => l.household_id));
    setPreferredChannel(pick(l => l.preferred_channel));
    setNumberOfChildren(pick(l => l.number_of_children));
    setInterest(pick(l => l.interested_program_id));

    const bothDiffer = (a: any, b: any) => a && b && a !== b;
    setEmailChoice({
      mode: bothDiffer(leadA.email, leadB.email) ? 'both' : pick(l => l.email),
      primary: survivor,
    });
    // 0738... vs 27738... is one number written two ways - keeping both as
    // primary + backup would just store the same number twice, so keep the
    // survivor's own.
    const samePhoneNumber = !!phoneKey(leadA.phone) && phoneKey(leadA.phone) === phoneKey(leadB.phone);
    setPhoneChoice({
      mode: samePhoneNumber ? survivor : bothDiffer(leadA.phone, leadB.phone) ? 'both' : pick(l => l.phone),
      primary: survivor,
    });
  }, [leadA, leadB, survivor]);

  function resolveContact(choice: ContactChoice, a: string | null | undefined, b: string | null | undefined) {
    if (choice.mode === 'A') return { value: a || null, backup: null };
    if (choice.mode === 'B') return { value: b || null, backup: null };
    return choice.primary === 'A' ? { value: a || null, backup: b || null } : { value: b || null, backup: a || null };
  }

  async function doMerge() {
    if (!leadA || !leadB) return;
    setMerging(true);
    setMergeError(null);
    try {
      const survivorLead = survivor === 'A' ? leadA : leadB;
      const loserLead = survivor === 'A' ? leadB : leadA;
      const pickVal = (choice: PickChoice, a: any, b: any) => (choice === 'A' ? a : b);

      const email = resolveContact(emailChoice, leadA.email, leadB.email);
      const phone = resolveContact(phoneChoice, leadA.phone, leadB.phone);
      const interestLead = interest === 'A' ? leadA : leadB;

      const fields = {
        name: pickVal(name, leadA.name, leadB.name),
        email: email.value,
        backup_email: email.backup,
        phone: phone.value,
        backup_phone: phone.backup,
        school: pickVal(school, leadA.school, leadB.school),
        class: pickVal(klass, leadA.class, leadB.class),
        source: pickVal(source, leadA.source, leadB.source),
        household_id: pickVal(household, leadA.household_id, leadB.household_id),
        preferred_channel: pickVal(preferredChannel, leadA.preferred_channel, leadB.preferred_channel),
        number_of_children: pickVal(numberOfChildren, leadA.number_of_children, leadB.number_of_children),
        interested_program_id: interestLead.interested_program_id,
        interested_date_label: interestLead.interested_date_label,
      };

      const res = await fetch('/admin/api/leads/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survivorId: survivorLead.id, loserId: loserLead.id, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Merge failed.');
      setDone(true);
    } catch (err: any) {
      setMergeError(err.message);
    } finally {
      setMerging(false);
    }
  }

  function reset() {
    setLeadA(null);
    setLeadB(null);
    setSurvivor('A');
    setDone(false);
    setMergeError(null);
    // Refresh the list so the just-merged lead disappears from search.
    setLoading(true);
    fetch('/admin/api/lead-funnel').then(res => res.json()).then(data => setLeads(data.rows || [])).finally(() => setLoading(false));
    loadPairs();
  }

  const PickRow = ({ label, aVal, bVal, choice, onChange }: { label: string; aVal: any; bVal: any; choice: PickChoice; onChange: (c: PickChoice) => void }) => (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center py-2 border-b border-slate-50 last:border-0">
      <p className={LABEL_CLS}>{label}</p>
      <button onClick={() => onChange('A')} className={`text-left px-3 py-2 rounded-lg border text-sm ${choice === 'A' ? 'border-slate-900 bg-slate-50 font-bold text-slate-900' : 'border-slate-200 text-slate-500'}`}>
        {displayVal(aVal)}
      </button>
      <button onClick={() => onChange('B')} className={`text-left px-3 py-2 rounded-lg border text-sm ${choice === 'B' ? 'border-slate-900 bg-slate-50 font-bold text-slate-900' : 'border-slate-200 text-slate-500'}`}>
        {displayVal(bVal)}
      </button>
    </div>
  );

  const ContactRow = ({ label, aVal, bVal, choice, onChange }: { label: string; aVal: string | null | undefined; bVal: string | null | undefined; choice: ContactChoice; onChange: (c: ContactChoice) => void }) => (
    <div className="py-2 border-b border-slate-50 last:border-0">
      <div className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
        <p className={LABEL_CLS}>{label}</p>
        <button onClick={() => onChange({ ...choice, mode: 'A' })} className={`text-left px-3 py-2 rounded-lg border text-sm ${choice.mode === 'A' ? 'border-slate-900 bg-slate-50 font-bold text-slate-900' : 'border-slate-200 text-slate-500'}`}>
          {displayVal(aVal)}
        </button>
        <button onClick={() => onChange({ ...choice, mode: 'B' })} className={`text-left px-3 py-2 rounded-lg border text-sm ${choice.mode === 'B' ? 'border-slate-900 bg-slate-50 font-bold text-slate-900' : 'border-slate-200 text-slate-500'}`}>
          {displayVal(bVal)}
        </button>
      </div>
      {aVal && bVal && aVal !== bVal && (
        <div className="ml-[132px] mt-1.5 flex items-center gap-2">
          <button
            onClick={() => onChange({ mode: 'both', primary: choice.mode === 'both' ? choice.primary : 'A' })}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${choice.mode === 'both' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400'}`}
          >
            Keep both (primary + backup)
          </button>
          {choice.mode === 'both' && (
            <select
              value={choice.primary}
              onChange={e => onChange({ mode: 'both', primary: e.target.value as 'A' | 'B' })}
              className="text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none"
            >
              <option value="A">A is primary</option>
              <option value="B">B is primary</option>
            </select>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <GitMerge size={20} className="text-blue-500" /> Merge Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Combine two duplicate lead records into one. Nothing is deleted — the record you don't keep is hidden from the funnel and its history (messages, notes, orders, consent forms) is repointed onto the survivor.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : done ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={40} />
            <h3 className="font-black text-slate-800 text-lg">Merged</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6">The records have been combined.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest">Merge Another Pair</button>
              <Link href="/admin/lead-funnel" className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest">Back to Funnel</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.length > 0 && !leadA && !leadB && (
              <div className={`${CARD_CLS} border-amber-200 bg-amber-50/40`}>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">
                  <AlertTriangle size={12} /> Possible duplicates ({suggestions.length})
                </p>
                <p className="text-[11px] text-slate-500 mb-3">Same phone number written two ways (0738… vs +27738…). Nothing has been changed - review each pair and merge, or dismiss it if they really are different people.</p>
                <div className="divide-y divide-amber-100 max-h-96 overflow-y-auto">
                  {suggestions.map(s => (
                    <div key={s.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[260px] grid grid-cols-2 gap-3 text-xs">
                        {[s.a, s.b].map(l => (
                          <div key={l.id} className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{l.name || '(no name)'}</p>
                            <p className="text-slate-400 truncate">{l.phone}{l.email ? ` · ${l.email}` : ''}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => reviewPair(s.a, s.b)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">Review &amp; merge</button>
                      <button onClick={() => dismissPair(s.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-slate-400">Not a duplicate</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <LeadPicker label="Lead A" leads={leads} excludeId={leadB?.id} selected={leadA} onSelect={setLeadA} />
              <LeadPicker label="Lead B" leads={leads} excludeId={leadA?.id} selected={leadB} onSelect={setLeadB} />
            </div>

            {leadA && leadB && (
              <>
                <div className={CARD_CLS}>
                  <p className={`${LABEL_CLS} mb-2`}>Keep the record ID from</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSurvivor('A')} className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold ${survivor === 'A' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 text-slate-400'}`}>Lead A</button>
                    <button onClick={() => setSurvivor('B')} className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold ${survivor === 'B' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 text-slate-400'}`}>Lead B</button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Whichever value you pick below is written onto this record either way — this only decides which id (and its existing history) survives.</p>
                </div>

                <div className={CARD_CLS}>
                  <p className={`${LABEL_CLS} mb-1`}>For each field, pick which value to keep</p>
                  <div className="grid grid-cols-[120px_1fr_1fr] gap-3 pb-2 mb-1 border-b border-slate-100">
                    <span />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Lead A</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Lead B</span>
                  </div>
                  <PickRow label="Name" aVal={leadA.name} bVal={leadB.name} choice={name} onChange={setName} />
                  <ContactRow label="Email" aVal={leadA.email} bVal={leadB.email} choice={emailChoice} onChange={setEmailChoice} />
                  <ContactRow label="Phone" aVal={leadA.phone} bVal={leadB.phone} choice={phoneChoice} onChange={setPhoneChoice} />
                  <PickRow label="School" aVal={leadA.school} bVal={leadB.school} choice={school} onChange={setSchool} />
                  <PickRow label="Class" aVal={leadA.class} bVal={leadB.class} choice={klass} onChange={setKlass} />
                  <PickRow label="Source" aVal={leadA.source} bVal={leadB.source} choice={source} onChange={setSource} />
                  <PickRow label="Household" aVal={leadA.household_name || leadA.household_id} bVal={leadB.household_name || leadB.household_id} choice={household} onChange={setHousehold} />
                  <PickRow label="Contact Via" aVal={leadA.preferred_channel} bVal={leadB.preferred_channel} choice={preferredChannel} onChange={setPreferredChannel} />
                  <PickRow label="# Children" aVal={leadA.number_of_children} bVal={leadB.number_of_children} choice={numberOfChildren} onChange={setNumberOfChildren} />
                  <PickRow label="Interested In" aVal={leadA.interested_date_label ? `${leadA.interested_date_label}` : (leadA.interested_program_id ? 'Program (no date)' : null)} bVal={leadB.interested_date_label ? `${leadB.interested_date_label}` : (leadB.interested_program_id ? 'Program (no date)' : null)} choice={interest} onChange={setInterest} />
                </div>

                <div className="bg-slate-100 rounded-2xl p-4 text-[12px] text-slate-500 leading-relaxed">
                  <strong className="text-slate-600">Also merged automatically, no need to pick:</strong> tags and children's names (combined from both), purchase history (earliest start, latest purchase kept), lifetime value, and the customer / potential-student / opted-out flags (each keeps "yes" if either record has it — a merge can never accidentally un-opt-out someone).
                </div>

                {mergeError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{mergeError}</div>}

                <button
                  onClick={doMerge}
                  disabled={merging}
                  className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"
                >
                  {merging ? <Loader2 size={16} className="animate-spin" /> : <>Merge These Two Leads <ArrowRight size={14} /></>}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
