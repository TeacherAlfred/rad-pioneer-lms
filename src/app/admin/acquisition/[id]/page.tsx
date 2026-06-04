'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, Globe, Calendar, 
  MessageSquare, Clock, CheckCircle2, ChevronRight, Save, 
  Activity, Flame, Snowflake, Loader2, Edit2, X, CheckSquare, Copy, Timer,
  Target, AlertTriangle, PlusCircle, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';
const METHODS = ['WhatsApp', 'Email', 'Phone Call', 'LinkedIn', 'In-Person'];
const SOURCES = ['LinkedIn', 'Meta Ad', 'Referral', 'Website', 'Cold Outreach', 'Event', 'Other'];

const getLocalDatetimeStr = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export default function LeadDeepDive() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  // Edit State
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState<any>({});

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    status: 'Completed',
    method: 'WhatsApp',
    date: getLocalDatetimeStr(), 
    content_draft: '',
    outcome: ''
  });

  // --- PROVISIONING WIZARD STATE ---
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisionStep, setProvisionStep] = useState<'loading' | 'duplicates' | 'children'>('loading');
  const [duplicateProfiles, setDuplicateProfiles] = useState<any[]>([]);
  const [linkedParentId, setLinkedParentId] = useState<string | null>(null);
  const [childrenForm, setChildrenForm] = useState([{ name: '', username: '', pin: '' }]);
  const [isProvisioning, setIsProvisioning] = useState(false);

  useEffect(() => {
    if (leadId) fetchLeadData();
  }, [leadId]);

  async function fetchLeadData() {
    setLoading(true);
    try {
      const { data: leadData, error: leadError } = await supabase
        .from('growth_leads')
        .select('*')
        .eq('id', leadId)
        .eq('admin_id', MY_ADMIN_ID)
        .single();
      
      if (leadError) throw leadError;
      
      if (!leadData.workflow_state) leadData.workflow_state = {};
      setLead(leadData);

      const { data: intData } = await supabase
        .from('growth_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('planned_date', { ascending: false });

      setInteractions(intData || []);
    } catch (err) {
      console.error(err);
      router.push('/admin/acquisition');
    } finally {
      setLoading(false);
    }
  }

  // --- PROVISIONING WIZARD LOGIC ---
  const handleOpenProvisioning = async () => {
    setIsProvisionModalOpen(true);
    
    // If already linked, skip straight to adding children
    if (lead.converted_profile_id) {
      setLinkedParentId(lead.converted_profile_id);
      setProvisionStep('children');
      return;
    }

    setProvisionStep('loading');

    // Fuzzy search for duplicates using the first name
    const firstName = lead.full_name.split(' ')[0];
    const { data: duplicates } = await supabase
      .from('profiles')
      .select('id, display_name, metadata, created_at')
      .eq('role', 'guardian')
      .ilike('display_name', `%${firstName}%`);

    if (duplicates && duplicates.length > 0) {
      setDuplicateProfiles(duplicates);
      setProvisionStep('duplicates');
    } else {
      // No duplicates, auto-create parent
      await handleCreateNewParent();
    }
  };

  const handleCreateNewParent = async () => {
    setIsProvisioning(true);
    try {
      const { data: newParent, error } = await supabase.from('profiles').insert({
        role: 'guardian',
        display_name: lead.full_name,
        metadata: { email: lead.email, phone: lead.contact_number },
        lead_source: 'acquisition_engine',
        status: 'active',
        account_tier: 'none' // <--- ADD THIS LINE
      }).select('id').single();

      if (error) throw error;

      await attachParentToLead(newParent.id);
    } catch (err: any) {
      alert("Error creating parent: " + err.message);
      setIsProvisionModalOpen(false);
    } finally {
      setIsProvisioning(false);
    }
  };

  const attachParentToLead = async (profileId: string) => {
    await supabase.from('growth_leads').update({ converted_profile_id: profileId }).eq('id', lead.id);
    setLead({ ...lead, converted_profile_id: profileId });
    setLinkedParentId(profileId);
    setProvisionStep('children');
  };

  const handleSaveChildren = async () => {
    // Validate
    if (childrenForm.some(c => !c.name || !c.username || !c.pin)) {
      return alert("Please fill in all child details.");
    }

    setIsProvisioning(true);
    try {
      const payloads = childrenForm.map(c => ({
        role: 'student',
        display_name: c.name,
        student_identifier: c.username,
        temp_entry_pin: c.pin,
        linked_parent_id: linkedParentId,
        account_tier: 'lms_trial',
        status: 'active'
      }));

      const { error } = await supabase.from('profiles').insert(payloads);
      
      if (error) {
        if (error.message.includes('unique')) throw new Error("One of the chosen usernames is already taken! Please pick another one.");
        throw error;
      }

      // Update lead kids count
      await supabase.from('growth_leads').update({ kids_count: lead.kids_count + payloads.length }).eq('id', lead.id);
      
      // Auto-check SOP step 3 if not done
      if (!lead.workflow_state?.lms_provisioned) {
        await handleToggleSopStep('lms_provisioned');
      }

      setIsProvisionModalOpen(false);
      setChildrenForm([{ name: '', username: '', pin: '' }]); // Reset
      fetchLeadData(); // Refresh UI
      alert("Successfully provisioned child accounts!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProvisioning(false);
    }
  };


  // --- SOP LOGIC ---
  const handleToggleSopStep = async (stepKey: string) => {
    const currentState = lead.workflow_state || {};
    const isCurrentlyDone = !!currentState[stepKey];
    const newState = { ...currentState, [stepKey]: isCurrentlyDone ? false : new Date().toISOString() };
    setLead({ ...lead, workflow_state: newState });
    try { await supabase.from('growth_leads').update({ workflow_state: newState }).eq('id', leadId); } 
    catch (err) { console.error("Failed to update SOP state"); }
  };

  const copyToClipboard = (text: string, id: string) => {
    let parsedText = text.replace(/\[Parent\]/g, lead.full_name.split(' ')[0] || 'there');
    navigator.clipboard.writeText(parsedText);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const calculateDaysRemaining = () => {
    if (!lead?.workflow_state?.handover_complete) return null;
    const expiryDate = new Date(lead.workflow_state.handover_complete);
    expiryDate.setDate(expiryDate.getDate() + 14); 
    const diffTime = Math.abs(expiryDate.getTime() - new Date().getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return expiryDate > new Date() ? diffDays : 0;
  };

  const trialDaysLeft = calculateDaysRemaining();

  // --- STANDARD HANDLERS ---
  const toggleEditLead = () => {
    if (!isEditingLead) setEditLeadForm(lead);
    setIsEditingLead(!isEditingLead);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLead(true);
    try {
      const { error } = await supabase.from('growth_leads').update(editLeadForm).eq('id', leadId);
      if (error) throw error;
      setLead({ ...lead, ...editLeadForm });
      setIsEditingLead(false);
    } catch (err: any) { alert(err.message); } finally { setIsSavingLead(false); }
  };

  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isCompleted = interactionForm.status === 'Completed';
      const payload = {
        lead_id: leadId, admin_id: MY_ADMIN_ID,
        planned_date: new Date(interactionForm.date).toISOString(),
        actual_date: isCompleted ? new Date(interactionForm.date).toISOString() : null,
        contact_method: interactionForm.method,
        content_draft: interactionForm.content_draft,
        outcome: isCompleted ? interactionForm.outcome : null,
        status: interactionForm.status,
        lead_stage: lead.stage
      };
      const { error } = await supabase.from('growth_interactions').insert([payload]);
      if (error) throw error;
      setInteractionForm({ status: 'Completed', method: 'WhatsApp', date: getLocalDatetimeStr(), content_draft: '', outcome: '' });
      fetchLeadData();
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const handleMarkAsCompleted = async (interactionId: string) => {
    try {
      await supabase.from('growth_interactions').update({ status: 'Completed', actual_date: new Date().toISOString() }).eq('id', interactionId);
      fetchLeadData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-black uppercase tracking-widest text-xs animate-pulse">Accessing Profile...</div>;
  if (!lead) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 overflow-x-hidden font-sans selection:bg-fuchsia-500/30">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/acquisition" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-fuchsia-400 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-fuchsia-600 transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Pipeline Dashboard</span>
            </Link>
            <div>
              <div className="flex items-center gap-2 text-fuchsia-600 mb-2">
                <Target size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Lead Profile</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic text-slate-900 flex items-center gap-4">
                {lead.full_name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
             <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stage:</span>
               <span className="text-xs font-black uppercase tracking-widest text-fuchsia-600">{lead.stage}</span>
             </div>
             <button onClick={handleOpenProvisioning} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                {lead.converted_profile_id ? 'Add Children' : 'Convert to Profile'} <ChevronRight size={14}/>
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT PANEL: STATIC INFO & SOP */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* STATIC INFO */}
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm transition-all">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Static Intelligence</h3>
                <button onClick={toggleEditLead} className={`p-2 rounded-full transition-colors border ${isEditingLead ? 'bg-slate-100 text-slate-900 border-slate-200' : 'bg-slate-50 hover:bg-fuchsia-50 text-slate-400 hover:text-fuchsia-600 border-transparent hover:border-fuchsia-200'}`}>
                  {isEditingLead ? <X size={14}/> : <Edit2 size={14}/>}
                </button>
              </div>
              {!isEditingLead ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Mail size={16}/></div><div className="overflow-hidden"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</p><p className="text-sm font-bold text-slate-900 truncate">{lead.email || 'Not Provided'}</p></div></div>
                  <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Phone size={16}/></div><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Number</p><p className="text-sm font-bold text-slate-900">{lead.contact_number || 'Not Provided'}</p></div></div>
                  <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200"><MapPin size={16}/></div><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p><p className="text-sm font-bold text-slate-900">{lead.location || 'Unknown'}</p></div></div>
                  {lead.converted_profile_id && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={14}/> Linked to Parent Profile
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleUpdateLead} className="space-y-4">
                  <div className="pt-4"><button type="submit" disabled={isSavingLead} className="w-full py-3 bg-fuchsia-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md shadow-fuchsia-600/20">{isSavingLead ? 'SAVING...' : 'SAVE CHANGES'}</button></div>
                </form>
              )}
            </div>
            
            {/* THE SOP WORKFLOW ENGINE */}
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
               <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2"><CheckSquare size={16} className="text-fuchsia-500"/> Trial LMS SOP</h3>
                 {trialDaysLeft !== null && (
                   <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1 ${trialDaysLeft > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 animate-pulse'}`}>
                     <Timer size={12}/> {trialDaysLeft > 0 ? `${trialDaysLeft} Days Left` : 'TRIAL EXPIRED'}
                   </span>
                 )}
               </div>

               <div className="space-y-4">
                 <SopItem title="1. First Contact (FOMO)" isDone={lead.workflow_state?.first_contact} onToggle={() => handleToggleSopStep('first_contact')} script="Hi [Parent]! I’m finalizing the robotics trial licenses for this term—did you still want your child to have a spot for the final week? Let me know!" copiedId={copiedScript} onCopy={copyToClipboard} id="script_1" />
                 <SopItem title="2. Details Captured" isDone={lead.workflow_state?.details_captured} onToggle={() => handleToggleSopStep('details_captured')} />
                 <SopItem title="3. LMS Provisioning Done" isDone={lead.workflow_state?.lms_provisioned} onToggle={() => handleToggleSopStep('lms_provisioned')} />
                 <SopItem title="4. Handover & Trial Start" isDone={lead.workflow_state?.handover_complete} onToggle={() => handleToggleSopStep('handover_complete')} script="Great! To make sure they aren't lost on the platform, I do a 5-min 'Getting Started' call to set them up for success. I have two slots open tomorrow—would you prefer 10 AM or 2 PM?" copiedId={copiedScript} onCopy={copyToClipboard} id="script_4" />
                 
                 <div className="h-px bg-slate-100 my-4" />
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">The Trial Cadence</p>

                 <SopItem title="5. Day 1: Check-in" isDone={lead.workflow_state?.day_1_check} onToggle={() => handleToggleSopStep('day_1_check')} script="Hi [Parent], just checking if you managed to log in successfully and try the first task? Let me know if you need any help navigating!" copiedId={copiedScript} onCopy={copyToClipboard} id="script_5" />
                 <SopItem title="6. Day 4: Soft Upsell" isDone={lead.workflow_state?.day_4_upsell} onToggle={() => handleToggleSopStep('day_4_upsell')} />
                 <SopItem title="7. Day 12: Handoff Prep" isDone={lead.workflow_state?.day_12_handoff} onToggle={() => handleToggleSopStep('day_12_handoff')} script="Hi [Parent], the trial officially wraps up in 48 hours! Let’s hop on a quick 5-min call tomorrow to discuss how they found it and what the next steps look like." copiedId={copiedScript} onCopy={copyToClipboard} id="script_7" />

                 <div className="h-px bg-slate-100 my-4" />
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Post-Trial Crossroads</p>
                 
                 <div className="grid grid-cols-2 gap-2 mt-2">
                   <button className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-200 transition-colors">Mark Lost (Offload)</button>
                   <button className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 transition-colors">Mark Won (Upgrade)</button>
                 </div>
               </div>
            </div>
          </div>

          {/* RIGHT PANEL: INTERACTION TIMELINE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                 <button onClick={() => setInteractionForm({...interactionForm, status: 'Completed'})} className={`text-xs font-black uppercase tracking-widest pb-4 border-b-2 transition-colors ${interactionForm.status === 'Completed' ? 'border-fuchsia-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Log Past Contact</button>
                 <button onClick={() => setInteractionForm({...interactionForm, status: 'Planned'})} className={`text-xs font-black uppercase tracking-widest pb-4 border-b-2 transition-colors ${interactionForm.status === 'Planned' ? 'border-blue-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Schedule Future</button>
              </div>

              <form onSubmit={handleSaveInteraction} className="space-y-5" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Contact Method</label>
                    <select value={interactionForm.method} onChange={e => setInteractionForm({...interactionForm, method: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500">
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{interactionForm.status === 'Completed' ? 'Date Contacted' : 'Scheduled For'}</label>
                    <input type="datetime-local" required value={interactionForm.date} onChange={e => setInteractionForm({...interactionForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{interactionForm.status === 'Completed' ? 'Message Sent / Discussion Notes' : 'Draft Message / Talking Points'}</label>
                  <textarea rows={3} required value={interactionForm.content_draft} onChange={e => setInteractionForm({...interactionForm, content_draft: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-fuchsia-500" placeholder="Type notes here..." />
                </div>

                {interactionForm.status === 'Completed' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Outcome / Result</label>
                    <textarea rows={2} name="interaction_outcome_notes" data-lpignore="true" value={interactionForm.outcome} onChange={e => setInteractionForm({...interactionForm, outcome: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" placeholder="Optional outcome notes..." />
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button type="submit" disabled={isSubmitting} className={`px-8 py-3.5 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 ${interactionForm.status === 'Completed' ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : interactionForm.status === 'Completed' ? <CheckCircle2 size={14}/> : <Calendar size={14}/>} 
                    {interactionForm.status === 'Completed' ? 'Log Interaction' : 'Schedule Action'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4 pl-4 relative">
              <div className="absolute left-[39px] top-4 bottom-4 w-px bg-slate-200 z-0" />
              {interactions.map((interaction) => (
                <div key={interaction.id} className="relative z-10 flex gap-6 group">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 shadow-sm transition-transform group-hover:scale-110 ${interaction.status === 'Completed' ? 'bg-white border-emerald-500 text-emerald-600' : 'bg-slate-50 border-blue-300 text-blue-500'}`}>
                    {interaction.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${interaction.status === 'Completed' ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {interaction.status === 'Completed' ? 'Executed' : 'Scheduled'}
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{interaction.contact_method}</span>
                          <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[8px]">Stage: {interaction.lead_stage || 'Unknown'}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          {new Date(interaction.planned_date).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      {interaction.status === 'Planned' && (
                        <button onClick={() => handleMarkAsCompleted(interaction.id)} className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border border-emerald-100">
                          Mark Done
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-3">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{interaction.content_draft}</p>
                    </div>
                    {interaction.outcome && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5 shrink-0">Outcome:</span>
                        <span className="font-bold text-slate-800">{interaction.outcome}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PROVISIONING WIZARD MODAL */}
      <AnimatePresence>
        {isProvisionModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProvisionModalOpen(false)} />
            
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
              
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Provision Account</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Convert Lead to Profile & Add Children</p>
                </div>
                <button onClick={() => setIsProvisionModalOpen(false)} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200"><X size={16}/></button>
              </div>

              {/* STEP 1: Loading */}
              {provisionStep === 'loading' && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <Loader2 size={32} className="animate-spin text-fuchsia-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Checking for duplicate profiles...</p>
                </div>
              )}

              {/* STEP 2: Resolve Duplicates */}
              {provisionStep === 'duplicates' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
                    <AlertTriangle size={20} className="shrink-0 text-amber-500" />
                    <div>
                      <h4 className="font-bold text-sm">Similar Profiles Found</h4>
                      <p className="text-xs mt-1">We found existing profiles with similar names. Did this parent register manually? If so, select them below to link them to this lead instead of creating a duplicate.</p>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {duplicateProfiles.map(p => {
                      const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-fuchsia-300 transition-colors">
                          <div>
                            <p className="font-bold text-slate-900">{p.display_name}</p>
                            <p className="text-xs text-slate-500 mt-1">{meta.phone || 'No phone'} • {meta.email || 'No email'}</p>
                          </div>
                          <button onClick={() => attachParentToLead(p.id)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-600 transition-colors">
                            Link Profile
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex justify-end">
                    <button onClick={handleCreateNewParent} disabled={isProvisioning} className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                      {isProvisioning ? <Loader2 size={14} className="animate-spin"/> : null} None of these, create new Parent
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Add Children */}
              {provisionStep === 'children' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800">
                    <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
                    <span className="font-bold text-sm">Parent profile securely linked! Now, let's add their kids.</span>
                  </div>

                  <div className="space-y-6">
                    {childrenForm.map((child, index) => (
                      <div key={index} className="relative p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Child {index + 1}</h4>
                          {childrenForm.length > 1 && (
                            <button onClick={() => setChildrenForm(childrenForm.filter((_, i) => i !== index))} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                          <input type="text" value={child.name} onChange={e => { const newF = [...childrenForm]; newF[index].name = e.target.value; setChildrenForm(newF); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" placeholder="e.g., Liam Molepo" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">LMS Username</label>
                            <input type="text" value={child.username} onChange={e => { const newF = [...childrenForm]; newF[index].username = e.target.value.toLowerCase().replace(/\s+/g, ''); setChildrenForm(newF); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" placeholder="liam_m" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Login PIN (4 Digits)</label>
                            <input type="text" maxLength={4} value={child.pin} onChange={e => { const newF = [...childrenForm]; newF[index].pin = e.target.value.replace(/\D/g, ''); setChildrenForm(newF); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 text-center tracking-[0.5em]" placeholder="1234" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button onClick={() => setChildrenForm([...childrenForm, { name: '', username: '', pin: '' }])} className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1.5 px-4 py-2 hover:bg-fuchsia-50 rounded-lg transition-colors">
                      <PlusCircle size={14}/> Add Another Child
                    </button>
                    <button onClick={handleSaveChildren} disabled={isProvisioning} className="px-8 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-fuchsia-600/20 disabled:opacity-50">
                      {isProvisioning ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Provision Accounts
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini Component for the SOP Items
function SopItem({ title, isDone, onToggle, script, copiedId, onCopy, id }: any) {
  return (
    <div className={`p-3 rounded-xl border transition-colors ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer group flex-1">
          <div className="relative flex items-center justify-center">
            <input type="checkbox" checked={isDone || false} onChange={onToggle} className="peer sr-only" />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-fuchsia-400'}`}>
              <CheckCircle2 size={12} className={`text-white transition-opacity ${isDone ? 'opacity-100' : 'opacity-0'}`} />
            </div>
          </div>
          <span className={`text-xs font-bold transition-colors ${isDone ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{title}</span>
        </label>
        {script && !isDone && (
          <button onClick={() => onCopy(script, id)} className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-fuchsia-600 hover:border-fuchsia-200 transition-colors" title="Copy Template">
            {copiedId === id ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Copy size={14} />}
          </button>
        )}
      </div>
      {script && !isDone && (
        <div className="mt-3 ml-8 text-[10px] text-slate-500 bg-white border border-slate-100 p-2 rounded-lg italic">
          "{script}"
        </div>
      )}
    </div>
  );
}