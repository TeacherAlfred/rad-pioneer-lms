"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Trash2, Save, Send, User, ArrowRight,
  Search, Package, Calculator, ArrowLeft, ChevronDown, Eye, X, Shield, Printer, CreditCard, Loader2, Calendar, FileText, Download 
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import RADBillingDocument from "@/components/finance/RADBillingDocument";


export default function BillingComposerPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>}>
      <BillingComposer />
    </Suspense>
  );
}

function BillingComposer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialLeadId = searchParams.get('leadId');
  const prospectName = searchParams.get('prospectName');
  const prospectEmail = searchParams.get('prospectEmail');
  const convertFromQuoteId = searchParams.get('convertFromQuote'); // NEW: Catch Quote to Invoice conversions
  const initialType = (searchParams.get('mode') as 'invoice' | 'quote') || (searchParams.get('type') as 'invoice' | 'quote') || 'invoice';

  const [docType, setDocType] = useState<'invoice' | 'quote'>(initialType);
  const [expiryDate, setExpiryDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isIframe, setIsIframe] = useState(false);

  const [dbItems, setDbItems] = useState<any[]>([]);
  const [nextInvNum, setNextInvNum] = useState(1100);

  const [guardianSearch, setGuardianSearch] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<any>(null);
  const [suggestedGuardians, setSuggestedGuardians] = useState<any[]>([]);

  const [lineItems, setLineItems] = useState<any[]>([{ desc: '', note: '', qty: 1, price: 0, disc: 0 }]);
  const [globalDisc, setGlobalDisc] = useState(0);
  const [globalNote, setGlobalNote] = useState("");

  const subTotal = lineItems.reduce((acc, item) => acc + (Number(item.qty) * Number(item.price)), 0);
  const lineItemTotalDisc = lineItems.reduce((acc, item) => {
    const validDisc = Math.max(0, Number(item.disc));
    return acc + (Number(item.qty) * Number(item.price) * (validDisc / 100));
  }, 0);
  const subAfterLineDisc = subTotal - lineItemTotalDisc;
  const validGlobalDisc = Math.max(0, Number(globalDisc));
  const globalDiscAmount = subAfterLineDisc * (validGlobalDisc / 100);
  const grandTotal = subAfterLineDisc - globalDiscAmount;

  const currentYear = new Date().getFullYear();
  const paymentReference = `${currentYear}${nextInvNum}`;
  const docReference = `${docType === 'quote' ? 'QT' : 'INV'}-${nextInvNum}`;

  useEffect(() => {
    setIsIframe(window.self !== window.top);
    fetchInitialData();
    
    // --- NEW: Handle Quote to Invoice Conversion Logic ---
    if (convertFromQuoteId) {
        fetchQuoteToConvert(convertFromQuoteId);
    } else if (initialLeadId) {
      fetchSpecificLead(initialLeadId);
    } else if (prospectName) {
      setSelectedGuardian({
        id: `prospect-${Date.now()}`,
        display_name: prospectName,
        email: prospectEmail || "",
        metadata: { email: prospectEmail }
      });
    }
    
    if (initialType === 'quote' && !convertFromQuoteId) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        setExpiryDate(nextWeek.toISOString().split('T')[0]);
    }
  }, [initialLeadId, prospectName, prospectEmail, initialType, convertFromQuoteId]);

  useEffect(() => {
    if (guardianSearch.length > 2) {
      const searchGuardians = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, metadata')
          .ilike('display_name', `%${guardianSearch}%`)
          .limit(5);
        if (data) setSuggestedGuardians(data);
      };
      searchGuardians();
    } else {
      setSuggestedGuardians([]);
    }
  }, [guardianSearch]);

  async function fetchInitialData() {
    const { data: items } = await supabase.from('billing_items').select('*').eq('is_active', true);
    if (items) setDbItems(items);

    const { data: lastRec } = await supabase
      .from('billing_records')
      .select('invoice_number')
      .order('invoice_number', { ascending: false })
      .limit(1);

    if (lastRec && lastRec.length > 0) {
      setNextInvNum(lastRec[0].invoice_number + 1);
    }
  }

  async function fetchSpecificLead(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setSelectedGuardian(data);
  }

  // --- NEW: Fetch Quote to Pre-fill Composer ---
  async function fetchQuoteToConvert(quoteId: string) {
     const { data: quote } = await supabase.from('billing_records').select('*, profiles(*)').eq('id', quoteId).single();
     if (quote) {
        setDocType('invoice'); // Force it to invoice
        setLineItems(quote.line_items || []);
        setGlobalNote(quote.metadata?.global_note || '');
        if (quote.profiles) {
            setSelectedGuardian(quote.profiles);
        }
        
        // Give the new invoice a default 7-day payment term
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        setExpiryDate(nextWeek.toISOString().split('T')[0]);
     }
  }

  // --- UPDATED: Multi-Action Finalize (Email or PDF) ---
  const handleFinalize = async (action: 'email' | 'pdf') => {
    if (!selectedGuardian) return alert("Select a recipient first.");
    
    setIsProcessing(true);
    try {
      const isTempProspect = selectedGuardian.id?.toString().startsWith('prospect-');
      const dbGuardianId = isTempProspect ? null : selectedGuardian.id;

      const metadataToSave: any = { 
        global_note: globalNote,
        prospect_name: isTempProspect ? selectedGuardian.display_name : null,
        prospect_email: isTempProspect ? selectedGuardian.email : null
      };

      // --- NEW: Leave breadcrumb if converting from quote ---
      if (convertFromQuoteId) {
          metadataToSave.converted_from_quote = convertFromQuoteId;
      }

      // 1. Save the Document to the Database
      const { data: newRecord, error: dbError } = await supabase
        .from('billing_records')
        .insert({
          invoice_number: nextInvNum,
          payment_reference: paymentReference,
          guardian_id: dbGuardianId, 
          total_amount: grandTotal,
          line_items: lineItems,
          status: 'pending',
          doc_type: docType,
          expires_at: docType === 'quote' || docType === 'invoice' ? expiryDate : null,
          metadata: metadataToSave
        })
        .select('id') 
        .single();

      if (dbError) throw dbError;

      // Update old quote status if converting
      if (convertFromQuoteId) {
          const { data: oldQuote } = await supabase.from('billing_records').select('metadata').eq('id', convertFromQuoteId).single();
          if (oldQuote) {
              await supabase.from('billing_records').update({
                  metadata: { ...oldQuote.metadata, converted_to_invoice: true }
              }).eq('id', convertFromQuoteId);
          }
      }

      // 2. Execute the requested action (Email or PDF Download)
      if (action === 'email') {
          const templateSlug = docType === 'invoice' ? 'billing_invoice' : 'billing_quote';
          const { data: templateData } = await supabase.from('email_templates').select('body_content').eq('slug', templateSlug).single();

          let finalHtml = templateData?.body_content || document.getElementById('preview-content')?.innerHTML || "";
          finalHtml = finalHtml.replace(/\{\{baseUrl\}\}/g, window.location.origin);
          finalHtml = finalHtml.replace(/\{\{docId\}\}/g, newRecord.id);

          const res = await fetch('/api/send-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipients: [{
                email: selectedGuardian.metadata?.email || selectedGuardian.email,
                invNum: nextInvNum.toString(),
                total: grandTotal.toFixed(2),
                docId: newRecord.id, 
                docType: docType     
              }],
              subject: `${docType === 'invoice' ? 'Invoice' : 'Quote'}: ${docReference}`,
              htmlTemplate: finalHtml,
              baseUrl: window.location.origin
            })
          });

          if (!res.ok) throw new Error("Database updated, but email transmission failed.");
          alert(`Success! ${docType.toUpperCase()} recorded and transmitted via email.`);

      } else if (action === 'pdf') {
          // Dynamically import PDF libraries
          const htmlToImage = await import("html-to-image");
          // @ts-ignore
          const jsPDFModule = await import("jspdf/dist/jspdf.umd.min.js");
          const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

          const element = document.getElementById("hidden-document-capture");
          if (!element) throw new Error("Document element not found for PDF capture.");

          const dataUrl = await htmlToImage.toPng(element, { 
            pixelRatio: 2, 
            backgroundColor: "#020617", 
            style: { margin: '0' } 
          });
          
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfPageHeight = pdf.internal.pageSize.getHeight();
          
          pdf.setFillColor("#020617");
          pdf.rect(0, 0, pdfWidth, pdfPageHeight, "F");
          
          const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
          pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

          if (docType === 'quote') {
            const acceptUrl = `${window.location.origin}/quote/${newRecord.id}`;
            const buttonY = pdfPageHeight - 25; 
            
            pdf.setFillColor(147, 51, 234); 
            pdf.rect(pdfWidth / 4, buttonY, pdfWidth / 2, 12, "F"); 
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11);
            pdf.setFont("helvetica", "bold");
            pdf.textWithLink("CLICK HERE TO REVIEW & ACCEPT QUOTE", pdfWidth / 2, buttonY + 7.5, {
              url: acceptUrl,
              align: "center"
            });
          }
          
          pdf.save(`${docReference}_RAD_Academy.pdf`);
          alert(`Success! ${docType.toUpperCase()} recorded to ledger and downloaded as PDF.`);
      }
      
      if (isIframe) {
        window.location.reload(); 
      } else {
        router.push('/admin/finance');
      }
      
    } catch (err: any) {
      alert("Operational Failure: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectItemFromDb = (idx: number, itemId: string) => {
    const selected = dbItems.find(i => i.id === itemId);
    if (selected) {
      updateLine(idx, 'desc', selected.name);
      updateLine(idx, 'price', selected.price);
    }
  };

  const addLine = () => setLineItems([...lineItems, { desc: '', note: '', qty: 1, price: 0, disc: 0 }]);
  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: string, val: any) => {
    const next = [...lineItems];
    if (field === 'disc' && Number(val) < 0) val = 0;
    next[idx][field] = val;
    setLineItems(next);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            {!isIframe && (
              <Link href="/admin/finance" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2">
                <ArrowLeft size={14}/> Back to Ledger
              </Link>
            )}
            <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none">
              Gen_<span className={docType === 'quote' ? 'text-purple-500' : 'text-emerald-500'}>{docType}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <span>Ref: {docReference}</span>
                <span className="text-white/20">|</span>
                <span>Pay_Ref: {paymentReference}</span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${docType === 'quote' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                  <Calendar size={12}/> Due Date: 
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="bg-transparent outline-none cursor-pointer font-bold ml-1" />
                </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                <button onClick={() => setDocType('quote')} disabled={!!convertFromQuoteId} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${docType === 'quote' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'} ${convertFromQuoteId && 'opacity-30 cursor-not-allowed'}`}>Quote</button>
                <button onClick={() => setDocType('invoice')} disabled={!!convertFromQuoteId} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${docType === 'invoice' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'} ${convertFromQuoteId && 'opacity-30 cursor-not-allowed'}`}>Invoice</button>
            </div>
            <button onClick={() => setShowPreview(true)} disabled={!selectedGuardian} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-white/10 transition-all disabled:opacity-20 shadow-xl">
                <Eye size={16}/> Preview Document
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* LEFT: LINE ITEM EDITOR */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><Package size={18}/> Ledger_Matrix</h3>
                <button onClick={addLine} className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">+ Add New Line</button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-6 rounded-3xl border border-white/5 group relative">
                    <div className="flex flex-col md:flex-row gap-6 pr-8">
                      
                      {/* LEFT SECTOR: Selection, Description, Note */}
                      <div className="flex-1 w-full space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Item Selection</label>
                          <div className="relative">
                            <select 
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500 appearance-none"
                              onChange={(e) => handleSelectItemFromDb(idx, e.target.value)}
                              value=""
                            >
                              <option value="" disabled>--- Sourced from Database ---</option>
                              {dbItems.map(i => <option key={i.id} value={i.id}>{i.name} (R{i.price})</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14}/>
                          </div>
                        </div>
                        
                        <input 
                          value={item.desc} 
                          onChange={(e) => updateLine(idx, 'desc', e.target.value)}
                          className="w-full bg-transparent border-b border-white/5 pb-2 text-xs text-slate-400 italic outline-none focus:border-emerald-500"
                          placeholder="Manual description or override..."
                        />
                        
                        <div className="flex items-center gap-2 text-slate-500">
                            <FileText size={12} />
                            <input 
                              value={item.note || ''} 
                              onChange={(e) => updateLine(idx, 'note', e.target.value)}
                              className="w-full bg-transparent border-b border-white/5 pb-1 text-[10px] outline-none focus:border-emerald-500"
                              placeholder="Line item note (optional)..."
                            />
                        </div>
                      </div>

                      {/* RIGHT SECTOR: Values */}
                      <div className="flex gap-4">
                        <div className="w-20 space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Qty</label>
                          <input type="number" value={item.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center" />
                        </div>
                        <div className="w-28 space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Unit Price</label>
                          <input type="number" value={item.price} onChange={(e) => updateLine(idx, 'price', e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center" />
                        </div>
                        <div className="w-20 space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Disc%</label>
                          <input type="number" value={item.disc} onChange={(e) => updateLine(idx, 'disc', e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-emerald-400 text-center min-w-[70px]" />
                        </div>
                      </div>

                    </div>
                    
                    {/* Delete Button */}
                    <div className="absolute right-5 top-10 flex items-center h-[42px]">
                      <button onClick={() => removeLine(idx)} className="text-slate-600 hover:text-rose-500 transition-colors">
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><FileText size={14}/> Document Notes</label>
                <textarea 
                    value={globalNote} 
                    onChange={(e) => setGlobalNote(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:border-emerald-500 min-h-[80px]"
                    placeholder="Enter overall notes for this document (e.g. valid for Term 2 only, special conditions)..."
                />
            </div>
            
            {!isIframe && (
              <div className="px-8 flex justify-end">
                 <Link href="/admin/finance/items" className="text-[10px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-2">
                   Manage Database Items <ArrowRight size={12}/>
                 </Link>
              </div>
            )}
          </div>

          {/* RIGHT: RECIPIENT & SUMMARY */}
          <div className="space-y-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white border-b border-white/5 pb-4">Recipient_Sector</h3>
              {!selectedGuardian ? (
                <div className="space-y-2 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input value={guardianSearch} onChange={(e) => setGuardianSearch(e.target.value)} placeholder="Search Client..." className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl py-3 pl-10 text-xs outline-none focus:border-blue-500" />
                  </div>
                  {suggestedGuardians.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden z-10 shadow-2xl">
                        {suggestedGuardians.map(g => (
                            <button key={g.id} onClick={() => { setSelectedGuardian(g); setGuardianSearch(""); }} className="w-full text-left p-4 hover:bg-blue-500/10 border-b border-white/5 text-xs font-bold transition-colors">
                                {g.display_name} <span className="text-[9px] text-slate-500 ml-2 uppercase">({g.id.split('-')[0]})</span>
                            </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-3xl relative group">
                    {!convertFromQuoteId && (
                      <button onClick={() => setSelectedGuardian(null)} className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                    )}
                    <p className="text-[9px] font-black text-blue-500 uppercase mb-1 tracking-widest">
                      {selectedGuardian.id?.toString().startsWith('prospect') ? 'Temporary_Prospect' : 'Selected_Recipient'}
                    </p>
                    <p className="text-xl font-black uppercase italic leading-none">{selectedGuardian.display_name}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{selectedGuardian.metadata?.email || selectedGuardian.email || 'No Email'}</p>
                </div>
              )}
              {docType === 'invoice' && (
                <div className="flex items-center gap-3 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                  <CreditCard className="text-rose-500" size={20}/>
                  <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase leading-none">PayFast_Secure</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Ref_Format: {paymentReference}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`${docType === 'quote' ? 'bg-purple-600 shadow-purple-900/20' : 'bg-emerald-600 shadow-emerald-900/20'} rounded-[40px] p-8 shadow-2xl text-white space-y-6 transition-all duration-500`}>
              <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Ledger_Final_Total</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between opacity-70 text-[11px] font-bold"><span>Sub_Total</span><span>R {subTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between opacity-70 text-[11px] font-bold text-rose-200"><span>Line_Discounts</span><span>- R {lineItemTotalDisc.toLocaleString()}</span></div>
                </div>
                <div className="pt-3 border-t border-white/20 space-y-2">
                   <label className="text-[9px] font-black uppercase opacity-60 ml-1 tracking-widest">Overall Adjustment %</label>
                   <input type="number" min="0" value={globalDisc} onChange={(e) => setGlobalDisc(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm font-black outline-none shadow-inner" />
                </div>
                <div className="pt-4 border-t border-white/30 flex justify-between items-end">
                  <span className="font-black uppercase text-[10px]">Total_Payable</span>
                  <span className="text-4xl font-black tracking-tighter italic">R {grandTotal.toLocaleString()}</span>
                </div>
              </div>
              {/* --- MULTI-ACTION BUTTONS --- */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleFinalize('email')} 
                  disabled={!selectedGuardian || grandTotal <= 0 || isProcessing} 
                  className="w-full py-4 bg-white text-[#020617] rounded-[24px] font-black uppercase italic tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-30 cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Save & Email</>}
                </button>

                <button 
                  onClick={() => handleFinalize('pdf')} 
                  disabled={!selectedGuardian || grandTotal <= 0 || isProcessing} 
                  className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30 cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <><Download size={18}/> Save & Download PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPreview && selectedGuardian && (
          <div className="fixed inset-0 z-[200] flex justify-center items-center p-6 bg-black/95 backdrop-blur-xl">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-5xl bg-[#020617] rounded-[40px] border border-white/10 flex flex-col h-[90vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20"><Shield size={20}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure_Document_Vault</p>
                        <p className="text-sm font-black uppercase italic tracking-tight">Previewing {docType}: {docReference}</p>
                    </div>
                 </div>
                 <button onClick={() => setShowPreview(false)} className="p-3 text-slate-500 hover:text-rose-500 bg-white/5 rounded-xl transition-all"><X size={24}/></button>
              </div>
              <div id="preview-content" className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                 <RADBillingDocument 
                    type={docType}
                    docNumber={docReference}
                    recipient={{
                        name: selectedGuardian.display_name,
                        email: selectedGuardian.metadata?.email || selectedGuardian.email || "No Email",
                        phone: selectedGuardian.metadata?.phone || selectedGuardian.phone || "No Phone"
                    }}
                    items={lineItems}
                    date={new Date().toLocaleDateString('en-ZA')}
                    dueDate={docType === 'quote' || docType === 'invoice' ? expiryDate : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA')}
                    globalNote={globalNote}
                 />
                 {globalDisc > 0 && (
                     <div className="mt-6 p-6 bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-3xl flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Global Adjustment Applied:</span>
                        <span className="text-xl font-black italic text-emerald-400">-{globalDisc}%</span>
                     </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- HIDDEN RENDER FOR INSTANT PDF EXPORT --- */}
      {/* This renders the doc invisibly in the background so html-to-image can capture it without needing to open the Preview Modal */}
      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none">
        <div id="hidden-document-capture" className="w-[800px] p-8 bg-[#020617]">
          {selectedGuardian && (
             <RADBillingDocument 
                type={docType}
                docNumber={docReference}
                recipient={{
                    name: selectedGuardian.display_name,
                    email: selectedGuardian.metadata?.email || selectedGuardian.email || "",
                    phone: selectedGuardian.metadata?.phone || selectedGuardian.phone || ""
                }}
                items={lineItems}
                date={new Date().toLocaleDateString('en-ZA')}
                dueDate={docType === 'quote' || docType === 'invoice' ? expiryDate : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA')}
                globalNote={globalNote}
             />
          )}
        </div>
      </div>
    </div>
  );
}