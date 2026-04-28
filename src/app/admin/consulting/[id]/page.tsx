"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Building2, User, Phone, Mail, FileText, BarChart3,
  Receipt, Plus, MessageSquare, Download, AlertTriangle, 
  CheckCircle2, Clock, Loader2, ArrowRight, Wallet
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function CorporateClientProfile() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [billingRecords, setBillingRecords] = useState<any[]>([]);
  const [adminName, setAdminName] = useState<string>("Admin");

  useEffect(() => {
    if (clientId) fetchClientData();
  }, [clientId]);

  async function fetchClientData() {
    try {
      // 1. Get Logged In Admin
      const sessionData = localStorage.getItem("pioneer_session");
      if (sessionData) {
        const localUser = JSON.parse(sessionData);
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', localUser.id).single();
        if (profile) setAdminName(profile.display_name.split(' ')[0]);
      }

      // 2. Fetch Corporate Client
      const { data: client, error: clientErr } = await supabase
        .from('corporate_clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientErr) throw clientErr;
      setClientData(client);

      // 3. Fetch Billing Records (Invoices & Quotes)
      const { data: records, error: recordsErr } = await supabase
        .from('billing_records')
        .select('*')
        .eq('corporate_client_id', clientId)
        .order('created_at', { ascending: false });

      if (recordsErr) throw recordsErr;
      setBillingRecords(records || []);

    } catch (err) {
      console.error("Failed to load corporate profile:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- Financial Math ---
  const { outstandingBalance, lifetimeInvoiced } = useMemo(() => {
    let outstanding = 0;
    let lifetime = 0;

    billingRecords.forEach(rec => {
      if (rec.doc_type === 'invoice') {
        const amt = Number(rec.total_amount) || 0;
        const paid = Number(rec.amount_paid) || 0;
        lifetime += amt;
        
        if (['pending', 'overdue', 'partially_paid'].includes(rec.status)) {
          outstanding += Math.max(0, amt - paid);
        }
      }
    });

    return { outstandingBalance: outstanding, lifetimeInvoiced: lifetime };
  }, [billingRecords]);

  // --- WhatsApp Statement Action ---
  const handleSendStatement = async () => {
    const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    const amountStr = `R ${outstandingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // We will build this B2B statement route next!
    const link = `${window.location.origin}/statement/b2b/${clientId}`;
    
    const msg = `Dear ${clientData.contact_person.split(' ')[0]},\n\nPlease find a link to your latest statement for ${clientData.company_name} as of ${today}, showing an outstanding balance of ${amountStr}.\n\nView Statement: ${link}\n\nLet us know if you have any questions.\n\nRegards,\nRAD Academy Team`;
    
    let phoneParam = "";
    if (clientData.phone) {
        let cleanPhone = clientData.phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '27' + cleanPhone.substring(1);
        phoneParam = cleanPhone;
    }
    
    window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`, '_blank');

    // Audit log
    try {
      const currentMeta = clientData.metadata || {};
      currentMeta.last_statement_sent = {
        date: today,
        amount: amountStr,
        admin: adminName
      };
      await supabase.from('corporate_clients').update({ metadata: currentMeta }).eq('id', clientId);
      setClientData({ ...clientData, metadata: currentMeta });
    } catch (err) {
      console.error("Audit log failed", err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Retrieving Client Ledger...</p>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 text-white">
        <AlertTriangle className="text-rose-500" size={48} />
        <h2 className="text-2xl font-black uppercase italic">Client Not Found</h2>
        <Link href="/admin/consulting" className="text-blue-400 hover:text-blue-300 underline text-sm font-bold">Return to CRM</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-blue-500/30 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER & BACK BUTTON */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
          <div className="space-y-4">
            <Link href="/admin/consulting" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-400/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">B2B Directory</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-500">
                <Building2 size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Corporate_Profile</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">
                {clientData.company_name}
              </h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* These buttons will route to the updated generator in our next step */}
            <Link 
              href={`/admin/finance/generator?client_id=${clientId}&type=quote`}
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <FileText size={14} /> New Quote
            </Link>
            <Link 
              href={`/admin/finance/generator?client_id=${clientId}&type=invoice`}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 shrink-0"
            >
              <Receipt size={14} /> Create Invoice
            </Link>
          </div>
        </header>

        {/* TOP ROW: DETAILS & METRICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Client Details Card */}
          <div className="lg:col-span-4 bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
              <Building2 size={200} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-white/5 pb-4">Contact Information</h3>
            
            <div className="space-y-5 relative z-10">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Primary Contact</p>
                <p className="text-lg font-bold text-white flex items-center gap-2"><User size={16} className="text-blue-400"/> {clientData.contact_person}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Email</p>
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2"><Mail size={14} className="text-slate-400"/> {clientData.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {clientData.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">VAT Number</p>
                <p className="text-sm font-medium text-slate-300 font-mono">{clientData.vat_number || 'Not Provided'}</p>
              </div>
              {clientData.billing_address && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Billing Address</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed whitespace-pre-wrap">{clientData.billing_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Metrics */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-xl flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><Wallet size={20} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding Balance</p>
              </div>
              <p className={`text-5xl font-black italic tracking-tighter mb-8 ${outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                R {outstandingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              
              <div className="mt-auto pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                {clientData.metadata?.last_statement_sent && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    Statement sent {clientData.metadata.last_statement_sent.date}
                  </p>
                )}
                <button 
                  onClick={handleSendStatement}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ml-auto"
                >
                  <MessageSquare size={14}/> Send Statement
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-[#0f172a] border border-blue-500/20 rounded-[32px] p-8 shadow-inner flex flex-col justify-center relative overflow-hidden">
               <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><BarChart3 size={20} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Lifetime Billed (Invoiced)</p>
              </div>
              <p className="text-4xl font-black text-white italic tracking-tighter relative z-10 mb-2">
                R {lifetimeInvoiced.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest relative z-10">Total historical revenue generated</p>
              
              <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none">
                <BarChart3 size={200} />
              </div>
            </div>

          </div>
        </div>

        {/* DOCUMENTS TABLE */}
        <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <FileText size={16} className="text-blue-500"/> Document Ledger
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#020617] text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Document</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {billingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-bold italic text-xs">
                      No invoices or quotes generated yet.
                    </td>
                  </tr>
                ) : (
                  billingRecords.map(doc => {
                    const isQuote = doc.doc_type === 'quote';
                    const docNumber = isQuote ? `QUO-${doc.quote_number}` : `INV-${doc.invoice_number}`;
                    const amount = Number(doc.total_amount) || 0;
                    
                    const desc = doc.line_items && doc.line_items.length > 0 
                      ? doc.line_items[0].desc || doc.line_items[0].description 
                      : 'Consulting Services';

                    const statusColors: any = {
                      paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      settled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      pending: isQuote ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                      partially_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                      declined: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    };
                    const colorClass = statusColors[doc.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

                    return (
                      <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5 text-xs font-bold text-slate-400">
                          {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            {isQuote ? <FileText size={14} className="text-blue-500"/> : <Receipt size={14} className="text-emerald-500"/>}
                            <span className="font-black text-white">{docNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs text-slate-300 truncate max-w-[200px]">
                          {desc}
                        </td>
                        <td className="px-6 py-5 text-right font-black text-white">
                          R {amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${colorClass}`}>
                            {doc.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Link 
                            href={isQuote ? `/quote/${doc.id}` : `/invoice/${doc.id}`}
                            target="_blank"
                            className="inline-flex p-2 bg-white/5 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg border border-white/5 transition-all shadow-sm group-hover:border-blue-500/30"
                            title="View Document"
                          >
                            <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}