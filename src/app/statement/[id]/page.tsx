"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import { Loader2, XCircle, Download, FileText } from "lucide-react";
import RADStatement from "@/components/finance/RADStatement";

export default function StatementView() {
  const params = useParams();
  const guardianId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [guardian, setGuardian] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (guardianId) fetchStatementData();
  }, [guardianId]);

  async function fetchStatementData() {
    try {
      // 1. Fetch Guardian Profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', guardianId)
        .single();

      if (profileErr || !profileData) throw new Error("Profile not found");
      setGuardian(profileData);

      // 2. Fetch All Billing Records (Excluding Quotes)
      const { data: billingData, error: billingErr } = await supabase
        .from('billing_records')
        .select('*')
        .eq('guardian_id', guardianId)
        .eq('doc_type', 'invoice')
        .order('created_at', { ascending: true }); // Chronological for statements

      if (billingErr) throw billingErr;
      setInvoices(billingData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const htmlToImage = await import("html-to-image");
      // @ts-ignore
      const jsPDFModule = await import("jspdf/dist/jspdf.umd.min.js");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const element = document.getElementById("statement-document");
      if (!element) throw new Error("Document element not found");

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
      
      const firstName = guardian.display_name.split(' ')[0] || "Client";
      pdf.save(`Statement_${firstName}_RAD-Academy.pdf`);
      
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Retrieving_Account_Ledger...</p>
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6">
        <XCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Account Not Found</h1>
        <p className="text-slate-500 mt-2">The link you followed may be invalid.</p>
      </div>
    );
  }

  // Calculate running total
  const totalDue = invoices.reduce((acc, inv) => {
    if (inv.status === 'paid' || inv.status === 'settled') return acc;
    const total = parseFloat(inv.total_amount || 0);
    const paid = parseFloat(inv.amount_paid || 0);
    return acc + (total - paid);
  }, 0);

  // NEW: Transform invoices into proper accounting Ledger rows (Debits & Credits)
  const safeTransactions: any[] = [];

  invoices.forEach(inv => {
    const amount = Number(inv.total_amount) || 0;
    const paid = Number(inv.amount_paid) || 0;
    const dateStr = new Date(inv.created_at).toLocaleDateString('en-ZA');
    
    // Fallback description from the first line item
    const desc = inv.line_items && inv.line_items.length > 0 
      ? inv.line_items[0].desc || inv.line_items[0].description || 'Account Charge' 
      : 'Account Charge';

    // 1. The Invoice Charge (Debit)
    safeTransactions.push({
      date: dateStr,
      ref: `INV-${inv.invoice_number}`,
      desc: desc,
      debit: amount,
      credit: null
    });

    // 2. The Payment (Credit) - If they have paid anything towards this invoice
    if (paid > 0) {
      safeTransactions.push({
        date: new Date(inv.updated_at || inv.created_at).toLocaleDateString('en-ZA'), // Approx payment date
        ref: `PAY-${inv.invoice_number}`,
        desc: 'Payment Received - Thank You',
        debit: null,
        credit: paid
      });
    }
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-12 font-sans selection:bg-blue-500/30">
      
      {/* FLOATING ACTION BAR */}
      <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="font-black uppercase italic tracking-tight text-white leading-none">Official Statement</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{guardian.display_name}</p>
          </div>
        </div>
        
        <button 
          onClick={handleDownloadPDF}
          disabled={isGeneratingPdf}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
        >
          {isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
          {isGeneratingPdf ? 'Compiling PDF...' : 'Download PDF'}
        </button>
      </div>

      {/* THE STATEMENT DOCUMENT */}
      <div className="flex justify-center pb-20">
        <div id="statement-document" className="w-full max-w-4xl">
          <RADStatement 
            guardianId={guardian.id}
            name={guardian.display_name}
            email={guardian.metadata?.email || guardian.email || ""}
            phone={guardian.metadata?.phone || guardian.phone || ""}
            transactions={safeTransactions}
            balanceDue={totalDue}
          />
        </div>
      </div>
      
    </div>
  );
}