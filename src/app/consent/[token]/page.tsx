"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Loader2, ChevronLeft, ShieldCheck, CheckCircle2, AlertTriangle,
  Heart, Phone, Users, Camera, ClipboardCheck, Sparkles, Pencil, Plus, X,
  Lock, Megaphone, Video, SlidersHorizontal, MessageSquareQuote,
} from "lucide-react";
import {
  ConsentPayload, emptyConsentPayload, RELATIONSHIP_OPTIONS, ALLERGY_SEVERITY_OPTIONS,
  GRADE_OPTIONS, PHOTO_TIERS, PHOTO_TIER_GROUPS, PhotoTierGroup, ageFromDob, daysSince, FULL_REVIEW_MAX_DAYS,
} from "@/lib/consent";

type OtherGuardian = { id: string; name: string | null; phone: string };
type ChildInfo = {
  id: string; name: string; dateOfBirth: string | null; grade: string | null;
  latestForm: { id: string; submitted_at: string; consent_wording_version: string; confirmed_unchanged: boolean; payload: ConsentPayload } | null;
  otherGuardians: OtherGuardian[];
};
type GuardianInfo = { id: string; name: string | null; phone: string; email: string | null };

const PHOTO_GROUP_STYLES: Record<PhotoTierGroup, { bg: string; border: string; text: string; icon: string }> = {
  private: { bg: 'bg-blue-50/60', border: 'border-blue-100', text: 'text-blue-700', icon: 'text-blue-400' },
  paid: { bg: 'bg-amber-50/60', border: 'border-amber-100', text: 'text-amber-700', icon: 'text-amber-400' },
  video: { bg: 'bg-purple-50/60', border: 'border-purple-100', text: 'text-purple-700', icon: 'text-purple-400' },
};

const FIELD_CLS = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 focus:bg-white";
const LABEL_CLS = "block text-[15px] font-medium text-slate-800 mb-2";
const HINT_CLS = "text-[13px] text-slate-400 mt-1.5 leading-relaxed";

const STEPS_FULL = ['guardian', 'child', 'allergies', 'conditions', 'emergency', 'collection', 'photo', 'review'] as const;
const STEPS_SHORT = ['child', 'allergies', 'conditions', 'emergency', 'collection', 'photo', 'review'] as const;
type StepKey = typeof STEPS_FULL[number];

const STEP_META: Record<StepKey, { title: string; icon: any }> = {
  guardian: { title: 'About You', icon: ShieldCheck },
  child: { title: 'About Your Child', icon: Heart },
  allergies: { title: 'Allergies', icon: AlertTriangle },
  conditions: { title: 'Medical & Support', icon: Heart },
  emergency: { title: 'Emergency Contact', icon: Phone },
  collection: { title: 'Who Can Collect', icon: Users },
  photo: { title: 'Permissions', icon: Camera },
  review: { title: 'Review & Submit', icon: ClipboardCheck },
};

function digitsOnly(s: string) { return (s || '').replace(/\D/g, ''); }

