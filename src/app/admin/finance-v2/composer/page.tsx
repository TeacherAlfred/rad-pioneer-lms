"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Send, User, Search, ArrowLeft, ChevronDown, Eye, X,
  Loader2, Calendar, FileText, Download, CheckCircle2, CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import RADBillingDocument from "@/components/finance/RADBillingDocument";

type LineItem = {
  description: string;
  program_id: string | null;
  session_id: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
};

function emptyLine(): LineItem {
  return { description: "", program_id: null, session_id: null, quantity: 1, unit_price: 0, discount_pct: 0 };
}

export default function ComposerV2Page() {
  const router = useRouter();

  const [programs, setPrograms] = useState<any[]>([]);
  const [sessionsByProgram, setSessionsByProgram] = useState<Record<string, any[]>>({});
  const [nextQuoteNumber, setNextQuoteNumber] = useState(1);

  // quotes.program_id is a required column (confirmed against live schema) -
  // every quote is for one primary programme, even if extra freeform/hardware
  // lines get added alongside it.
  const [primaryProgramId, setPrimaryProgramId] = useState<string>("");

  const [leadSearch, setLeadSearch] = useState("");
  const [suggestedLeads, setSuggestedLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  const [isTermEnrolment, setIsTermEnrolment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);

  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // leads/programs/sessions/quotes are all RLS-locked with zero anon
      // policies - every read/write goes through admin/api/finance-v2/*
      // (service-role, protected by the /admin/* middleware) rather than
      // the browser supabase client directly.
      const progRes = await fetch("/admin/api/finance-v2/programs");
      const { programs: p } = await progRes.json();
      if (p) setPrograms(p);
      const numRes = await fetch("/admin/api/finance-v2/quotes");
      const { nextQuoteNumber: n } = await numRes.json();
      setNextQuoteNumber(n || 1);
    })();
  }, []);

  useEffect(() => {
    if (leadSearch.length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(leadSearch)}`);
        const { leads } = await res.json();
        setSuggestedLeads(leads || []);
      }, 250);
      return () => clearTimeout(t);
    } else {
      setSuggestedLeads([]);
    }
  }, [leadSearch]);

  async function loadSessionsFor(programId: string) {
    if (sessionsByProgram[programId]) return;
    const res = await fetch(`/admin/api/finance-v2/sessions?programId=${programId}`);
    const { sessions } = await res.json();
    setSessionsByProgram((prev) => ({ ...prev, [programId]: sessions || [] }));
  }

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, ...patch } : li)));
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const subTotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const totalDiscount = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price * (Math.max(0, li.discount_pct) / 100),
    0
  );
  const grandTotal = subTotal - totalDiscount;
  const monthlyInstallmentAmount = isTermEnrolment && installmentCount > 1 ? grandTotal / installmentCount : null;

  async function handleCreateLead() {
    const digits = newLeadPhone.replace(/\D/g, "");
    if (!digits) return;
    const res = await fetch("/admin/api/finance-v2/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: digits, name: leadSearch || null, email: newLeadEmail || null, source: "finance_v2_composer" }),
    });
    const { lead } = await res.json();
    if (lead) {
      setSelectedLead(lead);
      setLeadSearch("");
      setSuggestedLeads([]);
    }
  }

  async function handleFinalize(action: "email" | "pdf") {
    if (!selectedLead || !primaryProgramId || grandTotal <= 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const quoteRes = await fetch("/admin/api/finance-v2/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          program_id: primaryProgramId,
          total_amount: grandTotal,
          installment_count: isTermEnrolment ? installmentCount : 1,
          monthly_installment_amount: monthlyInstallmentAmount,
          expires_at: expiryDate,
          notes,
          line_items: lineItems,
        }),
      });
      const quoteJson = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quoteJson.error || "Failed to save quote");
      const newQuote = quoteJson.quote;

      if (action === "email") {
        const templateRes = await fetch("/admin/api/finance-v2/email-templates?slug=billing_quote");
        const { body_content } = await templateRes.json();
        // The stored template hardcodes /quote/{{docId}} (the old, frozen public
        // page) - swap it for the new v2 route rather than let a new quote
        // silently email a link to the retired page.
        let finalHtml = (body_content || "").replace("/quote/{{docId}}", "/quote-v2/{{docId}}");
        finalHtml = finalHtml.replace(/\{\{baseUrl\}\}/g, window.location.origin);
        finalHtml = finalHtml.replace(/\{\{docId\}\}/g, newQuote.id);

        const res = await fetch("/api/send-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: [{ email: selectedLead.email, invNum: String(newQuote.quote_number), total: grandTotal.toFixed(2), docId: newQuote.id, docType: "quote" }],
            subject: `Quote: QT-${newQuote.quote_number}`,
            htmlTemplate: finalHtml,
            baseUrl: window.location.origin,
          }),
        });
        if (!res.ok) throw new Error("Quote saved, but email transmission failed.");
        setSuccessMessage("Quote saved and emailed.");
      } else {
        const htmlToImage = await import("html-to-image");
        // @ts-ignore
        const jsPDFModule = await import("jspdf/dist/jspdf.umd.min.js");
        const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
        const element = document.getElementById("hidden-document-capture-v2");
        if (!element) throw new Error("Document element not found for PDF capture.");
        const dataUrl = await htmlToImage.toPng(element, { pixelRatio: 2, backgroundColor: "#020617" });
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
        pdf.setFillColor("#020617");
        pdf.rect(0, 0, pdfWidth, pdf.internal.pageSize.getHeight(), "F");
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
        const acceptUrl = `${window.location.origin}/quote-v2/${newQuote.id}`;
        const buttonY = pdf.internal.pageSize.getHeight() - 25;
        pdf.setFillColor(147, 51, 234);
        pdf.rect(pdfWidth / 4, buttonY, pdfWidth / 2, 12, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.textWithLink("CLICK HERE TO REVIEW & ACCEPT QUOTE", pdfWidth / 2, buttonY + 7.5, { url: acceptUrl, align: "center" });
        pdf.save(`QT-${newQuote.quote_number}_${(selectedLead.name || "Lead").split(" ")[0]}_RAD-Academy.pdf`);
        setSuccessMessage("Quote saved and downloaded as PDF.");
      }

      setTimeout(() => router.push("/admin/dashboard-v2"), 2000);
    } catch (err: any) {
      alert("Operational Failure: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const documentItems = lineItems.map((li) => ({ desc: li.description, qty: li.quantity, price: li.unit_price, disc: li.discount_pct }));

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard-v2" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2 transition-colors">
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
              Gen_<span className="text-purple-500">quote</span> <span className="text-cyan-500 text-xl align-top">v2</span>
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              <span>Ref: QT-{nextQuoteNumber}</span>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg border text-purple-400 bg-purple-500/10 border-purple-500/20">
                <Calendar size={12} /> Expires:
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="bg-transparent outline-none cursor-pointer font-bold ml-1 [color-scheme:dark]" />
              </div>
            </div>
          </div>
          <button onClick={() => setShowPreview(true)} disabled={!selectedLead || !primaryProgramId} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-white/10 transition-all disabled:opacity-20">
            <Eye size={16} /> Preview
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Line Items</h3>
                <button onClick={addLine} className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1">
                  <Plus size={12} /> Add Line
                </button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-6 rounded-3xl border border-white/5 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Program (optional)</label>
                        <select
                          value={item.program_id || ""}
                          onChange={(e) => {
                            const pid = e.target.value || null;
                            updateLine(idx, { program_id: pid, session_id: null });
                            if (pid) loadSessionsFor(pid);
                          }}
                          className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold outline-none focus:border-emerald-500 mt-1"
                        >
                          <option value="">— Freeform line —</option>
                          {programs.map((p) => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                      </div>
                      {item.program_id && (
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Session</label>
                          <select
                            value={item.session_id || ""}
                            onChange={(e) => {
                              const sid = e.target.value || null;
                              const session = (sessionsByProgram[item.program_id!] || []).find((s) => s.id === sid);
                              updateLine(idx, {
                                session_id: sid,
                                unit_price: session ? Number(session.price) : item.unit_price,
                                description: item.description || (session ? `${programs.find((p) => p.id === item.program_id)?.name} — ${new Date(session.starts_at).toLocaleDateString("en-ZA")}` : item.description),
                              });
                            }}
                            className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold outline-none focus:border-emerald-500 mt-1"
                          >
                            <option value="">— No specific session —</option>
                            {(sessionsByProgram[item.program_id] || []).map((s) => (
                              <option key={s.id} value={s.id}>{new Date(s.starts_at).toLocaleDateString("en-ZA")} (R{s.price})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <input
                      value={item.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      className="w-full bg-transparent border-b border-white/5 pb-2 mb-4 text-xs text-slate-300 outline-none focus:border-emerald-500"
                      placeholder="Description shown on the document..."
                    />

                    <div className="flex flex-wrap gap-4">
                      <div className="w-20">
                        <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Qty</label>
                        <input type="number" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center outline-none focus:border-emerald-500" />
                      </div>
                      <div className="w-28">
                        <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Unit Price (R)</label>
                        <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) || 0 })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center outline-none focus:border-emerald-500" />
                      </div>
                      <div className="w-20">
                        <label className="text-[9px] font-black uppercase text-slate-500 text-center block">Disc (%)</label>
                        <input type="number" step="0.01" value={item.discount_pct} onChange={(e) => updateLine(idx, { discount_pct: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-emerald-400 text-center outline-none focus:border-emerald-500" />
                      </div>
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLine(idx)} className="ml-auto self-end mb-2 text-slate-600 hover:text-rose-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isTermEnrolment} onChange={(e) => setIsTermEnrolment(e.target.checked)} className="w-5 h-5 accent-purple-500" />
                <span className="text-[10px] font-black uppercase text-slate-300">Term enrolment (offer a monthly payment plan)</span>
              </label>
              {isTermEnrolment && (
                <div className="flex items-center gap-4 pl-8">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500">Number of Months</label>
                    <input type="number" min={2} value={installmentCount} onChange={(e) => setInstallmentCount(Math.max(2, Number(e.target.value) || 2))} className="w-24 bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-black text-center outline-none focus:border-purple-500 mt-1 block" />
                  </div>
                  {monthlyInstallmentAmount !== null && (
                    <p className="text-xs text-slate-400">R {monthlyInstallmentAmount.toFixed(2)} / month</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><FileText size={14} /> Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:border-emerald-500 min-h-[80px] resize-none" placeholder="Notes for this quote..." />
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-white border-b border-white/5 pb-4">Programme <span className="text-rose-400">*</span></h3>
              <select
                value={primaryProgramId}
                onChange={(e) => setPrimaryProgramId(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs font-bold outline-none focus:border-emerald-500"
              >
                <option value="" disabled>— Select the programme this quote is for —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
              <p className="text-[9px] text-slate-500">Required — every quote belongs to one primary programme, even if extra freeform lines are added below.</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white border-b border-white/5 pb-4">Recipient (Lead)</h3>
              {!selectedLead ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Search leads by name or phone..." className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl py-3 pl-10 text-xs outline-none focus:border-blue-500" />
                  </div>
                  {suggestedLeads.length > 0 && (
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden">
                      {suggestedLeads.map((l) => (
                        <button key={l.id} onClick={() => { setSelectedLead(l); setLeadSearch(""); setSuggestedLeads([]); }} className="w-full text-left p-4 hover:bg-blue-500/10 border-b border-white/5 last:border-b-0 text-xs font-bold transition-colors">
                          {l.name || "Unnamed"} <span className="text-[9px] text-slate-500 ml-2">{l.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {leadSearch.length > 2 && suggestedLeads.length === 0 && (
                    <div className="p-4 bg-black/20 border border-dashed border-white/10 rounded-2xl space-y-3">
                      <p className="text-[10px] text-slate-500">No matching lead — create one:</p>
                      <input value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} placeholder="WhatsApp number" className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500" />
                      <input value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} placeholder="Email (optional)" className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500" />
                      <button onClick={handleCreateLead} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase">Create Lead: {leadSearch}</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-3xl relative group">
                  <button onClick={() => setSelectedLead(null)} className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-1 tracking-widest flex items-center gap-1.5"><User size={10} /> Lead</p>
                  <p className="text-xl font-black uppercase italic leading-none">{selectedLead.name || "Unnamed"}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{selectedLead.email || "No Email"} · {selectedLead.phone}</p>
                </div>
              )}
              <div className="flex items-center gap-3 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                <CreditCard className="text-rose-500" size={20} />
                <p className="text-[9px] text-slate-500 font-bold uppercase">New pipeline — writes to quotes/leads, not billing_records</p>
              </div>
            </div>

            <div className="bg-purple-600 shadow-purple-900/20 rounded-[40px] p-8 shadow-2xl text-white space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Total</h3>
              <div className="space-y-1">
                <div className="flex justify-between opacity-70 text-[11px] font-bold">
                  <span>Sub Total</span>
                  <span>R {subTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between opacity-70 text-[11px] font-bold text-rose-200">
                  <span>Discounts</span>
                  <span>- R {totalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-white/30 flex justify-between items-end">
                <span className="font-black uppercase text-[10px]">Total Payable</span>
                <span className="text-4xl font-black tracking-tighter italic">R {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => handleFinalize("email")} disabled={!selectedLead || !primaryProgramId || grandTotal <= 0 || isProcessing || !selectedLead?.email} className="w-full py-4 bg-white text-[#020617] rounded-[24px] font-black uppercase italic tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-30">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Save &amp; Email</>}
                </button>
                <button onClick={() => handleFinalize("pdf")} disabled={!selectedLead || !primaryProgramId || grandTotal <= 0 || isProcessing} className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-[24px] font-black uppercase italic tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <><Download size={18} /> Save &amp; Download PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPreview && selectedLead && (
          <div className="fixed inset-0 z-[200] flex justify-center items-center p-6 bg-black/95 backdrop-blur-xl">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-5xl bg-[#020617] rounded-[40px] border border-white/10 flex flex-col h-[90vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <p className="text-sm font-black uppercase italic tracking-tight">Previewing QT-{nextQuoteNumber}</p>
                <button onClick={() => setShowPreview(false)} className="p-3 text-slate-500 hover:text-rose-500 bg-white/5 rounded-xl transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <RADBillingDocument
                  type="quote"
                  docNumber={`QT-${nextQuoteNumber}`}
                  recipient={{ name: selectedLead.name || "Lead", email: selectedLead.email || "", phone: selectedLead.phone || "" }}
                  items={documentItems}
                  date={new Date().toLocaleDateString("en-ZA")}
                  dueDate={expiryDate}
                  globalNote={notes}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none">
        <div id="hidden-document-capture-v2" className="w-[800px] p-8 bg-[#020617]">
          {selectedLead && (
            <RADBillingDocument
              type="quote"
              docNumber={`QT-${nextQuoteNumber}`}
              recipient={{ name: selectedLead.name || "Lead", email: selectedLead.email || "", phone: selectedLead.phone || "" }}
              items={documentItems}
              date={new Date().toLocaleDateString("en-ZA")}
              dueDate={expiryDate}
              globalNote={notes}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <div className="fixed bottom-10 right-10 z-[300] flex justify-end pointer-events-none">
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 shadow-2xl flex items-center gap-4 max-w-sm pointer-events-auto">
              <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
              <p className="text-[10px] font-bold text-slate-400">{successMessage}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
