"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, CreditCard, TrendingUp, AlertTriangle, Tag,
  CheckCircle2, Clock, Filter, Search, Download, UserPlus, MessageCircle,
  Plus, ChevronRight, Wallet, Receipt, Loader2, Activity, X, Shield, FileText, Printer, BarChart3, Package, FilterX, User, Target, Save, Edit3, Trash2, Send
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import RADBillingDocument from "@/components/finance/RADBillingDocument";
import RADStatement from "@/components/finance/RADStatement";

// --- WhatsApp Number Formatter ---
const formatWhatsAppNumber = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, ''); 
  if (cleaned.startsWith('0')) {
    cleaned = '27' + cleaned.substring(1); 
  }
  return cleaned;
};

export default function FinancePortal() {
  const router = useRouter(); 
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const [records, setRecords] = useState<any[]>([]);
  const [billingItems, setBillingItems] = useState<any[]>([]);
  const [activeParentsCount, setActiveParentsCount] = useState(0);
  const [guardians, setGuardians] = useState<any[]>([]); 
  
  const [activeDoc, setActiveDoc] = useState<{ type: 'invoice' | 'statement' | 'quote', data: any } | null>(null);
  const [activeProspect, setActiveProspect] = useState<any | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isGroupedByExpiry, setIsGroupedByExpiry] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  
  // --- WHATSAPP COMPOSER STATES ---
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppBody, setWhatsAppBody] = useState("");
  
  // --- BATCH DISPATCHER STATES ---
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);

  const [formData, setFormData] = useState({
    guardian_id: "",
    doc_type: "invoice",
    invoice_number: "",
    description: "",
    total_amount: "",
    created_at: new Date().toISOString().split('T')[0], 
    status: "pending",
    paid_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function fetchFinanceData() {
    setLoading(true);
    try {
      const { data: recordsData } = await supabase
        .from('billing_records')
        .select(`*, profiles(display_name)`)
        .order('created_at', { ascending: false });
        
      const { data: itemsData } = await supabase.from('billing_items').select('*');

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'lead']);

      const { data: guardianData, error: guardianError } = await supabase
        .from('profiles')
        .select('id, display_name, metadata, role')
        .neq('role', 'student')
        .order('display_name', { ascending: true });

      if (recordsData) setRecords(recordsData);
      if (itemsData) setBillingItems(itemsData);
      if (count !== null) setActiveParentsCount(count);
      if (guardianData) setGuardians(guardianData);
      
    } catch (err) {
      console.error("Failed to fetch finance engine data:", err);
    } finally {
      setLoading(false);
    }
  }

  const analytics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const quotes = records.filter(r => r.doc_type === 'quote');
    const invoices = records.filter(r => r.doc_type === 'invoice');

    const quotesToday = quotes.filter(q => new Date(q.created_at) >= startOfToday).length;
    const quotesWeek = quotes.filter(q => new Date(q.created_at) >= startOfWeek).length;
    const quotesMonth = quotes.filter(q => new Date(q.created_at) >= startOfMonth);
    
    const validQuotes = quotes.filter(q => q.status === 'pending' && (!q.expires_at || new Date(q.expires_at) >= now));
    const expiredQuotes = quotes.filter(q => q.status === 'pending' && q.expires_at && new Date(q.expires_at) < now);
    const declinedQuotes = quotes.filter(q => q.status === 'declined');

    const itemCostMap = Object.fromEntries(billingItems.map(i => [i.name, Number(i.cost) || 0]));

    let openQuotesGP = 0;
    validQuotes.forEach(q => {
      q.line_items?.forEach((li: any) => {
        const cost = itemCostMap[li.desc] || 0;
        const price = Number(li.price) || 0;
        const qty = Number(li.qty) || 0;
        const disc = Math.max(0, Number(li.disc || 0));
        const netPrice = price * (1 - disc / 100);
        openQuotesGP += (netPrice - cost) * qty;
      });
    });
    const avgGPPerQuote = validQuotes.length > 0 ? (openQuotesGP / validQuotes.length) : 0;

    let quotesTotalValue = 0;
    let acceptedQuotesCount = 0;
    let acceptedQuotesValue = 0;

    quotes.forEach(q => {
       const amt = Number(q.total_amount) || 0;
       quotesTotalValue += amt;
       if (q.status === 'accepted') {
          acceptedQuotesCount++;
          acceptedQuotesValue += amt;
       }
    });

    let monthGeneratedInvTotal = 0;
    let monthOutstandingInvTotal = 0;
    let totalInvoicedLifetime = 0;
    let totalPaidLifetime = 0;

    invoices.forEach(inv => {
      const dueDate = inv.expires_at ? new Date(inv.expires_at) : new Date(new Date(inv.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      const isDueThisMonth = dueDate >= startOfMonth && dueDate.getMonth() === now.getMonth();
      const amount = Number(inv.total_amount) || 0;

      totalInvoicedLifetime += amount;
      if (inv.status === 'paid' || inv.status === 'settled') totalPaidLifetime += amount;

      if (isDueThisMonth) {
        monthGeneratedInvTotal += amount;
        if (inv.status !== 'paid' && inv.status !== 'settled') monthOutstandingInvTotal += amount;
      }
    });

    const collectionRate = totalInvoicedLifetime > 0 ? (totalPaidLifetime / totalInvoicedLifetime) * 100 : 0;
    const avgMonthlyPerParent = activeParentsCount > 0 ? (totalPaidLifetime / activeParentsCount) : 0;

    const itemStats: Record<string, { qty: number, gp: number }> = {};
    invoices.forEach(inv => {
      if (inv.status === 'paid' || inv.status === 'settled') {
        inv.line_items?.forEach((li: any) => {
          const desc = li.desc;
          if (!itemStats[desc]) itemStats[desc] = { qty: 0, gp: 0 };
          const cost = itemCostMap[desc] || 0;
          const price = Number(li.price) || 0;
          const qty = Number(li.qty) || 0;
          const disc = Math.max(0, Number(li.disc || 0));
          const netPrice = price * (1 - disc / 100);
          itemStats[desc].qty += qty;
          itemStats[desc].gp += (netPrice - cost) * qty;
        });
      }
    });

    let mostSoldItem = { name: "N/A", qty: 0 };
    let highestGpItem = { name: "N/A", gp: 0 };
    Object.entries(itemStats).forEach(([name, stats]) => {
      if (stats.qty > mostSoldItem.qty) mostSoldItem = { name, qty: stats.qty };
      if (stats.gp > highestGpItem.gp) highestGpItem = { name, gp: stats.gp };
    });

    const quoteToAcceptConversion = quotes.length > 0 ? (acceptedQuotesCount / quotes.length) * 100 : 0;

    return {
      quotes: { total: quotes.length, today: quotesToday, week: quotesWeek, month: quotesMonth.length },
      pipeline: { valid: validQuotes.length, expired: expiredQuotes.length, declined: declinedQuotes.length, avgGp: avgGPPerQuote },
      invoices: { monthGenerated: monthGeneratedInvTotal, monthOutstanding: monthOutstandingInvTotal },
      collections: { rate: collectionRate, activeParents: activeParentsCount, avgPerParent: avgMonthlyPerParent },
      conversion: { 
        quotes: quotes.length, 
        quotesValue: quotesTotalValue,
        acceptedQuotes: acceptedQuotesCount,
        acceptedValue: acceptedQuotesValue,
        invoicesValue: totalInvoicedLifetime,
        paidValue: totalPaidLifetime,
        rate: quoteToAcceptConversion 
      },
      products: { mostSold: mostSoldItem, highestGp: highestGpItem }
    };
  }, [records, billingItems, activeParentsCount]);

  const vipQuoteIds = useMemo(() => {
    const pendingQuotes = records.filter(r => r.doc_type === 'quote' && r.status === 'pending');
    const sortedQuotes = [...pendingQuotes].sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
    const totalPendingValue = sortedQuotes.reduce((sum, q) => sum + Number(q.total_amount), 0);
    const targetValue = totalPendingValue * 0.8; 
    
    let cumulative = 0;
    const paretoIds = new Set<string>();
    
    for (const q of sortedQuotes) {
      paretoIds.add(q.id);
      cumulative += Number(q.total_amount);
      if (cumulative >= targetValue) break;
    }
    
    return paretoIds;
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(rec => {
        const name = rec.profiles?.display_name || rec.metadata?.prospect_name || "";
        const email = rec.metadata?.prospect_email || "";
        const ref = `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`;
        return name.toLowerCase().includes(lowerQ) || email.toLowerCase().includes(lowerQ) || ref.toLowerCase().includes(lowerQ);
      });
    }

    if (activeFilter) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (activeFilter === 'pareto') {
        result = result.filter(rec => vipQuoteIds.has(rec.id));
        result.sort((a, b) => Number(b.total_amount) - Number(a.total_amount)); 
      } else {
        result = result.filter(rec => {
          if (activeFilter === 'quotes_tdy') return rec.doc_type === 'quote' && new Date(rec.created_at) >= startOfToday;
          if (activeFilter === 'quotes_valid') return rec.doc_type === 'quote' && rec.status === 'pending' && (!rec.expires_at || new Date(rec.expires_at) >= now);
          if (activeFilter === 'quotes_expired') return rec.doc_type === 'quote' && rec.status === 'pending' && rec.expires_at && new Date(rec.expires_at) < now;
          if (activeFilter === 'quotes_declined') return rec.doc_type === 'quote' && rec.status === 'declined';
          
          if (activeFilter === 'invoices_month_generated') {
            if (rec.doc_type !== 'invoice') return false;
            const dueDate = rec.expires_at ? new Date(rec.expires_at) : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
            return dueDate >= startOfMonth && dueDate.getMonth() === now.getMonth();
          }
          if (activeFilter === 'invoices_month_outstanding') {
            if (rec.doc_type !== 'invoice' || rec.status === 'paid' || rec.status === 'settled') return false;
            const dueDate = rec.expires_at ? new Date(rec.expires_at) : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
            return dueDate >= startOfMonth && dueDate.getMonth() === now.getMonth();
          }

          return true;
        });
      }
    }

    return result;
  }, [records, activeFilter, searchQuery, vipQuoteIds]);

  // --- BATCH & GROUPING HELPERS ---
  const groupedQuotes = useMemo(() => {
    if (!isGroupedByExpiry) return null;
    
    const groups: Record<string, { dateObj: number, records: any[] }> = {};
    
    filteredRecords.forEach(rec => {
      if (rec.doc_type !== 'quote') return; // Grouping is specifically for quotes workflow
      
      const d = rec.expires_at ? new Date(rec.expires_at) : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      const display = d.toLocaleDateString('en-ZA');
      
      if (!groups[display]) {
        groups[display] = { dateObj: d.getTime(), records: [] };
      }
      groups[display].records.push(rec);
    });

    // Sort ascending so the most urgent (or most recently expired) are at the top
    return Object.entries(groups).sort((a, b) => a[1].dateObj - b[1].dateObj);
  }, [filteredRecords, isGroupedByExpiry]);

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisibleQuotes = () => {
    const visibleQuotes = filteredRecords.filter(r => r.doc_type === 'quote' && r.status === 'pending');
    if (selectedRecordIds.length === visibleQuotes.length && visibleQuotes.length > 0) {
      setSelectedRecordIds([]); 
    } else {
      setSelectedRecordIds(visibleQuotes.map(r => r.id));
    }
  };

  const batchSelectedQuotes = useMemo(() => {
    return records.filter(r => selectedRecordIds.includes(r.id));
  }, [records, selectedRecordIds]);


  const handleViewDocument = (rec: any) => {
    const recipientName = rec.profiles?.display_name || rec.metadata?.prospect_name || "Unknown Guardian";
    const recipientEmail = rec.metadata?.prospect_email || "";
    
    // BULLETPROOF PHONE EXTRACTION
    const rawPhone = rec.metadata?.prospect_phone 
                  || rec.metadata?.phone 
                  || rec.profiles?.metadata?.phone 
                  || rec.profiles?.phone 
                  || rec.phone
                  || "";
                  
    const recipientPhone = rawPhone.toString().trim();

    const sanitizedItems = (rec.line_items || []).map((item: any) => ({
      desc: item.desc || item.description || 'Custom Entry',
      qty: Number(item.qty) || 1,
      price: Number(item.price) || Number(item.amount) || Number(rec.total_amount) || 0,
      disc: Number(item.disc) || 0
    }));

    setActiveDoc({
      type: rec.doc_type || 'invoice',
      data: {
        rawRecord: rec, 
        docId: rec.id,
        status: rec.status,
        docNumber: `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`,
        recipient: { id: rec.guardian_id, name: recipientName, email: recipientEmail, phone: recipientPhone },
        items: sanitizedItems,
        date: new Date(rec.created_at).toLocaleDateString('en-ZA'),
        dueDate: rec.expires_at ? new Date(rec.expires_at).toLocaleDateString('en-ZA') : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA'),
        globalNote: rec.metadata?.global_note
      }
    });
    setWhatsAppBody("");
  };

  const handleEditItemChange = (index: number, field: string, value: string) => {
    const newItems = [...editItems];
    
    if (field === 'disc_rand') {
      newItems[index].disc_rand = value; 
      newItems[index].disc_type = 'rand';
      
      const randVal = Number(value) || 0;
      const price = Number(newItems[index].price) || 0;
      const qty = Number(newItems[index].qty) || 0;
      const totalValue = price * qty;
      
      newItems[index].disc = totalValue > 0 ? (randVal / totalValue) * 100 : 0;
    } else if (field === 'disc') {
      newItems[index].disc = value; 
      newItems[index].disc_type = 'pct';
      
      const pctVal = Number(value) || 0;
      const price = Number(newItems[index].price) || 0;
      const qty = Number(newItems[index].qty) || 0;
      newItems[index].disc_rand = ((price * qty * pctVal) / 100).toFixed(2);
    } else {
      newItems[index][field] = value;
      
      const newPrice = Number(newItems[index].price) || 0;
      const newQty = Number(newItems[index].qty) || 0;
      const totalValue = newPrice * newQty;
      
      if (newItems[index].disc_type === 'rand') {
          const randVal = Number(newItems[index].disc_rand) || 0;
          newItems[index].disc = totalValue > 0 ? (randVal / totalValue) * 100 : 0;
      } else {
          const pctVal = Number(newItems[index].disc) || 0;
          newItems[index].disc_rand = ((totalValue * pctVal) / 100).toFixed(2);
      }
    }
    
    if (field === 'desc') {
      const sysItem = billingItems.find(b => b.name === value);
      if (sysItem) {
        newItems[index].price = sysItem.price || sysItem.cost || 0;
        
        const newPrice = Number(newItems[index].price) || 0;
        const newQty = Number(newItems[index].qty) || 0;
        const totalValue = newPrice * newQty;
        
        if (newItems[index].disc_type === 'rand') {
            const randVal = Number(newItems[index].disc_rand) || 0;
            newItems[index].disc = totalValue > 0 ? (randVal / totalValue) * 100 : 0;
        } else {
            const pctVal = Number(newItems[index].disc) || 0;
            newItems[index].disc_rand = ((totalValue * pctVal) / 100).toFixed(2);
        }
      }
    }
    setEditItems(newItems);
  };

  const handleSaveEditedItems = async () => {
    if (!activeDoc) return;
    setIsUpdatingStatus(true);
    try {
      const newTotal = editItems.reduce((acc, item) => {
        const p = Number(item.price) || 0;
        const q = Number(item.qty) || 0;
        const d = Number(item.disc) || 0;
        return acc + (p * q * (1 - d / 100));
      }, 0);

      const cleanedItems = editItems.map(item => ({
        desc: item.desc,
        qty: Number(item.qty) || 0,
        price: Number(item.price) || 0,
        disc: Number(item.disc) || 0
      }));

      const { error } = await supabase
        .from('billing_records')
        .update({ 
          line_items: cleanedItems, 
          total_amount: newTotal 
        })
        .eq('id', activeDoc.data.docId);

      if (error) throw error;

      setActiveDoc({
        ...activeDoc,
        data: {
          ...activeDoc.data,
          items: cleanedItems,
          rawRecord: { ...activeDoc.data.rawRecord, line_items: cleanedItems, total_amount: newTotal }
        }
      });

      setIsEditingItems(false);
      setSuccessMessage("Line items updated successfully.");
      fetchFinanceData();

    } catch (err: any) {
      alert("Failed to save items: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleViewProspect = (rec: any, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const name = rec.profiles?.display_name || rec.metadata?.prospect_name || "Unknown Guardian";
    const email = rec.metadata?.prospect_email || "No Email Provided";
    
    const history = records.filter(r => 
        (r.guardian_id && r.guardian_id === rec.guardian_id) || 
        (r.metadata?.prospect_email === email && email !== "No Email Provided")
    );

    setActiveProspect({
        id: rec.guardian_id || null,
        name,
        email,
        history,
        totalInvoiced: history.filter(h => h.doc_type === 'invoice').reduce((sum, h) => sum + Number(h.total_amount), 0),
        totalPaid: history.filter(h => h.doc_type === 'invoice' && (h.status === 'paid' || h.status === 'settled')).reduce((sum, h) => sum + Number(h.total_amount), 0),
        activeQuotes: history.filter(h => h.doc_type === 'quote' && h.status === 'pending').reduce((sum, h) => sum + Number(h.total_amount), 0)
    });
  };

  const handleApproveQuoteProfile = async (isAlreadyAccepted = false) => {
    if (!activeDoc || activeDoc.type !== 'quote') return;
    setIsUpdatingStatus(true);
    
    try {
       let finalGuardianId = activeDoc.data.recipient.id; 

       if (!finalGuardianId) {
          const { data: newProfile, error: profileErr } = await supabase
            .from('profiles')
            .insert([{
               role: 'guardian',
               display_name: activeDoc.data.recipient.name,
               status: 'active',
               funnel_stage: 'Active (Paid Client)',
               lead_source: 'Quote Conversion',
               metadata: { email: activeDoc.data.recipient.email, phone: "" }
            }])
            .select('id')
            .single();
            
          if (profileErr) throw profileErr;
          finalGuardianId = newProfile.id;
       }

       const { error: updateErr } = await supabase
          .from('billing_records')
          .update({ 
             status: 'accepted',
             guardian_id: finalGuardianId 
          })
          .eq('id', activeDoc.data.docId);

       if (updateErr) throw updateErr;

       setSuccessMessage(isAlreadyAccepted ? "Client profile generated and verified successfully!" : "Quote accepted! Client profile verified and active.");
       setActiveDoc(null);
       fetchFinanceData(); 
    } catch (err: any) {
       alert("Error: " + err.message);
    } finally {
       setIsUpdatingStatus(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!activeDoc || activeDoc.type !== 'invoice') return;
    setIsUpdatingStatus(true);
    
    try {
       const { error: updateErr } = await supabase
          .from('billing_records')
          .update({ status: 'paid' })
          .eq('id', activeDoc.data.docId);

       if (updateErr) throw updateErr;

       setSuccessMessage("Invoice successfully marked as PAID.");
       setActiveDoc(null);
       fetchFinanceData(); 
    } catch (err: any) {
       alert("Error: " + err.message);
    } finally {
       setIsUpdatingStatus(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!activeDoc) return;
    setIsGeneratingPdf(true);
    try {
      const htmlToImage = await import("html-to-image");
      // @ts-ignore
      const jsPDFModule = await import("jspdf/dist/jspdf.umd.min.js");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const element = document.getElementById("document-capture-area");
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

      if (activeDoc.type === 'quote') {
        const acceptUrl = `${window.location.origin}/quote/${activeDoc.data.docId}`;
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
      
      const firstName = activeDoc.data.recipient.name.split(' ')[0] || "Unknown";
      pdf.save(`${activeDoc.data.docNumber}_${firstName}_RAD-Academy.pdf`);
      
      setSuccessMessage("PDF downloaded successfully.");
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guardian_id) {
      alert("Please select a guardian/client.");
      return;
    }

    setIsSubmittingManual(true);

    try {
      const invNumber = parseInt(formData.invoice_number);
      const amount = parseFloat(formData.total_amount);
      const issueDate = new Date(formData.created_at).toISOString();
      const paymentDate = new Date(formData.paid_at).toISOString();

      const { error: recordError } = await supabase
        .from('billing_records')
        .insert([{
          invoice_number: invNumber,
          guardian_id: formData.guardian_id,
          total_amount: amount,
          status: formData.status,
          doc_type: formData.doc_type,
          payment_reference: `INV-${invNumber}`,
          created_at: issueDate,
          line_items: [{ desc: formData.description, price: amount, qty: 1, disc: 0 }]
        }]);

      if (recordError) throw recordError;

      if (formData.status === 'paid') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            parent_id: formData.guardian_id,
            amount: amount,
            status: 'completed',
            description: `Payment for ${formData.doc_type.toUpperCase()} #${invNumber} - ${formData.description}`,
            paid_at: paymentDate,
            created_at: paymentDate 
          }]);

        if (paymentError) throw paymentError;
      }

      setIsModalOpen(false);
      setFormData({
        guardian_id: "", doc_type: "invoice", invoice_number: "", description: "", 
        total_amount: "", created_at: new Date().toISOString().split('T')[0], 
        status: "pending", paid_at: new Date().toISOString().split('T')[0]
      });
      
      setSuccessMessage("Manual record saved to ledger successfully.");
      await fetchFinanceData();

    } catch (error: any) {
      alert(`Error saving record: ${error.message}`);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // --- RENDER HELPERS ---
  const visibleQuotesCount = filteredRecords.filter(r => r.doc_type === 'quote' && r.status === 'pending').length;
  const areAllVisibleQuotesSelected = visibleQuotesCount > 0 && selectedRecordIds.length === visibleQuotesCount;

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
      <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Compiling_Financial_Intelligence...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-emerald-500/30 relative">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <BarChart3 size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Economics_Engine_Online</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Finance_<span className="text-emerald-500">Dashboard</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/admin/finance/items">
                <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-900/10">
                    <Tag size={14}/> Item Catalog
                </button>
            </Link>
            <Link href="/admin/finance/insights">
                <button className="flex items-center gap-2 px-6 py-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-blue-900/10">
                    <Activity size={14}/> Revenue Intelligence
                </button>
            </Link>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-slate-300">
              Historical Import
            </button>
            <Link href="/admin/finance/composer">
                <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20">
                    <Plus size={14}/> Compose Document
                </button>
            </Link>
          </div>
        </header>

        {/* LIVE ANALYTICS DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><Wallet size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><CreditCard size={14}/> Collections (Month)</h3>
            <div className="grid grid-cols-2 gap-4">
               <div 
                 onClick={() => setActiveFilter(activeFilter === 'invoices_month_generated' ? null : 'invoices_month_generated')}
                 className={`cursor-pointer rounded-xl p-2 -ml-2 transition-all ${activeFilter === 'invoices_month_generated' ? 'bg-emerald-500/20 shadow-inner border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'}`}
               >
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Generated Due</p>
                 <p className="text-xl font-black mt-1">R {analytics.invoices.monthGenerated.toLocaleString()}</p>
               </div>
               
               <div 
                 onClick={() => setActiveFilter(activeFilter === 'invoices_month_outstanding' ? null : 'invoices_month_outstanding')}
                 className={`cursor-pointer rounded-xl p-2 -ml-2 transition-all ${activeFilter === 'invoices_month_outstanding' ? 'bg-rose-500/20 shadow-inner border border-rose-500/30' : 'hover:bg-white/5 border border-transparent'}`}
               >
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Outstanding</p>
                 <p className="text-xl font-black mt-1 text-rose-400">R {analytics.invoices.monthOutstanding.toLocaleString()}</p>
               </div>
            </div>
            <div className="border-t border-white/10 pt-4 grid grid-cols-3 gap-2 text-center">
               <div>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Rate</p>
                 <p className="text-sm font-bold text-emerald-400 mt-1">{analytics.collections.rate.toFixed(1)}%</p>
               </div>
               <div className="border-l border-white/10">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Parents</p>
                 <p className="text-sm font-bold text-white mt-1">{analytics.collections.activeParents}</p>
               </div>
               <div className="border-l border-white/10">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg LTV</p>
                 <p className="text-sm font-bold text-blue-400 mt-1">R {Math.round(analytics.collections.avgPerParent).toLocaleString()}</p>
               </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><FileText size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2"><TrendingUp size={14}/> Quote Pipeline</h3>
            
            <div className="grid grid-cols-4 gap-2 text-center">
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_tdy' ? null : 'quotes_tdy')} className={`cursor-pointer rounded-lg transition-colors p-1 ${activeFilter === 'quotes_tdy' ? 'bg-purple-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">Tdy</p>
                  <p className="font-bold">{analytics.quotes.today}</p>
               </div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">Wk</p><p className="font-bold">{analytics.quotes.week}</p></div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">Mth</p><p className="font-bold">{analytics.quotes.month}</p></div>
               <div className="border-l border-white/10 p-1"><p className="text-[9px] uppercase tracking-widest text-slate-500">All</p><p className="font-bold">{analytics.quotes.total}</p></div>
            </div>

            <div className="border-t border-white/10 pt-4 grid grid-cols-4 gap-2 text-center">
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_valid' ? null : 'quotes_valid')} className={`cursor-pointer rounded-lg transition-colors p-1 ${activeFilter === 'quotes_valid' ? 'bg-emerald-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Valid</p>
                 <p className="text-sm font-bold text-emerald-400 mt-1">{analytics.pipeline.valid}</p>
               </div>
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_expired' ? null : 'quotes_expired')} className={`cursor-pointer rounded-lg transition-colors border-l border-white/10 p-1 ${activeFilter === 'quotes_expired' ? 'bg-amber-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Expired</p>
                 <p className="text-sm font-bold text-amber-400 mt-1">{analytics.pipeline.expired}</p>
               </div>
               <div onClick={() => setActiveFilter(activeFilter === 'quotes_declined' ? null : 'quotes_declined')} className={`cursor-pointer rounded-lg transition-colors border-l border-white/10 p-1 ${activeFilter === 'quotes_declined' ? 'bg-rose-500/20 shadow-inner' : 'hover:bg-white/5'}`}>
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Declined</p>
                 <p className="text-sm font-bold text-rose-400 mt-1">{analytics.pipeline.declined}</p>
               </div>
               <div className="border-l border-white/10 p-1">
                 <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg GP</p>
                 <p className="text-[10px] font-bold text-purple-400 mt-1.5 flex items-center justify-center">R {Math.round(analytics.pipeline.avgGp).toLocaleString()}</p>
               </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><Package size={100} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Activity size={14}/> Item Intelligence (Paid)</h3>
            <div className="space-y-3">
               <div className="flex justify-between items-center bg-[#020617]/50 p-3 rounded-xl border border-white/5">
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Most Sold Volume</p>
                   <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[150px]">{analytics.products.mostSold.name}</p>
                 </div>
                 <p className="text-sm font-black text-blue-400">{analytics.products.mostSold.qty} units</p>
               </div>
               <div className="flex justify-between items-center bg-[#020617]/50 p-3 rounded-xl border border-white/5">
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Highest GP Generator</p>
                   <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[150px]">{analytics.products.highestGp.name}</p>
                 </div>
                 <p className="text-sm font-black text-emerald-400">R {analytics.products.highestGp.gp.toLocaleString()}</p>
               </div>
            </div>
          </div>

        </div>

        {/* MAIN LEDGER HEADER & FLOATING ACTIONS */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between relative">
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search records by prospect name, email, or ref #..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all placeholder:text-slate-600 placeholder:font-normal"
            />
          </div>

          {selectedRecordIds.length > 0 ? (
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/30 px-4 py-2 rounded-2xl shadow-xl shadow-[#25D366]/10"
              >
                <span className="text-[#25D366] font-black text-[10px] uppercase tracking-widest pl-2">
                  {selectedRecordIds.length} Selected
                </span>
                <button 
                  onClick={() => { setWhatsAppBody(""); setBatchIndex(0); setIsBatchModalOpen(true); }}
                  className="bg-[#25D366] text-[#020617] px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-[#20bd5a] transition-colors"
                >
                  <Send size={14} /> Batch WhatsApp
                </button>
                <button onClick={() => setSelectedRecordIds([])} className="text-slate-400 hover:text-white p-1 ml-2"><X size={16}/></button>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsGroupedByExpiry(!isGroupedByExpiry)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isGroupedByExpiry 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 scale-105' 
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                <Clock size={14} /> Group By Expiry
              </button>
              <button 
                onClick={() => setActiveFilter(activeFilter === 'pareto' ? null : 'pareto')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeFilter === 'pareto' 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                <Target size={14} /> VIP Pipeline (80/20)
              </button>
            </div>
          )}
        </div>

        {/* MAIN LEDGER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {activeFilter && activeFilter !== 'pareto' && (
               <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 px-4 py-3 rounded-xl">
                  <p className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                     <Filter size={14}/> Active Filter Applied
                  </p>
                  <button onClick={() => setActiveFilter(null)} className="flex items-center gap-1 text-[10px] font-black uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                     Clear Filter <FilterX size={12}/>
                  </button>
               </div>
            )}

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-5 w-12 text-center">
                       <input 
                         type="checkbox" 
                         checked={areAllVisibleQuotesSelected}
                         onChange={handleSelectAllVisibleQuotes}
                         className="w-4 h-4 rounded border-white/10 bg-black/50 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer" 
                       />
                    </th>
                    <th className="px-4 py-5">Household / Lead</th>
                    <th className="px-8 py-5">Document</th>
                    <th className="px-8 py-5">Amount & Terms</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isGroupedByExpiry && groupedQuotes ? (
                    groupedQuotes.length > 0 ? (
                      groupedQuotes.map(([dateDisplay, groupData]) => {
                        const selectableGroupIds = groupData.records.filter(r => r.status === 'pending').map(r => r.id);
                        const isGroupFullySelected = selectableGroupIds.length > 0 && selectableGroupIds.every(id => selectedRecordIds.includes(id));
                        const isCollapsed = collapsedGroups[dateDisplay];
                        
                        return (
                          <Fragment key={dateDisplay}>
                            <tr 
                              onClick={() => setCollapsedGroups(prev => ({ ...prev, [dateDisplay]: !prev[dateDisplay] }))}
                              className="bg-purple-500/10 border-y border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors group"
                            >
                              <td className="px-6 py-3 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                                {selectableGroupIds.length > 0 && (
                                  <input 
                                     type="checkbox" 
                                     checked={isGroupFullySelected}
                                     onChange={() => {
                                       if (isGroupFullySelected) {
                                         setSelectedRecordIds(prev => prev.filter(id => !selectableGroupIds.includes(id)));
                                       } else {
                                         setSelectedRecordIds(prev => Array.from(new Set([...prev, ...selectableGroupIds])));
                                       }
                                     }}
                                     className="w-4 h-4 rounded border-purple-500/30 bg-black/50 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer" 
                                  />
                                )}
                              </td>
                              <td colSpan={4} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-purple-400">
                                <div className="flex items-center gap-2">
                                  <ChevronRight 
                                    size={14} 
                                    className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} 
                                  />
                                  Expiry Date: {dateDisplay} 
                                  <span className="ml-2 px-2 py-0.5 bg-purple-500/20 rounded-md text-purple-300">
                                    {groupData.records.length} Quotes
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed && groupData.records.map((rec) => {
                              const needsInvoice = rec.doc_type === 'quote' && rec.status === 'accepted' && !rec.metadata?.converted_to_invoice;
                              const isVipQuote = vipQuoteIds.has(rec.id);
                              const isSelectable = rec.doc_type === 'quote' && rec.status === 'pending';
                              const isSelected = selectedRecordIds.includes(rec.id);
                              const dueDate = rec.expires_at 
                                  ? new Date(rec.expires_at).toLocaleDateString('en-ZA') 
                                  : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA');
                              
                              return (
                                <LedgerRow 
                                  key={rec.id}
                                  isSelected={isSelected}
                                  isSelectable={isSelectable}
                                  onToggleSelect={() => handleToggleSelectRecord(rec.id)}
                                  name={rec.profiles?.display_name || rec.metadata?.prospect_name || 'Unknown Entity'} 
                                  type={rec.doc_type === 'quote' ? 'Quotation' : 'Invoice'} 
                                  amount={`R ${rec.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                                  dueDate={dueDate}
                                  status={rec.status.charAt(0).toUpperCase() + rec.status.slice(1)} 
                                  refId={`${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`} 
                                  needsInvoice={needsInvoice}
                                  isVip={isVipQuote}
                                  onClick={() => handleViewDocument(rec)} 
                                  onProfileClick={(e: React.MouseEvent) => handleViewProspect(rec, e)}
                                />
                              );
                            })}
                          </Fragment>
                        );
                      })
                    ) : (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-sm italic">No quotes available to group.</td></tr>
                    )
                  ) : (
                    filteredRecords.map((rec) => {
                      const needsInvoice = rec.doc_type === 'quote' && rec.status === 'accepted' && !rec.metadata?.converted_to_invoice;
                      const isVipQuote = vipQuoteIds.has(rec.id);
                      const isSelectable = rec.doc_type === 'quote' && rec.status === 'pending';
                      const isSelected = selectedRecordIds.includes(rec.id);
                      const dueDate = rec.expires_at 
                          ? new Date(rec.expires_at).toLocaleDateString('en-ZA') 
                          : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA');
                      
                      return (
                        <LedgerRow 
                          key={rec.id}
                          isSelected={isSelected}
                          isSelectable={isSelectable}
                          onToggleSelect={() => handleToggleSelectRecord(rec.id)}
                          name={rec.profiles?.display_name || rec.metadata?.prospect_name || 'Unknown Entity'} 
                          type={rec.doc_type === 'quote' ? 'Quotation' : 'Invoice'} 
                          amount={`R ${rec.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                          dueDate={dueDate}
                          status={rec.status.charAt(0).toUpperCase() + rec.status.slice(1)} 
                          refId={`${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`} 
                          needsInvoice={needsInvoice}
                          isVip={isVipQuote}
                          onClick={() => handleViewDocument(rec)} 
                          onProfileClick={(e: React.MouseEvent) => handleViewProspect(rec, e)}
                        />
                      );
                    })
                  )}
                  {!isGroupedByExpiry && filteredRecords.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-sm italic">No records found matching your search or filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-6">
                <FileText size={18} className="text-purple-500"/> Sales Funnel
              </h3>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-purple-500/20 text-purple-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><FileText size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Quotes Generated</p>
                     <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-xl font-bold text-purple-400">{analytics.conversion.quotes}</p>
                        <p className="text-xs font-bold text-purple-400/50 italic">R {analytics.conversion.quotesValue.toLocaleString()}</p>
                     </div>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-emerald-500/20 text-emerald-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><CheckCircle2 size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Accepted Quotes</p>
                     <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-xl font-bold text-emerald-400">{analytics.conversion.acceptedQuotes}</p>
                        <p className="text-xs font-bold text-emerald-400/50 italic">R {analytics.conversion.acceptedValue.toLocaleString()}</p>
                     </div>
                  </div>
                </div>

              </div>
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Acceptance Rate</p>
                 <p className="text-2xl font-black italic mt-1 text-white">{analytics.conversion.rate.toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-6">
                <Receipt size={18} className="text-blue-500"/> Revenue Pipeline
              </h3>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-blue-500/20 text-blue-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><Receipt size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Invoices Issued</p>
                     <p className="text-xl font-bold mt-1 text-blue-400">R {analytics.conversion.invoicesValue.toLocaleString()}</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0f172a] bg-green-500/20 text-green-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"><Wallet size={14}/></div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-2xl border border-white/5 shadow">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Payments Captured</p>
                     <p className="text-xl font-bold mt-1 text-green-400">R {analytics.conversion.paidValue.toLocaleString()}</p>
                  </div>
                </div>

              </div>
              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collection Rate</p>
                 <p className="text-2xl font-black italic mt-1 text-white">{analytics.collections.rate.toFixed(1)}%</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MANUAL ENTRY MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.form 
              onSubmit={handleManualEntry}
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-white/10 rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 md:p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400"><CreditCard size={28} /></div>
                  <div>
                      <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Log Sage Record</h2>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-2">Historical Data Import</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="p-8 md:p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client / Guardian *</label>
                    <select 
                      required value={formData.guardian_id} onChange={e => setFormData({...formData, guardian_id: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select Client...</option>
                      {guardians.map(g => {
                        const email = g.metadata?.email || g.metadata?.prospect_email || 'No Email on File';
                        return (
                          <option key={g.id} value={g.id}>
                            {g.display_name} ({email})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Document Type *</label>
                    <select 
                      value={formData.doc_type} onChange={e => setFormData({...formData, doc_type: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase text-sm tracking-widest outline-none appearance-none cursor-pointer focus:border-emerald-500"
                    >
                      <option value="invoice">Invoice</option>
                      <option value="quote">Quote</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Document Number *</label>
                    <input 
                      required type="number" placeholder="e.g. 1042" value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Amount (ZAR) *</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R</span>
                      <input 
                        required type="number" step="0.01" placeholder="0.00" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})}
                        className="w-full bg-[#020617] border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white font-black tracking-tight outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description / Event Name *</label>
                  <input 
                    required type="text" placeholder="e.g. Home Automation Bootcamp (PLK)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <hr className="border-white/5" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date Issued (Backdate) *</label>
                    <input 
                      required type="date" value={formData.created_at} onChange={e => setFormData({...formData, created_at: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-sm outline-none focus:border-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Status *</label>
                    <select 
                      value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase text-sm tracking-widest outline-none appearance-none cursor-pointer focus:border-emerald-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid in Full</option>
                    </select>
                  </div>
                </div>

                <AnimatePresence>
                  {formData.status === 'paid' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                      <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Date Paid (Backdate) *</label>
                      <input 
                        required type="date" value={formData.paid_at} onChange={e => setFormData({...formData, paid_at: e.target.value})}
                        className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-6 py-4 text-emerald-400 font-mono text-sm outline-none focus:border-emerald-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest pt-2 flex items-center gap-1"><CheckCircle2 size={12}/> A payment record will automatically be generated.</p>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

              <div className="p-8 md:p-10 border-t border-white/5 bg-black/40 flex justify-between items-center gap-8 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                <button 
                  type="submit" disabled={isSubmittingManual}
                  className="bg-emerald-600 text-white px-10 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-emerald-500 shadow-2xl shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmittingManual ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Write_To_Ledger
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* SINGLE WHATSAPP MESSAGE MODAL */}
      <AnimatePresence>
        {isWhatsAppModalOpen && activeDoc && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWhatsAppModalOpen(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-white/10 rounded-[48px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#25D366]/20 rounded-2xl border border-[#25D366]/30 text-[#25D366]"><MessageCircle size={28} /></div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">WhatsApp Dispatch</h2>
                      <p className="text-[10px] font-black text-[#25D366] uppercase tracking-[0.2em] mt-2">To: {activeDoc.data.recipient.phone}</p>
                  </div>
                </div>
                <button onClick={() => setIsWhatsAppModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="p-8">
                 <div className="flex flex-col border border-white/10 rounded-[24px] overflow-hidden focus-within:border-[#25D366] transition-colors">
                    <div className="bg-white/5 px-6 py-4 text-sm font-medium text-slate-400">
                      Hi {activeDoc.data.recipient.name.split(' ')[0]},
                    </div>
                    <textarea 
                      rows={4}
                      placeholder="Type an optional custom message here... (e.g. Just a reminder to accept by Friday!)"
                      value={whatsAppBody}
                      onChange={(e) => setWhatsAppBody(e.target.value)}
                      className="w-full bg-[#020617] px-6 py-4 text-sm text-white outline-none resize-none leading-relaxed placeholder:text-slate-600"
                    />
                    <div className="bg-white/5 px-6 py-4 text-sm font-medium text-slate-400 border-t border-white/5 break-all">
                      Here is the link to review and accept your quote from RAD Academy:
                      <br /><br />
                      {window.location.origin}/quote/{activeDoc.data.docId}
                      <br /><br />
                      Let me know if you have any questions!
                    </div>
                 </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/40 flex justify-between items-center gap-8">
                <button onClick={() => setIsWhatsAppModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                <button 
                  onClick={() => {
                    const firstName = activeDoc.data.recipient.name.split(' ')[0] || "Client";
                    const link = `${window.location.origin}/quote/${activeDoc.data.docId}`;
                    const customText = whatsAppBody.trim() ? `${whatsAppBody.trim()}\n\n` : '';
                    
                    const fullMessage = `Hi ${firstName},\n\n${customText}Here is the link to review and accept your quote from RAD Academy:\n\n${link}\n\nLet me know if you have any questions!`;
                    const phone = formatWhatsAppNumber(activeDoc.data.recipient.phone);
                    
                    window.open(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(fullMessage)}`, '_blank');
                    setIsWhatsAppModalOpen(false);
                  }}
                  className="bg-[#25D366] text-[#020617] px-8 py-4 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-[#20bd5a] shadow-2xl shadow-[#25D366]/20 transition-all"
                >
                  <MessageCircle size={18} /> Launch App
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BATCH WHATSAPP DISPATCHER MODAL */}
      <AnimatePresence>
        {isBatchModalOpen && batchSelectedQuotes.length > 0 && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-[#25D366]/30 rounded-[48px] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(37,211,102,0.1)] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#25D366] text-[#0f172a] rounded-2xl shadow-lg shadow-[#25D366]/20"><Send size={28} /></div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Rapid-Fire Dispatch</h2>
                      <p className="text-[10px] font-black text-[#25D366] uppercase tracking-[0.2em] mt-2">
                         Queue: {batchIndex + 1} of {batchSelectedQuotes.length}
                      </p>
                  </div>
                </div>
                <button onClick={() => { setIsBatchModalOpen(false); setSelectedRecordIds([]); }} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-black/40">
                <motion.div 
                   className="h-full bg-[#25D366]"
                   initial={{ width: 0 }}
                   animate={{ width: `${((batchIndex) / batchSelectedQuotes.length) * 100}%` }}
                />
              </div>

              <div className="p-8 space-y-6">
                 {batchIndex === 0 && (
                   <p className="text-xs text-slate-400 font-medium leading-relaxed bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-blue-400">
                     <span className="font-black uppercase tracking-widest text-[10px] block mb-1">How this works:</span>
                     You are sending a bulk message. Write your master message once. When you click "Send & Next", WhatsApp will open for the current client. Switch back to this window to trigger the next one!
                   </p>
                 )}

                 <div className="flex flex-col border border-[#25D366]/30 rounded-[24px] overflow-hidden focus-within:border-[#25D366] transition-colors shadow-inner bg-[#020617]">
                    <div className="bg-white/5 px-6 py-4 text-sm font-medium text-emerald-400 border-b border-white/5">
                      Hi <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">{"{Client First Name}"}</span>,
                    </div>
                    <textarea 
                      rows={4}
                      placeholder="Type your master message here... (It will be sent to everyone in the queue)"
                      value={whatsAppBody}
                      onChange={(e) => setWhatsAppBody(e.target.value)}
                      className="w-full bg-transparent px-6 py-4 text-sm text-white outline-none resize-none leading-relaxed placeholder:text-slate-600"
                    />
                    <div className="bg-white/5 px-6 py-4 text-sm font-medium text-slate-400 border-t border-white/5">
                      Here is the link to review and accept your quote from RAD Academy:
                      <br /><br />
                      <span className="font-mono text-emerald-400 text-xs">{"{Unique Quote Link}"}</span>
                      <br /><br />
                      Let me know if you have any questions!
                    </div>
                 </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/40 flex justify-between items-center gap-8">
                <button onClick={() => { setIsBatchModalOpen(false); setSelectedRecordIds([]); }} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors">Abort Queue</button>
                <button 
                  onClick={() => {
                    const currentRec = batchSelectedQuotes[batchIndex];
                    const rawPhone = currentRec.metadata?.prospect_phone || currentRec.metadata?.phone || currentRec.profiles?.metadata?.phone || currentRec.profiles?.phone || currentRec.phone || "";
                    const safePhone = formatWhatsAppNumber(rawPhone.toString().trim());

                    const recipientName = currentRec.profiles?.display_name || currentRec.metadata?.prospect_name || "Client";
                    const firstName = recipientName.split(' ')[0];
                    const link = `${window.location.origin}/quote/${currentRec.id}`;
                    
                    const customText = whatsAppBody.trim() ? `${whatsAppBody.trim()}\n\n` : '';
                    const fullMessage = `Hi ${firstName},\n\n${customText}Here is the link to review and accept your quote from RAD Academy:\n\n${link}\n\nLet me know if you have any questions!`;
                    
                    if (safePhone && safePhone.length > 5) {
                       window.open(`whatsapp://send?phone=${safePhone}&text=${encodeURIComponent(fullMessage)}`, '_blank');
                    } else {
                       alert(`Warning: No valid phone number found for ${recipientName}. Opening WhatsApp with blank contact.`);
                       window.open(`whatsapp://send?text=${encodeURIComponent(fullMessage)}`, '_blank');
                    }

                    if (batchIndex < batchSelectedQuotes.length - 1) {
                       setBatchIndex(prev => prev + 1);
                    } else {
                       setIsBatchModalOpen(false);
                       setSelectedRecordIds([]);
                       setSuccessMessage("Batch Dispatch Complete!");
                    }
                  }}
                  className="bg-[#25D366] text-[#020617] px-8 py-4 rounded-3xl font-black uppercase italic text-xs tracking-widest flex items-center gap-3 hover:bg-[#20bd5a] shadow-2xl shadow-[#25D366]/20 transition-all"
                >
                  <Send size={18} /> {batchIndex < batchSelectedQuotes.length - 1 ? 'Send & Load Next' : 'Send Final'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOCUMENT VIEW SLIDE-OVER */}
      <AnimatePresence>
        {activeDoc && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => {setActiveDoc(null); setIsEditingItems(false);}} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="relative w-full max-w-5xl bg-[#020617] border-l border-white/10 h-full shadow-2xl flex flex-col p-8 space-y-8 overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                    <FileText size={24}/>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight">Financial_Inspector</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Secure_Vault_Node: {activeDoc.type.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={(e) => { handleViewProspect(activeDoc.data.rawRecord, e as any); setActiveDoc(null); setIsEditingItems(false); }} className="px-6 py-4 bg-blue-600/10 text-blue-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all flex items-center gap-2">
                     <User size={16}/> Client File
                   </button>
                   <button onClick={() => window.print()} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><Printer size={20}/></button>
                   <button onClick={() => {setActiveDoc(null); setIsEditingItems(false);}} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white border border-white/10 transition-all"><X size={24}/></button>
                </div>
              </div>

              {isEditingItems ? (
                <div className="flex-1 bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                   <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <h3 className="font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Edit3 size={16}/> Edit Line Items</h3>
                      <button onClick={() => setEditItems([...editItems, { desc: "", qty: 1, price: 0, disc: 0, disc_type: 'pct', disc_rand: "0.00" }])} className="text-xs font-bold text-blue-400 hover:text-white transition-colors">+ Add Item Row</button>
                   </div>
                   
                   <div className="space-y-3">
                      {editItems.map((item, idx) => (
                         <div key={idx} className="flex flex-wrap xl:flex-nowrap items-center gap-4 bg-[#0f172a] p-4 rounded-2xl border border-white/5">
                            <div className="w-full xl:flex-1 space-y-1">
                               <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Item Description</label>
                               <select 
                                  value={item.desc || ''}
                                  onChange={e => handleEditItemChange(idx, 'desc', e.target.value)}
                                  className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                               >
                                  <option value={item.desc}>{item.desc} (Custom)</option>
                                  {billingItems.map(b => (
                                     <option key={b.id} value={b.name}>{b.name}</option>
                                  ))}
                               </select>
                            </div>
                            <div className="w-20 space-y-1 shrink-0">
                               <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Qty</label>
                               <input type="number" min="1" value={item.qty || 1} onChange={e => handleEditItemChange(idx, 'qty', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                            </div>
                            <div className="w-28 space-y-1 shrink-0">
                               <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Price (R)</label>
                               <input type="number" step="0.01" value={item.price || 0} onChange={e => handleEditItemChange(idx, 'price', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                            </div>
                            <div className="w-20 space-y-1 shrink-0">
                               <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Disc (%)</label>
                               <input 
                                  type="number" step="0.01" 
                                  value={item.disc_type === 'rand' ? (Number(item.disc) || 0).toFixed(2) : (item.disc || 0)} 
                                  onChange={e => handleEditItemChange(idx, 'disc', e.target.value)} 
                                  className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" 
                               />
                            </div>
                            <div className="w-24 space-y-1 shrink-0">
                               <label className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Disc (R)</label>
                               <input 
                                  type="number" step="0.01" 
                                  value={item.disc_rand || ''} 
                                  onChange={e => handleEditItemChange(idx, 'disc_rand', e.target.value)} 
                                  className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-sm text-emerald-400 focus:border-emerald-500 outline-none" 
                               />
                            </div>
                            <button onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))} className="mt-4 p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors shrink-0"><Trash2 size={16}/></button>
                         </div>
                      ))}
                   </div>

                   <div className="flex justify-end pt-6 gap-4 border-t border-white/5">
                      <button onClick={() => setIsEditingItems(false)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                      <button onClick={handleSaveEditedItems} disabled={isUpdatingStatus} className="px-8 py-3 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 flex items-center gap-2 transition-all">
                         {isUpdatingStatus ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Update Document
                      </button>
                   </div>
                </div>
              ) : (
                <div className="flex-1 py-4" id="document-capture-area">
                  {activeDoc.type === 'statement' ? (
                    <RADStatement {...activeDoc.data} />
                  ) : (
                    <RADBillingDocument type={activeDoc.type as any} {...activeDoc.data} />
                  )}
                </div>
              )}

              <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4">
                 
                 {!isEditingItems && activeDoc.type !== 'statement' && (
                    <button 
                      onClick={() => { 
                        const initItems = activeDoc.data.items.map((item: any) => ({
                          ...item,
                          disc_type: 'pct',
                          disc_rand: ((Number(item.price||0) * Number(item.qty||0) * Number(item.disc||0)) / 100).toFixed(2)
                        }));
                        setEditItems(initItems); 
                        setIsEditingItems(true); 
                      }}
                      className="px-6 py-4 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2"
                    >
                      <Edit3 size={16} /> Edit Line Items
                    </button>
                 )}

                 {activeDoc.type === 'quote' && activeDoc.data.status === 'pending' && !isEditingItems && (
                    <button 
                      onClick={() => handleApproveQuoteProfile(false)}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-purple-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Mark Accepted
                    </button>
                 )}

                 {activeDoc.type === 'quote' && activeDoc.data.status === 'accepted' && !activeDoc.data.recipient.id && !isEditingItems && (
                    <button 
                      onClick={() => handleApproveQuoteProfile(true)}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-amber-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-amber-900/20"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={18} />} Verify & Create Profile
                    </button>
                 )}

                 {activeDoc.type === 'quote' && activeDoc.data.status === 'accepted' && activeDoc.data.recipient.id && !activeDoc.data.rawRecord?.metadata?.converted_to_invoice && !isEditingItems && (
                    <button 
                      onClick={() => router.push(`/admin/finance/composer?convertFromQuote=${activeDoc.data.docId}`)}
                      className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
                    >
                      <Receipt size={18} /> Convert to Invoice
                    </button>
                 )}

                 {activeDoc.type === 'invoice' && activeDoc.data.status === 'pending' && !isEditingItems && (
                    <button 
                      onClick={handleMarkPaid}
                      disabled={isUpdatingStatus}
                      className="px-8 py-4 bg-emerald-600 rounded-2xl font-black uppercase italic tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Mark Paid
                    </button>
                 )}
                 
                 {/* --- WHATSAPP COMPOSER TRIGGER (SINGLE) --- */}
                 {!isEditingItems && activeDoc.type === 'quote' && (
                   <button 
                     disabled={!activeDoc.data.recipient.phone || activeDoc.data.recipient.phone.length <= 5}
                     onClick={() => setIsWhatsAppModalOpen(true)}
                     className={`px-8 py-4 rounded-2xl font-black uppercase italic tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${
                       activeDoc.data.recipient.phone && activeDoc.data.recipient.phone.length > 5 
                         ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366] hover:text-white shadow-[#25D366]/10 cursor-pointer'
                         : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                     }`}
                     title={activeDoc.data.recipient.phone && activeDoc.data.recipient.phone.length > 5 ? "Send via WhatsApp" : "No valid phone number found for this lead"}
                   >
                     <MessageCircle size={16} /> Send via WhatsApp
                   </button>
                 )}

                 {/* Existing PDF Button */}
                 {!isEditingItems && (
                   <button 
                     onClick={handleDownloadPDF}
                     disabled={isGeneratingPdf}
                     className="px-10 py-4 bg-white/5 rounded-2xl font-black uppercase italic tracking-widest border border-white/10 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                   >
                     {isGeneratingPdf ? (
                       <><Loader2 size={16} className="animate-spin" /> Processing...</>
                     ) : (
                       <><Download size={16} /> PDF</>
                     )}
                   </button>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROSPECT WORKSPACE MODAL */}
      <AnimatePresence>
        {activeProspect && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveProspect(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="relative w-full max-w-2xl bg-[#020617] border-l border-white/10 h-full shadow-2xl flex flex-col p-10 space-y-10 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black uppercase italic text-white leading-none">{activeProspect.name}</h2>
                    <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Client_Intelligence_File</p>
                  </div>
                  <button onClick={() => setActiveProspect(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-white/10 py-8">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Primary Email</p>
                     <p className="font-bold text-slate-300">{activeProspect.email}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">CRM Status</p>
                     <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${activeProspect.id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {activeProspect.id ? 'Active Profile' : 'Pending Lead'}
                     </span>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Quotes</p>
                     <p className="text-2xl font-black text-purple-400">R {activeProspect.activeQuotes.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Lifetime Inv.</p>
                     <p className="text-2xl font-black text-blue-400">R {activeProspect.totalInvoiced.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[24px]">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Paid</p>
                     <p className="text-2xl font-black text-emerald-400">R {activeProspect.totalPaid.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Financial History Log</h3>
                   <div className="bg-black/50 border border-white/10 rounded-[32px] overflow-hidden">
                     {activeProspect.history.length > 0 ? (
                       <div className="divide-y divide-white/5">
                         {activeProspect.history.map((doc: any) => (
                           <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {setActiveProspect(null); handleViewDocument(doc);}}>
                             <div className="flex items-center gap-3">
                                {doc.doc_type === 'quote' ? <FileText size={16} className="text-purple-400"/> : <Receipt size={16} className="text-emerald-400"/>}
                                <div>
                                  <p className="text-sm font-bold text-white">{doc.doc_type === 'quote' ? 'QT' : 'INV'}-{doc.invoice_number}</p>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black text-slate-300">R {doc.total_amount.toLocaleString()}</p>
                               <p className={`text-[9px] font-black uppercase tracking-widest ${doc.status === 'paid' ? 'text-emerald-500' : doc.status === 'accepted' ? 'text-purple-500' : 'text-amber-500'}`}>{doc.status}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <p className="p-8 text-center text-slate-600 text-xs italic">No financial history on record.</p>
                     )}
                   </div>
                </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage(null)} />
    </div>
  );
}

function LedgerRow({ name, type, amount, dueDate, status, refId, needsInvoice, isVip, onClick, onProfileClick, isSelectable, isSelected, onToggleSelect }: any) {
  const isOverdue = status === 'Overdue';
  const isQuote = type === 'Quotation';
  const isAccepted = status === 'Accepted';
  const isDeclined = status === 'Declined';
  const isPaid = status === 'Paid' || status === 'Settled';

  return (
    <tr 
      onClick={onClick} 
      className={`transition-colors group cursor-pointer ${
        needsInvoice 
          ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.08] border-l-4 border-amber-500' 
          : isVip 
          ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.12] border-l-4 border-amber-500/60'
          : isSelected
          ? 'bg-[#25D366]/10 hover:bg-[#25D366]/20 border-l-4 border-[#25D366]'
          : 'hover:bg-white/[0.02] border-l-4 border-transparent'
      }`}
    >
      <td className="px-6 py-5 w-12 text-center relative" onClick={(e) => e.stopPropagation()}>
        {isSelectable && (
           <input 
             type="checkbox" 
             checked={isSelected}
             onChange={onToggleSelect}
             className="w-4 h-4 rounded border-white/10 bg-black/50 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer" 
           />
        )}
      </td>
      <td className="px-4 py-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onProfileClick}
            className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-500/30"
            title="Open Client File"
          >
            <User size={14} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-sm">{name}</p>
              {needsInvoice && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded animate-pulse border border-amber-500/30">
                  Needs Invoice
                </span>
              )}
              {isVip && !needsInvoice && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/30 flex items-center gap-1">
                  <Target size={10} /> VIP Pipeline
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{refId}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          {isQuote ? <FileText size={14} className="text-purple-400"/> : <Receipt size={14} className="text-emerald-400"/>}
          {type}
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex flex-col items-start justify-center">
          <span className="text-sm font-black text-slate-300 whitespace-nowrap">{amount}</span>
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1.5">
            <Clock size={10} /> {isQuote ? 'Valid Until:' : 'Due Date:'} {dueDate}
          </div>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
          isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
          isDeclined ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
          isAccepted ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
          isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------
// SUCCESS MODAL NOTIFICATION WIDGET
// ---------------------------------------------------------
function SuccessModal({ message, onClose }: { message: string | null, onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <div className="fixed bottom-10 right-10 z-[300] flex justify-end pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.9 }} 
            className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-emerald-900/20 flex items-center gap-4 max-w-sm w-full pointer-events-auto relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="text-emerald-400" size={20} />
            </div>
            <div className="flex-1 pr-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none mb-1">Success</h3>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">{message}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}