function Req() {
  return <span className="text-rose-500 ml-0.5" aria-hidden>*</span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function NoneField({
  label, isNone, value, onNoneChange, onValueChange, placeholder,
}: { label: string; isNone: boolean; value: string; onNoneChange: (v: boolean) => void; onValueChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[15px] font-medium text-slate-800">{label}<Req /></label>
        <button
          type="button"
          onClick={() => { onNoneChange(!isNone); if (!isNone) onValueChange(''); }}
          className={`text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors duration-150 ${isNone ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          None
        </button>
      </div>
      {!isNone && (
        <textarea
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={FIELD_CLS}
        />
      )}
    </div>
  );
}

export default function ConsentFormPage() {
  const params = useParams();
  const token = params.token as string;

  const [mode, setMode] = useState<'loading' | 'error' | 'landing' | 'confirm' | 'wizard' | 'submitted' | 'all-done'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [guardian, setGuardian] = useState<GuardianInfo | null>(null);
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [guardianDoneThisSession, setGuardianDoneThisSession] = useState(false);

  const [steps, setSteps] = useState<readonly StepKey[]>(STEPS_FULL);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<ConsentPayload>(emptyConsentPayload());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/consent/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'This link could not be loaded.');
        setGuardian(data.guardian);
        setChildren(data.children);
        setMode('landing');
      } catch (err: any) {
        setErrorMsg(err.message);
        setMode('error');
      }
    })();
  }, [token]);

  const activeChild = useMemo(() => children.find(c => c.id === activeChildId) || null, [children, activeChildId]);

  function isChildCurrent(c: ChildInfo) {
    return !!c.latestForm && daysSince(c.latestForm.submitted_at) < FULL_REVIEW_MAX_DAYS;
  }

  function beginWizard(child: ChildInfo, prefillPayload: ConsentPayload | null) {
    const useSteps = guardianDoneThisSession ? STEPS_SHORT : STEPS_FULL;
    setSteps(useSteps);
    setStepIndex(0);
    setSaveError(null);
    const base: ConsentPayload = prefillPayload ? JSON.parse(JSON.stringify(prefillPayload)) : emptyConsentPayload();
    if (!prefillPayload) {
      base.guardian.fullName = guardian?.name || '';
      base.guardian.mobile = guardian?.phone || '';
      base.guardian.email = guardian?.email || '';
      base.child.fullName = child.name || '';
      base.child.dateOfBirth = child.dateOfBirth || '';
      base.child.grade = child.grade || '';
    }
    setForm(base);
    setMode('wizard');
  }

  function startChild(child: ChildInfo) {
    setActiveChildId(child.id);
    if (child.latestForm && daysSince(child.latestForm.submitted_at) < FULL_REVIEW_MAX_DAYS) {
      setMode('confirm');
    } else {
      beginWizard(child, child.latestForm?.payload || null);
    }
  }

  function markChildDone(childId: string, row: any) {
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, latestForm: { id: row.id, submitted_at: row.submitted_at, consent_wording_version: row.consent_wording_version, confirmed_unchanged: row.confirmed_unchanged, payload: row.payload } } : c));
  }

  async function confirmUnchanged() {
    if (!activeChild?.latestForm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/consent/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: activeChild.id, payload: activeChild.latestForm.payload, confirmedUnchanged: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setGuardianDoneThisSession(true);
      markChildDone(activeChild.id, data.row);
      setMode('submitted');
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof ConsentPayload>(section: K, patch: Partial<ConsentPayload[K]>) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  async function submitForm() {
    if (!activeChild) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/consent/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: activeChild.id, payload: form, confirmedUnchanged: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      markChildDone(activeChild.id, data.row);
      setMode('submitted');
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    const key = steps[stepIndex];
    if (!canProceed(key)) return;
    if (key === 'guardian') setGuardianDoneThisSession(true);
    if (stepIndex < steps.length - 1) setStepIndex(i => i + 1);
    else submitForm();
  }
  function goBack() {
    if (stepIndex === 0) { setMode('landing'); return; }
    setStepIndex(i => i - 1);
  }
  function jumpTo(key: StepKey) {
    const idx = steps.indexOf(key);
    if (idx >= 0) setStepIndex(idx);
  }

  function afterSubmittedContinue() {
    const next = children.find(c => c.id !== activeChildId && !isChildCurrent(c));
    setActiveChildId(null);
    if (next) startChild(next);
    else setMode('all-done');
  }

  const age = ageFromDob(form.child.dateOfBirth);
  const needsTravelField = age !== null && age >= 13;
  const guardianDigits = digitsOnly(form.guardian.mobile);
  const guardianAltDigits = digitsOnly(form.guardian.alternateContact);
  const emergencyMatchesGuardian = !!form.emergencyContact.primary.mobile &&
    (digitsOnly(form.emergencyContact.primary.mobile) === guardianDigits || (guardianAltDigits && digitsOnly(form.emergencyContact.primary.mobile) === guardianAltDigits));

  function canProceed(key: StepKey): boolean {
    switch (key) {
      case 'guardian':
        return !!(form.guardian.fullName.trim() && form.guardian.relationship && form.guardian.mobile.trim() && form.guardian.email.trim() && form.guardian.authorityConfirmed);
      case 'child':
        return !!(form.child.fullName.trim() && form.child.dateOfBirth);
      case 'allergies':
        return (form.medical.foodAllergyIsNone || !!form.medical.foodAllergies.trim())
          && (form.medical.environmentalAllergyIsNone || !!form.medical.environmentalAllergies.trim())
          && (form.medical.medicationAllergyIsNone || !!form.medical.medicationAllergies.trim());
      case 'conditions':
        return (form.medical.chronicConditionIsNone || !!form.medical.chronicConditions.trim())
          && (form.medical.medicationDuringSessionIsNone || !!form.medical.medicationDuringSession.trim());
      case 'emergency':
        // At least one emergency contact, from any source - an other
        // guardian marked to contact, a filled-in primary contact, or a
        // filled-in second contact.
        return form.emergencyContact.otherGuardiansToContact.length > 0
          || !!(form.emergencyContact.primary.fullName.trim() && form.emergencyContact.primary.relationship.trim() && form.emergencyContact.primary.mobile.trim())
          || !!(form.emergencyContact.hasSecond && form.emergencyContact.second.fullName.trim() && form.emergencyContact.second.mobile.trim());
      case 'collection':
        return !needsTravelField || form.collection.mayTravelUnaccompanied !== null;
      case 'photo':
        return true;
      case 'review':
        return true;
      default:
        return true;
    }
  }

  // ---------------- render ----------------

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-300" size={28} />
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="h-14 w-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Link not available</h1>
          <p className="text-[15px] text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto px-6 pt-14 pb-10">
          <div className="h-14 w-14 rounded-3xl bg-slate-900 text-white flex items-center justify-center mb-6">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight leading-tight">
            {guardian?.name ? `Hi ${guardian.name.split(' ')[0]}` : 'Hi there'}
          </h1>
          <p className="text-[15px] text-slate-500 mt-2 leading-relaxed">
            Before your child joins us, we need a few safety and permission details. It takes about five minutes per child.
          </p>

          <div className="mt-8 space-y-3">
            {children.map(c => {
              const current = isChildCurrent(c);
              const started = !!c.latestForm;
              return (
                <button
                  key={c.id}
                  onClick={() => startChild(c)}
                  className="w-full flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-2xl px-5 py-4 text-left transition-colors duration-150"
                >
                  <div>
                    <div className="text-[16px] font-medium text-slate-900">{c.name}</div>
                    <div className="text-[13px] text-slate-400 mt-0.5">
                      {current ? `Updated ${new Date(c.latestForm!.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}` : started ? 'Needs review' : 'Not started'}
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${current ? 'bg-emerald-100 text-emerald-700' : started ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                    {current ? 'Up to date' : started ? 'Review' : 'Start'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[12px] text-slate-300 mt-10 text-center leading-relaxed">
            Medical information is stored securely and shared only with your child's educators on the day.
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'confirm' && activeChild?.latestForm) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="max-w-md w-full mx-auto px-6 pt-14 pb-8 flex-1">
          <button onClick={() => { setActiveChildId(null); setMode('landing'); }} className="text-slate-400 flex items-center gap-1 text-[14px] mb-8">
            <ChevronLeft size={16} /> Back
          </button>
          <div className="h-14 w-14 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6">
            <Sparkles size={24} />
          </div>
          <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight leading-tight">{activeChild.name}'s details</h1>
          <p className="text-[15px] text-slate-500 mt-2 leading-relaxed">
            Last updated {new Date(activeChild.latestForm.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}. Please check this is still correct - especially allergies and emergency contacts.
          </p>

          <div className="mt-6 bg-slate-50 rounded-2xl p-5 space-y-3 text-[14px]">
            <SummaryRow label="Allergies" value={
              [activeChild.latestForm.payload.medical.foodAllergyIsNone ? null : activeChild.latestForm.payload.medical.foodAllergies,
               activeChild.latestForm.payload.medical.environmentalAllergyIsNone ? null : activeChild.latestForm.payload.medical.environmentalAllergies]
                .filter(Boolean).join(', ') || 'None recorded'
            } />
            <SummaryRow label="Emergency contact" value={`${activeChild.latestForm.payload.emergencyContact.primary.fullName || '—'} · ${activeChild.latestForm.payload.emergencyContact.primary.mobile || '—'}`} />
            <SummaryRow label="Photo permissions" value={Object.entries(activeChild.latestForm.payload.photo).filter(([k, v]) => v && k.startsWith('tier')).length > 0 ? 'Some permissions given' : 'None given'} />
          </div>

          {saveError && <div className="mt-4 bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-3">{saveError}</div>}
        </div>
        <div className="max-w-md w-full mx-auto px-6 pb-10 space-y-2.5">
          <button onClick={confirmUnchanged} disabled={saving} className="w-full py-4 rounded-2xl text-[16px] font-medium text-white bg-slate-900 disabled:opacity-50">
            {saving ? 'Saving…' : "Yes, still correct"}
          </button>
          <button onClick={() => beginWizard(activeChild, activeChild.latestForm!.payload)} className="w-full py-4 rounded-2xl text-[16px] font-medium text-slate-600 bg-slate-100">
            Let me review it
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'submitted') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6">
          <CheckCircle2 size={30} />
        </div>
        <h1 className="text-[22px] font-semibold text-slate-900">{activeChild ? `${activeChild.name}'s form is saved` : 'Saved'}</h1>
        <p className="text-[15px] text-slate-500 mt-2 max-w-xs">Thank you - this is exactly what the educators will use to keep them safe and comfortable on the day.</p>
        <button onClick={afterSubmittedContinue} className="mt-8 w-full max-w-xs py-4 rounded-2xl text-[16px] font-medium text-white bg-slate-900">
          {children.some(c => c.id !== activeChildId && !isChildCurrent(c)) ? 'Continue' : 'Done'}
        </button>
      </div>
    );
  }

  if (mode === 'all-done') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center mb-6">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-[22px] font-semibold text-slate-900">All done</h1>
        <p className="text-[15px] text-slate-500 mt-2 max-w-xs">Every child linked to you is up to date. You can reopen this link any time to review or update details.</p>
      </div>
    );
  }

  // wizard
  const key = steps[stepIndex];
  const meta = STEP_META[key];
  const Icon = meta.icon;
  const isPhoto = key === 'photo';

  return (
    <div className={`min-h-screen flex flex-col ${isPhoto ? 'bg-indigo-50/40' : 'bg-white'}`}>
      <div className="shrink-0 px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={goBack} className="text-slate-400 flex items-center gap-1 text-[14px]">
            <ChevronLeft size={16} /> Back
          </button>
          <span className="text-[12px] text-slate-300 font-medium">{stepIndex + 1} of {steps.length}</span>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-8 max-w-md w-full mx-auto">
        <div className="flex items-center gap-2.5 mb-1">
          <Icon size={18} className={isPhoto ? 'text-indigo-500' : 'text-slate-400'} />
          <span className="text-[13px] font-medium text-slate-400 uppercase tracking-wide">{isPhoto ? 'Optional - Permissions' : 'Required'}</span>
        </div>
        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight mb-1">
          {key === 'child' && activeChild ? `About ${activeChild.name}` : meta.title}
        </h1>
        {!isPhoto && <p className="text-[12px] text-slate-400 mb-6"><span className="text-rose-500">*</span> Required</p>}
        {isPhoto && <div className="mb-6" />}

        {key === 'guardian' && (
          <div className="space-y-5">
            <div>
              <label className={LABEL_CLS}>Full name<Req /></label>
              <input value={form.guardian.fullName} onChange={e => updateForm('guardian', { fullName: e.target.value })} className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Relationship to child<Req /></label>
              <select value={form.guardian.relationship} onChange={e => updateForm('guardian', { relationship: e.target.value })} className={FIELD_CLS}>
                <option value="">Select...</option>
                {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Mobile number<Req /></label>
              <input type="tel" value={form.guardian.mobile} onChange={e => updateForm('guardian', { mobile: e.target.value })} className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Email<Req /></label>
              <input type="email" value={form.guardian.email} onChange={e => updateForm('guardian', { email: e.target.value })} className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Alternate contact number</label>
              <input type="tel" value={form.guardian.alternateContact} onChange={e => updateForm('guardian', { alternateContact: e.target.value })} placeholder="Optional" className={FIELD_CLS} />
            </div>
            <label className="flex items-start gap-3 bg-slate-50 rounded-2xl p-4 cursor-pointer">
              <input type="checkbox" checked={form.guardian.authorityConfirmed} onChange={e => updateForm('guardian', { authorityConfirmed: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" />
              <span className="text-[14px] text-slate-700 leading-relaxed">I confirm I have parental responsibility for this child and am authorised to give the consents on this form.<Req /></span>
            </label>
          </div>
        )}

        {key === 'child' && (
          <div className="space-y-5">
            <div>
              <label className={LABEL_CLS}>Full name<Req /></label>
              <input value={form.child.fullName} onChange={e => updateForm('child', { fullName: e.target.value })} className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Preferred name</label>
              <input value={form.child.preferredName} onChange={e => updateForm('child', { preferredName: e.target.value })} className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Date of birth<Req /></label>
              <input type="date" value={form.child.dateOfBirth} onChange={e => updateForm('child', { dateOfBirth: e.target.value })} className={FIELD_CLS} />
              {age !== null && <p className={HINT_CLS}>{age} years old</p>}
            </div>
            <div>
              <label className={LABEL_CLS}>School</label>
              <input value={form.child.school} onChange={e => updateForm('child', { school: e.target.value })} placeholder="Optional" className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Grade</label>
              <select value={form.child.grade} onChange={e => updateForm('child', { grade: e.target.value })} className={FIELD_CLS}>
                <option value="">Optional</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        )}

        {key === 'allergies' && (
          <div className="space-y-6">
            <NoneField
              label="Food allergies"
              isNone={form.medical.foodAllergyIsNone}
              value={form.medical.foodAllergies}
              onNoneChange={v => updateForm('medical', { foodAllergyIsNone: v })}
              onValueChange={v => updateForm('medical', { foodAllergies: v })}
              placeholder="e.g. Peanuts, dairy"
            />
            {!form.medical.foodAllergyIsNone && form.medical.foodAllergies.trim() && (
              <div>
                <label className={LABEL_CLS}>Severity</label>
                <select value={form.medical.foodAllergySeverity} onChange={e => updateForm('medical', { foodAllergySeverity: e.target.value })} className={FIELD_CLS}>
                  <option value="">Select...</option>
                  {ALLERGY_SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {form.medical.foodAllergySeverity.startsWith('Severe') && (
                  <p className="text-[13px] text-rose-500 mt-1.5">This is flagged to whoever orders food for the session, not just the educator.</p>
                )}
              </div>
            )}
            <NoneField
              label="Environmental or other allergies"
              isNone={form.medical.environmentalAllergyIsNone}
              value={form.medical.environmentalAllergies}
              onNoneChange={v => updateForm('medical', { environmentalAllergyIsNone: v })}
              onValueChange={v => updateForm('medical', { environmentalAllergies: v })}
              placeholder="e.g. Bee stings, pollen"
            />
            <NoneField
              label="Medication allergies"
              isNone={form.medical.medicationAllergyIsNone}
              value={form.medical.medicationAllergies}
              onNoneChange={v => updateForm('medical', { medicationAllergyIsNone: v })}
              onValueChange={v => updateForm('medical', { medicationAllergies: v })}
              placeholder="e.g. Penicillin"
            />
          </div>
        )}

        {key === 'conditions' && (
          <div className="space-y-6">
            <NoneField
              label="Chronic conditions"
              isNone={form.medical.chronicConditionIsNone}
              value={form.medical.chronicConditions}
              onNoneChange={v => updateForm('medical', { chronicConditionIsNone: v })}
              onValueChange={v => updateForm('medical', { chronicConditions: v })}
              placeholder="e.g. Asthma, epilepsy, diabetes"
            />
            <NoneField
              label="Medication taken during session hours"
              isNone={form.medical.medicationDuringSessionIsNone}
              value={form.medical.medicationDuringSession}
              onNoneChange={v => updateForm('medical', { medicationDuringSessionIsNone: v })}
              onValueChange={v => updateForm('medical', { medicationDuringSession: v })}
              placeholder="Name and dosage"
            />
            {!form.medical.medicationDuringSessionIsNone && form.medical.medicationDuringSession.trim() && (
              <div>
                <label className={LABEL_CLS}>Self-administers, or needs assistance?</label>
                <select value={form.medical.selfAdministers} onChange={e => updateForm('medical', { selfAdministers: e.target.value })} className={FIELD_CLS}>
                  <option value="">Select...</option>
                  <option value="Self-administers">Self-administers</option>
                  <option value="Needs staff assistance">Needs staff assistance</option>
                </select>
              </div>
            )}
            <div>
              <label className={LABEL_CLS}>Anything else the educator should know?</label>
              <textarea value={form.medical.educatorNotes} onChange={e => updateForm('medical', { educatorNotes: e.target.value })} rows={2} placeholder="Optional" className={FIELD_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>What helps your child learn comfortably?</label>
              <p className={`${HINT_CLS} mt-0 mb-2`}>For example sensory sensitivities, needing to move around, or preferring written instructions. This helps us set the room up well and isn't recorded as a diagnosis.</p>
              <textarea value={form.medical.supportNeeds} onChange={e => updateForm('medical', { supportNeeds: e.target.value })} rows={2} placeholder="Optional" className={FIELD_CLS} />
            </div>
            <label className="flex items-start gap-3 bg-slate-50 rounded-2xl p-4 cursor-pointer">
              <input type="checkbox" checked={form.medical.emergencyMedicalAuthorised} onChange={e => updateForm('medical', { emergencyMedicalAuthorised: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" />
              <span className="text-[14px] text-slate-700 leading-relaxed">In an emergency, if I cannot be reached, I authorise RAD Academy staff to arrange emergency medical treatment for my child.</span>
            </label>
            {!form.medical.emergencyMedicalAuthorised && (
              <p className="text-[13px] text-amber-600 flex items-start gap-1.5 -mt-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Without this, if we can't reach you and your child needs urgent medical attention, staff won't be able to authorise treatment on your behalf - it may have to wait for you or emergency services. You can still continue without ticking it.
              </p>
            )}
          </div>
        )}

        {key === 'emergency' && (
          <div className="space-y-5">
            <p className="text-[14px] text-slate-500 -mt-2">Someone we can reach if we can't get hold of you.</p>

            {activeChild && activeChild.otherGuardians.length > 0 && (
              <div className="space-y-2">
                {activeChild.otherGuardians.map(g => {
                  const checked = form.emergencyContact.otherGuardiansToContact.some(x => x.id === g.id);
                  return (
                    <label key={g.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl p-4 cursor-pointer">
                      <span className="text-[15px] text-slate-800">
                        Also contact {g.name || `+${g.phone}`} in an emergency
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => updateForm('emergencyContact', {
                          otherGuardiansToContact: e.target.checked
                            ? [...form.emergencyContact.otherGuardiansToContact, { id: g.id, name: g.name || '', phone: g.phone }]
                            : form.emergencyContact.otherGuardiansToContact.filter(x => x.id !== g.id),
                        })}
                        className="h-5 w-5 shrink-0"
                      />
                    </label>
                  );
                })}
                <p className={HINT_CLS}>We'll try you first either way - this just gives us another number to call if we can't reach you.</p>
              </div>
            )}

            {form.emergencyContact.otherGuardiansToContact.length > 0 ? (
              <div className="space-y-2">
                {form.emergencyContact.otherGuardiansToContact.map(g => (
                  <div key={g.id} className="bg-slate-50 rounded-2xl p-4">
                    <div className="text-[15px] font-medium text-slate-800">{g.name || `+${g.phone}`}</div>
                    <div className="text-[14px] text-slate-500 mt-0.5">+{g.phone}</div>
                    <div className="text-[12px] text-slate-400 mt-1">On record as {activeChild?.name || "your child"}'s guardian</div>
                  </div>
                ))}
                <p className={HINT_CLS}>Untick above if you'd rather add someone else's details instead.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className={LABEL_CLS}>Full name<Req /></label>
                  <input value={form.emergencyContact.primary.fullName} onChange={e => updateForm('emergencyContact', { primary: { ...form.emergencyContact.primary, fullName: e.target.value } })} className={FIELD_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Relationship to child<Req /></label>
                  <input value={form.emergencyContact.primary.relationship} onChange={e => updateForm('emergencyContact', { primary: { ...form.emergencyContact.primary, relationship: e.target.value } })} className={FIELD_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Mobile number<Req /></label>
                  <input type="tel" value={form.emergencyContact.primary.mobile} onChange={e => updateForm('emergencyContact', { primary: { ...form.emergencyContact.primary, mobile: e.target.value } })} className={FIELD_CLS} />
                  {emergencyMatchesGuardian && (
                    <p className="text-[13px] text-amber-600 mt-2 flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> This matches your own number - the point of this contact is reachability if you can't be reached. Consider using someone else.</p>
                  )}
                </div>
                <div>
                  <label className={LABEL_CLS}>Alternate number</label>
                  <input type="tel" value={form.emergencyContact.primary.alternate} onChange={e => updateForm('emergencyContact', { primary: { ...form.emergencyContact.primary, alternate: e.target.value } })} placeholder="Optional" className={FIELD_CLS} />
                </div>
              </>
            )}

            <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
              <span className="text-[15px] text-slate-800">Add a second emergency contact</span>
              <Toggle checked={form.emergencyContact.hasSecond} onChange={v => updateForm('emergencyContact', { hasSecond: v })} />
            </div>
            {form.emergencyContact.hasSecond && (
              <div className="space-y-4 pl-4 border-l-2 border-slate-100">
                <div>
                  <label className={LABEL_CLS}>Full name</label>
                  <input value={form.emergencyContact.second.fullName} onChange={e => updateForm('emergencyContact', { second: { ...form.emergencyContact.second, fullName: e.target.value } })} className={FIELD_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Relationship</label>
                  <input value={form.emergencyContact.second.relationship} onChange={e => updateForm('emergencyContact', { second: { ...form.emergencyContact.second, relationship: e.target.value } })} className={FIELD_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Mobile number</label>
                  <input type="tel" value={form.emergencyContact.second.mobile} onChange={e => updateForm('emergencyContact', { second: { ...form.emergencyContact.second, mobile: e.target.value } })} className={FIELD_CLS} />
                </div>
              </div>
            )}
          </div>
        )}

        {key === 'collection' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[15px] font-medium text-slate-800">Who else may collect {activeChild?.name || 'your child'}?</label>
              </div>
              <p className={`${HINT_CLS} mt-0 mb-3`}>Besides you. Leave blank if it's only ever going to be you or the other guardian on record.</p>
              <div className="space-y-2 mb-3">
                {form.collection.authorisedCollectors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-2xl p-3">
                    <input
                      value={c.name}
                      onChange={e => updateForm('collection', { authorisedCollectors: form.collection.authorisedCollectors.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x) })}
                      placeholder="Name"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-base outline-none"
                    />
                    <input
                      value={c.relationship}
                      onChange={e => updateForm('collection', { authorisedCollectors: form.collection.authorisedCollectors.map((x, xi) => xi === i ? { ...x, relationship: e.target.value } : x) })}
                      placeholder="Relationship"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-base outline-none"
                    />
                    <button onClick={() => updateForm('collection', { authorisedCollectors: form.collection.authorisedCollectors.filter((_, xi) => xi !== i) })} className="text-slate-300 hover:text-rose-500 shrink-0"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => updateForm('collection', { authorisedCollectors: [...form.collection.authorisedCollectors, { name: '', relationship: '' }] })}
                className="flex items-center gap-1.5 text-[14px] font-medium text-slate-600"
              >
                <Plus size={15} /> Add someone
              </button>
            </div>

            {needsTravelField && (
              <div>
                <label className={LABEL_CLS}>May travel home unaccompanied?<Req /></label>
                <div className="flex gap-2">
                  {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(o => (
                    <button
                      key={String(o.v)}
                      onClick={() => updateForm('collection', { mayTravelUnaccompanied: o.v })}
                      className={`flex-1 py-3 rounded-2xl text-[15px] font-medium ${form.collection.mayTravelUnaccompanied === o.v ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={LABEL_CLS}>Anyone who must not collect this child?</label>
              <textarea value={form.collection.mustNotCollect} onChange={e => updateForm('collection', { mustNotCollect: e.target.value })} rows={2} placeholder="Optional - kept confidential" className={FIELD_CLS} />
            </div>
          </div>
        )}

        {key === 'photo' && (
          <div className="space-y-5">
            <div className="bg-white border border-indigo-100 rounded-2xl p-4">
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Your answers here make <b>no difference</b> to your child's place, their experience on the day, or anything else. Say no to all of it and nothing changes except which camera we point where.
              </p>
            </div>

            {PHOTO_TIER_GROUPS.map(group => {
              const style = PHOTO_GROUP_STYLES[group.key];
              const GroupIcon = group.key === 'private' ? Lock : group.key === 'paid' ? Megaphone : Video;
              const tiersInGroup = PHOTO_TIERS.filter(t => t.group === group.key);
              return (
                <div key={group.key} className={`rounded-2xl border ${style.border} ${style.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <GroupIcon size={15} className={style.icon} />
                    <h3 className={`text-[13px] font-semibold uppercase tracking-wide ${style.text}`}>{group.label}</h3>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-3">{group.help}</p>
                  <div className="space-y-2">
                    {tiersInGroup.map(t => (
                      <div key={t.key} className="flex items-center justify-between gap-3 bg-white rounded-xl p-3.5">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-slate-800">{t.label}</div>
                          <div className="text-[12px] text-slate-400 mt-0.5">{t.help}</div>
                        </div>
                        <Toggle checked={form.photo[t.key]} onChange={v => updateForm('photo', { [t.key]: v } as any)} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal size={15} className="text-slate-400" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">How They Appear</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3.5">
                  <span className="text-[14px] text-slate-800">My child may be identified by first name</span>
                  <Toggle checked={form.photo.identifyByFirstName} onChange={v => updateForm('photo', { identifyByFirstName: v })} />
                </div>
                <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3.5">
                  <span className="text-[14px] text-slate-800">Group photos only, not as the main subject</span>
                  <Toggle checked={form.photo.groupPhotosOnly} onChange={v => updateForm('photo', { groupPhotosOnly: v })} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquareQuote size={15} className="text-teal-500" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-teal-700">Feedback &amp; Quotes</h3>
              </div>
              <p className="text-[12px] text-slate-500 mb-3">Two separate choices - your child answering is different from us publishing what they said, and only you can agree to the second one.</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3.5">
                  <div className="min-w-0 pr-3">
                    <div className="text-[14px] font-medium text-slate-800">Child completes a feedback form</div>
                    <div className="text-[12px] text-slate-400 mt-0.5">A short form at the end of the session about what they built and how they found it. You'll receive their answers.</div>
                  </div>
                  <Toggle checked={form.photo.feedbackFormConsent} onChange={v => updateForm('photo', { feedbackFormConsent: v })} />
                </div>
                <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3.5">
                  <div className="min-w-0 pr-3">
                    <div className="text-[14px] font-medium text-slate-800">Quote their feedback in marketing</div>
                    <div className="text-[12px] text-slate-400 mt-0.5">Anonymous only - first name never used, no school named.</div>
                  </div>
                  <Toggle checked={form.photo.feedbackQuoteConsent} onChange={v => updateForm('photo', { feedbackQuoteConsent: v })} />
                </div>
              </div>
            </div>

            <p className="text-[13px] text-slate-400 leading-relaxed">
              You can change these permissions any time by reopening this link. We'll remove the image from anything we control within 7 working days - we can't retrieve material already shared or downloaded by others.
            </p>
          </div>
        )}

        {key === 'review' && (
          <div className="space-y-3">
            <ReviewRow label="You" value={`${form.guardian.fullName} · ${form.guardian.relationship}`} onEdit={() => jumpTo('guardian')} show={steps.includes('guardian')} />
            <ReviewRow label="Child" value={`${form.child.fullName}${age !== null ? ` · ${age} yrs` : ''}`} onEdit={() => jumpTo('child')} />
            <ReviewRow
              label="Allergies"
              value={[form.medical.foodAllergyIsNone ? null : form.medical.foodAllergies, form.medical.environmentalAllergyIsNone ? null : form.medical.environmentalAllergies].filter(Boolean).join(', ') || 'None'}
              onEdit={() => jumpTo('allergies')}
            />
            <ReviewRow label="Medical" value={form.medical.chronicConditionIsNone ? 'None' : form.medical.chronicConditions} onEdit={() => jumpTo('conditions')} />
            <ReviewRow label="Emergency contact" value={`${form.emergencyContact.primary.fullName || '—'} · ${form.emergencyContact.primary.mobile || '—'}`} onEdit={() => jumpTo('emergency')} />
            <ReviewRow label="Collection" value={form.collection.authorisedCollectors.length ? `${form.collection.authorisedCollectors.length} extra collector(s)` : 'Guardians only'} onEdit={() => jumpTo('collection')} />
            <ReviewRow
              label="Photo permissions"
              value={Object.entries(form.photo).filter(([k, v]) => v && k.startsWith('tier')).length > 0 ? `${Object.entries(form.photo).filter(([k, v]) => v && k.startsWith('tier')).length} permission(s) given` : 'None given'}
              onEdit={() => jumpTo('photo')}
            />
            {saveError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-3">{saveError}</div>}
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 pb-8 pt-3 max-w-md w-full mx-auto">
        {saveError && key !== 'review' && <div className="mb-3 bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-3">{saveError}</div>}
        <button
          onClick={goNext}
          disabled={!canProceed(key) || saving}
          className="w-full py-4 rounded-2xl text-[16px] font-medium text-white bg-slate-900 disabled:opacity-40 transition-opacity duration-150"
        >
          {saving ? 'Saving…' : key === 'review' ? 'Submit' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  );
}

function ReviewRow({ label, value, onEdit, show = true }: { label: string; value: string; onEdit: () => void; show?: boolean }) {
  if (!show) return null;
  return (
    <button onClick={onEdit} className="w-full flex items-center justify-between gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 text-left">
      <div className="min-w-0">
        <div className="text-[12px] text-slate-400">{label}</div>
        <div className="text-[14px] text-slate-800 truncate">{value}</div>
      </div>
      <Pencil size={14} className="text-slate-300 shrink-0" />
    </button>
  );
}
