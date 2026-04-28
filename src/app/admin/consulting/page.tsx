"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Building2, Search, Plus, Loader2, X, ChevronRight, 
  Phone, Mail, FileText, Briefcase, ArrowLeft, CheckCircle2, AlertTriangle, User
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function ConsultingCRMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  // Toast State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      // 1. Fetch corporate clients
      const { data: clientsData, error: clientsErr } = await supabase
        .from('corporate_clients')
        .select('*')
        .order('company_name', { ascending: true });

      if (clientsErr) throw clientsErr;

      // 2. Fetch outstanding billing records for these clients
      const { data: billingData, error: billingErr } = await supabase
        .from('billing_records')
        .select('corporate_client_id, total_amount, amount_paid, status')
        .not('corporate_client_id', 'is', null)
        .in('status', ['pending', 'overdue', 'partially_paid']);

      if (billingErr) throw billingErr;

      // 3. Map balances to clients
      const balanceMap: Record<string, number> = {};
      (billingData || []).forEach(inv => {
        const amt = Number(inv.total_amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        const outstanding = Math.max(0, amt - paid);
        if (inv.corporate_client_id) {
          balanceMap[inv.corporate_client_id] = (balanceMap[inv.corporate_client_id] || 0) + outstanding;
        }
      });

      const enrichedClients = (clientsData || []).map(client => ({
        ...client,
        outstandingBalance: balanceMap[client.id] || 0
      }));

      setClients(enrichedClients);
    } catch (err: any) {
      console.error("Failed to fetch corporate clients:", err);
      showToast("Failed to load clients.", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim()) {
      return showToast("Company Name and Contact Person are required.", "error");
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('corporate_clients').insert([{
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        vat_number: vatNumber.trim() || null,
        billing_address: billingAddress.trim() || null
      }]);

      if (error) throw error;

      showToast("Corporate client added successfully!", "success");
      setIsAddModalOpen(false);
      
      // Reset Form
      setCompanyName("");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setVatNumber("");
      setBillingAddress("");

      fetchClients();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to add client.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const lowerQ = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.company_name.toLowerCase().includes(lowerQ) || 
      c.contact_person.toLowerCase().includes(lowerQ) ||
      (c.email || "").toLowerCase().includes(lowerQ)
    );
  }, [clients, searchQuery]);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Loading B2B CRM...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-blue-500/30">
      
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.2)]'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-xs md:text-sm font-black uppercase tracking-widest">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-400/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-500">
                <Briefcase size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Consulting_Wing</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">
                B2B <span className="text-blue-500">CRM</span>
              </h1>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <div className="relative w-full md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search companies..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-3.5 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500 shadow-inner"
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 shrink-0"
            >
              <Plus size={16} /> Add Company
            </button>
          </div>
        </header>

        {/* CLIENT DIRECTORY */}
        <div className="space-y-4">
          {filteredClients.length === 0 ? (
            <div className="bg-[#0f172a] border border-dashed border-white/10 rounded-[32px] p-16 text-center space-y-4">
              <div className="w-20 h-20 bg-[#020617] rounded-full flex items-center justify-center mx-auto border border-white/5">
                <Building2 size={32} className="text-blue-500/50" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight italic">No Companies Found</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Your B2B CRM is currently empty or no clients match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map(client => (
                <Link href={`/admin/consulting/${client.id}`} key={client.id}>
                  <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-6 hover:border-blue-500/50 hover:bg-[#131c31] transition-all group flex flex-col h-full shadow-lg relative overflow-hidden">
                    
                    <div className="absolute -right-6 -top-6 p-8 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none"/>
                    
                    <div className="flex items-start justify-between mb-4 relative z-10">
                      <div className="w-12 h-12 bg-[#020617] border border-white/5 rounded-xl flex items-center justify-center text-blue-400 shadow-inner shrink-0">
                        <Building2 size={24} />
                      </div>
                      {client.outstandingBalance > 0 && (
                        <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <AlertTriangle size={10}/> Due: R {client.outstandingBalance.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <h3 className="text-xl font-black text-white leading-tight mb-1 relative z-10 line-clamp-1">{client.company_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 relative z-10 flex items-center gap-1.5">
                      <User size={12}/> {client.contact_person}
                    </p>

                    <div className="space-y-2 mt-auto relative z-10 border-t border-white/5 pt-4">
                      {client.email && (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                          <Mail size={14} className="text-slate-500 shrink-0"/> <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                          <Phone size={14} className="text-slate-500 shrink-0"/> <span>{client.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-6 right-6 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all z-10 shadow-sm">
                      <ChevronRight size={16} />
                    </div>

                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD CLIENT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-widest text-white leading-none">New Corporate Client</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">B2B Consulting CRM</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              </div>
              
              <form onSubmit={handleAddClient} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name *</label>
                    <input 
                      type="text" 
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><User size={12}/> Contact Person *</label>
                    <input 
                      type="text" 
                      required
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FileText size={12}/> VAT Number</label>
                    <input 
                      type="text" 
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Mail size={12}/> Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@acme.com"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Phone size={12}/> Phone Number</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 082 123 4567"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Address</label>
                    <textarea 
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="Physical address for invoicing..."
                      rows={3}
                      className="w-full bg-[#020617] border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner resize-none placeholder:text-slate-600 custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3.5 bg-white/5 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Save Company
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}