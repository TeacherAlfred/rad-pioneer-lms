"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, CreditCard, TrendingUp, AlertTriangle, Tag, Users, ArrowUpRight,
  CheckCircle2, Clock, Filter, Search, Download, UserPlus, MessageCircle,
  Plus, ChevronRight, Wallet, Receipt, Loader2, Activity, X, Shield, FileText, Printer, BarChart3, Package, FilterX, User, Target, Save, Edit3, Trash2, Send, Coins
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
       if (q.status === 'accepted' || q.status === 'invoiced') {
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
          paid_at: formData.status === 'paid' ? paymentDate : null,
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
        </header>

        {/* MACRO-ECONOMICS HERO SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-gradient-to-br from-emerald-500/10 to-[#020617] border border-emerald-500/20 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={120} /></div>
             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 relative z-10">Monthly Top Line Revenue</p>
             <p className="text-5xl font-black tracking-tighter text-white relative z-10 mb-4">R {analytics.invoices.monthGenerated.toLocaleString()}</p>
             
             <div className="flex gap-4 relative z-10 border-t border-white/5 pt-4">
               <div>
                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Collected</p>
                 <p className="text-lg font-bold text-emerald-400">R {(analytics.invoices.monthGenerated - analytics.invoices.monthOutstanding).toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Outstanding</p>
                 <p className="text-lg font-bold text-rose-400">R {analytics.invoices.monthOutstanding.toLocaleString()}</p>
               </div>
             </div>
           </div>

           {/* TOTAL PIPELINE VALUE - NOW CLICKABLE! */}
           <div 
             onClick={() => router.push('/admin/finance/pipeline')}
             className="bg-gradient-to-br from-purple-500/10 to-[#020617] border border-purple-500/20 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_50px_rgba(168,85,247,0.2)] transition-all"
           >
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all"><FileText size={120} /></div>
             
             {/* Link indicator */}
             <div className="absolute top-8 right-8 p-3 bg-purple-500/20 rounded-full text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
               <ArrowUpRight size={24} />
             </div>

             <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 relative z-10">Total Pipeline Value</p>
             <p className="text-5xl font-black tracking-tighter text-white relative z-10 mb-4 group-hover:text-purple-300 transition-colors">R {analytics.conversion.quotesValue.toLocaleString()}</p>
             
             <div className="flex gap-4 relative z-10 border-t border-white/5 pt-4">
               <div>
                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Accepted</p>
                 <p className="text-lg font-bold text-emerald-400">R {analytics.conversion.acceptedValue.toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Pending</p>
                 <p className="text-lg font-bold text-amber-400">R {(analytics.conversion.quotesValue - analytics.conversion.acceptedValue).toLocaleString()}</p>
               </div>
             </div>
           </div>
        </div>

        {/* OPERATIONS GRID (THE COMMAND CENTER) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           
           {/* Module: Client Ledger & Accounts Receivable */}
           <Link href="/admin/finance/ledger" className="lg:col-span-2 group">
             <div className="h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-emerald-500/50 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden">
                <Users className="absolute -right-4 -bottom-4 text-emerald-500/5 group-hover:text-emerald-500/10 group-hover:scale-110 transition-all" size={120} />
                <div className="relative z-10">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4"><Users size={20}/></div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Accounts Receivable</h3>
                  <p className="text-sm font-bold text-slate-400">Client Ledger & Cashflow tracking. View who owes what, and when they owe it.</p>
                </div>
                <div className="relative z-10 flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Access Ledger</p>
                  <ChevronRight className="text-emerald-500 group-hover:translate-x-1 transition-transform" />
                </div>
             </div>
           </Link>

           {/* Module: Payment Capture */}
           <Link href="/admin/finance/capture" className="group">
             <div className="h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-blue-500/50 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden">
                <Coins className="absolute -right-4 -bottom-4 text-blue-500/5 group-hover:text-blue-500/10 group-hover:scale-110 transition-all" size={120} />
                <div className="relative z-10">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl w-fit mb-4"><Coins size={20}/></div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Capture Payment</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">Auto-allocate lump sums and manage credits.</p>
                </div>
                <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex justify-end">
                  <ArrowUpRight className="text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
             </div>
           </Link>

           {/* Module: Document Composer */}
           <Link href="/admin/finance/composer" className="group">
             <div className="h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-purple-500/50 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden">
                <FileText className="absolute -right-4 -bottom-4 text-purple-500/5 group-hover:text-purple-500/10 group-hover:scale-110 transition-all" size={120} />
                <div className="relative z-10">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4"><Plus size={20}/></div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Compose Doc</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">Draft new Quotes, Invoices, and Statements.</p>
                </div>
                <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex justify-end">
                  <ArrowUpRight className="text-purple-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
             </div>
           </Link>

           {/* Module: Unit Economics */}
           <Link href="/admin/finance/insights" className="lg:col-span-2 group">
             <div className="h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-amber-500/50 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden">
                <Activity className="absolute -right-4 -bottom-4 text-amber-500/5 group-hover:text-amber-500/10 group-hover:scale-110 transition-all" size={120} />
                <div className="relative z-10">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4"><Activity size={20}/></div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Revenue Intelligence</h3>
                  <p className="text-sm font-bold text-slate-400">Deep dive into Profit Margins, COGS, and Cohort LTV.</p>
                </div>
                <div className="relative z-10 flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Analyze Profitability</p>
                  <ChevronRight className="text-amber-500 group-hover:translate-x-1 transition-transform" />
                </div>
             </div>
           </Link>

           {/* Module: Item Catalog */}
           <Link href="/admin/finance/items" className="group">
             <div className="h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-slate-400 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden">
                <Tag className="absolute -right-4 -bottom-4 text-slate-500/10 group-hover:text-slate-500/20 group-hover:scale-110 transition-all" size={120} />
                <div className="relative z-10">
                  <div className="p-3 bg-slate-800 text-slate-300 rounded-xl w-fit mb-4"><Tag size={20}/></div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Item Catalog</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">Manage your SKUs, pricing, and COGS.</p>
                </div>
                <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex justify-end">
                  <ArrowUpRight className="text-slate-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
             </div>
           </Link>

           {/* Manual Action Card */}
           <div className="group h-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-emerald-500/50 rounded-[32px] p-8 transition-all flex flex-col justify-between relative overflow-hidden cursor-pointer" onClick={() => setIsModalOpen(true)}>
              <div className="relative z-10">
                <div className="p-3 bg-white/5 text-slate-300 rounded-xl w-fit mb-4"><Download size={20}/></div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Historical Import</h3>
                <p className="text-xs font-bold text-slate-400 leading-relaxed">Manually log old Sage/Xero records to balance the new ledger.</p>
              </div>
           </div>

        </div>

        {/* RECENT ACTIVITY & PAYFAST LOG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* GENERAL TRANSACTIONS */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Clock size={16}/> General Activity</h3>
               <Link href="/admin/finance/ledger" className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors">View Ledger</Link>
            </div>
            <div className="divide-y divide-white/5 flex-1">
               {records.slice(0, 5).map(rec => (
                 <div key={rec.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${rec.doc_type === 'quote' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        {rec.doc_type === 'quote' ? <FileText size={16}/> : <Receipt size={16}/>}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{rec.profiles?.display_name || rec.metadata?.prospect_name || 'Unknown Client'}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{rec.doc_type === 'quote' ? 'QT' : 'INV'}-{rec.invoice_number}</span>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">• {new Date(rec.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white">R {Number(rec.total_amount).toLocaleString()}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                        rec.status === 'paid' ? 'text-emerald-500' :
                        rec.status === 'accepted' ? 'text-purple-400' :
                        rec.status === 'overdue' ? 'text-rose-500' : 'text-amber-500'
                      }`}>{rec.status.replace('_', ' ')}</p>
                    </div>
                 </div>
               ))}
               {records.length === 0 && <p className="py-8 text-center text-slate-500 text-sm font-bold italic">No recent transactions found.</p>}
            </div>
          </div>

          {/* NEW: PAYFAST & PAYMENTS LOG */}
          <div className="bg-gradient-to-b from-emerald-500/10 to-[#020617] border border-emerald-500/20 rounded-[40px] p-8 shadow-2xl space-y-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><CreditCard size={120}/></div>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4 relative z-10">
               <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><CreditCard size={16}/> Payment & ITN Log</h3>
               <Link href="/admin/finance/capture" className="text-[10px] font-bold text-emerald-400 hover:text-white transition-colors">Manual Capture</Link>
            </div>
            <div className="divide-y divide-emerald-500/10 flex-1 relative z-10">
               {records
                 .filter(r => r.doc_type === 'invoice' && (r.status === 'itn_received' || r.status === 'paid' || Number(r.amount_paid) > 0))
                 .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
                 .slice(0, 5)
                 .map(rec => {
                   const isPayFast = rec.status === 'itn_received';
                   const amountToDisplay = Number(rec.amount_paid) > 0 ? Number(rec.amount_paid) : Number(rec.total_amount);
                   
                   return (
                     <div key={`pay-${rec.id}`} className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isPayFast ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                            <Coins size={16}/>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">{rec.profiles?.display_name || 'Unknown Client'}</p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">INV-{rec.invoice_number}</span>
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">• {new Date(rec.updated_at || rec.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-emerald-400">+ R {amountToDisplay.toLocaleString()}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isPayFast ? 'text-amber-400 animate-pulse' : 'text-emerald-500'}`}>
                            {isPayFast ? 'PayFast ITN' : 'Manual Paid'}
                          </p>
                        </div>
                     </div>
                   )
               })}
               {records.filter(r => r.doc_type === 'invoice' && (r.status === 'itn_received' || r.status === 'paid' || Number(r.amount_paid) > 0)).length === 0 && (
                 <p className="py-8 text-center text-emerald-500/50 text-sm font-bold italic">No payments logged yet.</p>
               )}
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

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage(null)} />
    </div>
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