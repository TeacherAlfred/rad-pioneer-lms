"use client";
"use no memo";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Tag, Loader2, ArrowLeft, X, Save, TrendingUp, Activity, Zap,
  Pencil, Trash2, AlignLeft, ListPlus, Receipt, Link as LinkIcon, 
  Store, Truck, AlertOctagon, ArrowRightLeft, Crown, Percent, Package,
  FileText, Edit3, CheckCircle2, ChevronDown, ChevronUp, Search
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Import document components
import RADBillingDocument from "@/components/finance/RADBillingDocument";
import RADStatement from "@/components/finance/RADStatement";

export default function ItemsPortal() {
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- Main Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "", price: "", internal_notes: "", category: "Tuition",
    cost_breakdown: [] as { id: string, name: string, amount: number, supplier_id: string, url: string }[]
  });

  const [supplierModalTarget, setSupplierModalTarget] = useState<string | null>(null);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", website: "", location: "", delivery_type: "Delivery" });

  // --- Mapping & Document Editor State ---
  const [isMapping, setIsMapping] = useState<string | null>(null); 
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  
  const [activeDoc, setActiveDoc] = useState<{ type: 'invoice' | 'statement' | 'quote', data: any } | null>(null);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>('all_time');

  // --- Drilldown Modal State ---
  const [drilldown, setDrilldown] = useState<{ metric: string, item: string, invoices: any[] } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [itemsRes, suppliersRes, invoicesRes] = await Promise.all([
        supabase.from('billing_items').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name', { ascending: true }),
        supabase.from('billing_records').select('*, profiles(display_name)').eq('doc_type', 'invoice')
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      setItems(itemsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // ECONOMICS & ANOMALY ENGINE
  // ==========================================
  const economics = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0); // Default: All Time

    if (timeFilter === 'ytd') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (timeFilter === 'past_year') {
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    } else if (timeFilter === 'mtd') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeFilter === 'past_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const itemStats = new Map<string, { 
      id: string, name: string, qty: number, rev: number, cost: number, gp: number, invoicedRev: number,
      allInvoices: any[], paidInvoices: any[] 
    }>();
    const unmappedSet = new Map<string, { count: number, rev: number, invoices: any[] }>();

    items.forEach(item => {
      itemStats.set(item.name.toLowerCase().trim(), {
        id: item.id, name: item.name, qty: 0, rev: 0, cost: Number(item.cost) || 0, gp: 0, invoicedRev: 0,
        allInvoices: [], paidInvoices: []
      });
    });

    const findOfficialItem = (desc: string) => {
      const lowerDesc = desc.toLowerCase().trim();
      const directMatch = items.find(i => i.name.toLowerCase().trim() === lowerDesc);
      if (directMatch) return directMatch;
      return items.find(i => i.aliases && i.aliases.some((a: string) => a.toLowerCase().trim() === lowerDesc));
    };

    invoices.forEach(inv => {
      const invDate = new Date(inv.created_at);
      if (invDate < startDate) return; // GLOBAL TIME FILTER APPLIED HERE

      const isPaid = inv.status?.toLowerCase() === 'paid' || inv.status?.toLowerCase() === 'settled';

      inv.line_items?.forEach((li: any) => {
        const rawDesc = li.desc || li.description || "Unknown Item";
        const officialItem = findOfficialItem(rawDesc);
        const qty = Number(li.qty) || 1;
        const price = Number(li.price) || 0;
        const disc = Number(li.disc) || 0;
        const netRev = (price * qty) * (1 - disc / 100);

        if (officialItem) {
          const stat = itemStats.get(officialItem.name.toLowerCase().trim())!;
          
          stat.invoicedRev += netRev;
          if (!stat.allInvoices.find(i => i.id === inv.id)) stat.allInvoices.push(inv);
          
          if (isPaid) {
            stat.qty += qty;
            stat.rev += netRev;
            stat.gp += (netRev - (stat.cost * qty));
            if (!stat.paidInvoices.find(i => i.id === inv.id)) stat.paidInvoices.push(inv);
          }
        } else {
          if (!unmappedSet.has(rawDesc)) unmappedSet.set(rawDesc, { count: 0, rev: 0, invoices: [] });
          const u = unmappedSet.get(rawDesc)!;
          u.count += qty;
          u.rev += netRev; 
          if (!u.invoices.find(i => i.id === inv.id)) u.invoices.push(inv);
        }
      });
    });

    let topSeller = { name: "N/A", qty: 0, rev: 0, gp: 0, margin: 0, totalCost: 0, invoicedRev: 0, paidRev: 0, allInvoices: [] as any[], paidInvoices: [] as any[] };
    let topGP = { name: "N/A", qty: 0, rev: 0, gp: 0, margin: 0, totalCost: 0, invoicedRev: 0, paidRev: 0, allInvoices: [] as any[], paidInvoices: [] as any[] };
    let bestMargin = { name: "N/A", qty: 0, rev: 0, gp: 0, margin: 0, totalCost: 0, invoicedRev: 0, paidRev: 0, allInvoices: [] as any[], paidInvoices: [] as any[] };
    
    // Global Aggregate Accumulator
    let aggregate = { units: 0, invoiced: 0, paid: 0, outstanding: 0, cost: 0, gp: 0, margin: 0 };

    itemStats.forEach(stat => {
      const margin = stat.rev > 0 ? (stat.gp / stat.rev) * 100 : 0;
      const totalCost = stat.cost * stat.qty;

      aggregate.units += stat.qty;
      aggregate.invoiced += stat.invoicedRev;
      aggregate.paid += stat.rev;
      aggregate.cost += totalCost;
      aggregate.gp += stat.gp;

      if (stat.qty > topSeller.qty) {
        topSeller = { name: stat.name, qty: stat.qty, rev: stat.rev, gp: stat.gp, margin, totalCost, invoicedRev: stat.invoicedRev, paidRev: stat.rev, allInvoices: stat.allInvoices, paidInvoices: stat.paidInvoices };
      }
      if (stat.gp > topGP.gp) {
        topGP = { name: stat.name, qty: stat.qty, rev: stat.rev, gp: stat.gp, margin, totalCost, invoicedRev: stat.invoicedRev, paidRev: stat.rev, allInvoices: stat.allInvoices, paidInvoices: stat.paidInvoices };
      }
      if (margin > bestMargin.margin && stat.qty > 0) { 
        bestMargin = { name: stat.name, qty: stat.qty, rev: stat.rev, gp: stat.gp, margin, totalCost, invoicedRev: stat.invoicedRev, paidRev: stat.rev, allInvoices: stat.allInvoices, paidInvoices: stat.paidInvoices };
      }
    });

    aggregate.outstanding = aggregate.invoiced - aggregate.paid;
    aggregate.margin = aggregate.paid > 0 ? (aggregate.gp / aggregate.paid) * 100 : 0;

    return {
      topSeller,
      topGP,
      bestMargin,
      aggregate,
      unmapped: Array.from(unmappedSet.entries()).map(([desc, data]) => ({ desc, ...data })).sort((a, b) => b.rev - a.rev)
    };
  }, [items, invoices, timeFilter]);


  // --- DYNAMIC CATEGORY & COST ENGINES ---
  const dynamicCategories = useMemo(() => {
    const categorySet = new Set(["Bootcamp", "Tuition", "Hardware", "Event", "Other"]);
    items.forEach(item => item.category && categorySet.add(item.category));
    return Array.from(categorySet).sort();
  }, [items]);

  const historicalCosts = useMemo(() => {
    const costsMap = new Map<string, number>();
    items.forEach(item => {
      item.cost_breakdown?.forEach((cb: any) => {
        if (!costsMap.has(cb.name) && cb.name.trim() !== "") costsMap.set(cb.name, Number(cb.amount));
      });
    });
    return Array.from(costsMap.entries()).map(([name, amount]) => ({ name, amount }));
  }, [items]);

  const totalCost = formData.cost_breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // --- ITEM CATALOG HANDLERS ---
  const handleAddCostLine = () => setFormData(prev => ({ ...prev, cost_breakdown: [...prev.cost_breakdown, { id: Math.random().toString(36).substring(7), name: "", amount: 0, supplier_id: "", url: "" }] }));
  const handleRemoveCostLine = (id: string) => setFormData(prev => ({ ...prev, cost_breakdown: prev.cost_breakdown.filter(cb => cb.id !== id) }));
  const handleCostLineChange = (id: string, field: 'name' | 'amount' | 'supplier_id' | 'url', value: string) => {
    setFormData(prev => {
      const newBreakdown = prev.cost_breakdown.map(cb => {
        if (cb.id === id) {
          const updated = { ...cb, [field]: field === 'amount' ? parseFloat(value) || 0 : value };
          if (field === 'name') {
            const match = historicalCosts.find(hc => hc.name.toLowerCase() === value.toLowerCase());
            if (match && cb.amount === 0) updated.amount = match.amount;
          }
          return updated;
        }
        return cb;
      });
      return { ...prev, cost_breakdown: newBreakdown };
    });
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;
    setIsSavingSupplier(true);
    try {
      const { data, error } = await supabase.from('suppliers').insert([newSupplier]).select().single();
      if (error) throw error;
      setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      if (supplierModalTarget) handleCostLineChange(supplierModalTarget, 'supplier_id', data.id);
      setNewSupplier({ name: "", website: "", location: "", delivery_type: "Delivery" });
      setSupplierModalTarget(null);
    } catch (err: any) { alert("Failed to save supplier: " + err.message); } 
    finally { setIsSavingSupplier(false); }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({ name: "", price: "", internal_notes: "", category: "Tuition", cost_breakdown: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      name: item.name, price: item.price.toString(), internal_notes: item.internal_notes || "",
      category: item.category, cost_breakdown: item.cost_breakdown || []
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const cleanBreakdown = formData.cost_breakdown.filter(cb => cb.name.trim() !== "");
    const finalTotalCost = cleanBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    try {
      const payload = {
        name: formData.name, price: parseFloat(formData.price), cost: finalTotalCost, 
        cost_breakdown: cleanBreakdown, internal_notes: formData.internal_notes, category: formData.category, is_active: true
      };
      if (editingId) {
        const { error } = await supabase.from('billing_items').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('billing_items').insert([payload]);
        if (error) throw error;
      }
      setFormData({ name: "", price: "", internal_notes: "", category: "Tuition", cost_breakdown: [] });
      setEditingId(null);
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) { alert(`Failed to ${editingId ? 'update' : 'create'} item: ` + err.message); } 
    finally { setIsSaving(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this catalog item? This cannot be undone and may un-link historical analytics.")) return;
    try {
      const { error } = await supabase.from('billing_items').delete().eq('id', id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== id));
    } catch (err: any) {
      alert("Failed to delete item: " + err.message);
    }
  };

  const handleMapAnomaly = async (targetCatalogId: string) => {
    if (!isMapping || !targetCatalogId) return;
    setIsSaving(true);
    try {
      const targetItem = items.find(i => i.id === targetCatalogId);
      const currentAliases = targetItem.aliases || [];
      const newAliases = [...new Set([...currentAliases, isMapping])]; 
      const { error } = await supabase.from('billing_items').update({ aliases: newAliases }).eq('id', targetCatalogId);
      if (error) throw error;
      setIsMapping(null);
      await fetchData(); 
    } catch (err: any) { alert("Failed to map item: " + err.message); } 
    finally { setIsSaving(false); }
  };


  // ==========================================
  // INLINE DOCUMENT EDITOR HANDLERS
  // ==========================================
  const handleViewDocument = (rec: any) => {
    const recipientName = rec.profiles?.display_name || rec.metadata?.prospect_name || "Unknown Guardian";
    const recipientEmail = rec.profiles?.email || rec.metadata?.prospect_email || "";

    const sanitizedItems = (rec.line_items || []).map((item: any) => ({
      desc: item.desc || item.description || 'Custom Entry',
      qty: Number(item.qty) || 1,
      price: Number(item.price) || Number(item.amount) || Number(rec.total_amount) || 0,
      disc: Number(item.disc) || 0
    }));

    setActiveDoc({
      type: rec.doc_type || 'invoice',
      data: {
        rawRecord: rec, docId: rec.id, status: rec.status,
        docNumber: `${rec.doc_type === 'quote' ? 'QT' : 'INV'}-${rec.invoice_number}`,
        recipient: { id: rec.guardian_id, name: recipientName, email: recipientEmail },
        items: sanitizedItems,
        date: new Date(rec.created_at).toLocaleDateString('en-ZA'),
        dueDate: rec.expires_at ? new Date(rec.expires_at).toLocaleDateString('en-ZA') : new Date(new Date(rec.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA'),
        globalNote: rec.metadata?.global_note
      }
    });
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
      const sysItem = items.find(b => b.name === value);
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
        desc: item.desc, qty: Number(item.qty) || 0, price: Number(item.price) || 0, disc: Number(item.disc) || 0
      }));

      const { error } = await supabase
        .from('billing_records')
        .update({ line_items: cleanedItems, total_amount: newTotal })
        .eq('id', activeDoc.data.docId);

      if (error) throw error;

      setActiveDoc({
        ...activeDoc,
        data: {
          ...activeDoc.data, items: cleanedItems,
          rawRecord: { ...activeDoc.data.rawRecord, line_items: cleanedItems, total_amount: newTotal }
        }
      });

      setIsEditingItems(false);
      fetchData(); // Refreshes Anomaly Radar!

    } catch (err: any) { alert("Failed to save items: " + err.message); } 
    finally { setIsUpdatingStatus(false); }
  };


  const formatSKU = (id: string) => id ? `SKU-${id.substring(0, 8).toUpperCase()}` : "SKU-UNKNOWN";
  const calculateMargin = (price: number, cost: number) => (!price || price <= 0) ? 0 : Math.round(((price - cost) / price) * 100);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/finance" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2 transition-colors w-fit">
              <ArrowLeft size={14}/> Back to Finance
            </Link>
            <div className="space-y-1">
               <div className="flex items-center gap-2 text-emerald-500">
                 <Activity size={14} />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em]">Economics_Engine</span>
               </div>
               <h1 className="text-5xl font-black tracking-tighter italic uppercase">Items_<span className="text-emerald-500">Catalog</span></h1>
            </div>
          </div>
          <button 
            onClick={handleOpenNew}
            className="bg-emerald-600 hover:bg-emerald-500 transition-all px-8 py-4 rounded-2xl font-black uppercase text-xs flex items-center gap-2 shadow-xl shadow-emerald-900/20 shrink-0"
          >
            <Plus size={16}/> Define New Item
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="animate-spin text-emerald-500" size={40} />
             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Loading Catalog & Economics...</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* NORTH STAR ITEM METRICS */}
            <div className="space-y-6">
              
              {/* GLOBAL TIME FILTER */}
              <div className="flex justify-center w-full">
                <div className="flex flex-wrap items-center justify-center gap-2 bg-[#0f172a] p-2 rounded-2xl w-fit border border-white/5 shadow-lg">
                  {[
                    { id: 'all_time', label: 'All Time' },
                    { id: 'ytd', label: 'YTD' },
                    { id: 'past_year', label: 'Past 12 Months' },
                    { id: 'mtd', label: 'MTD' },
                    { id: 'past_30_days', label: 'Past 30 Days' }
                  ].map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setTimeFilter(filter.id)}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        timeFilter === filter.id 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* GLOBAL AGGREGATE STRIP */}
              <div className="bg-[#0f172a] border border-white/5 shadow-2xl rounded-[32px] p-6 md:p-8 flex flex-wrap lg:flex-nowrap items-center justify-between gap-6">
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Units Sold</p>
                   <p className="text-xl lg:text-2xl font-black text-blue-400">{economics.aggregate.units}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Invoiced</p>
                   <p className="text-xl lg:text-2xl font-black text-slate-300">R {Math.round(economics.aggregate.invoiced).toLocaleString()}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Paid</p>
                   <p className="text-xl lg:text-2xl font-black text-emerald-400">R {Math.round(economics.aggregate.paid).toLocaleString()}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Outstanding</p>
                   <p className="text-xl lg:text-2xl font-black text-amber-400">R {Math.round(economics.aggregate.outstanding).toLocaleString()}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Cost</p>
                   <p className="text-xl lg:text-2xl font-black text-rose-400">R {Math.round(economics.aggregate.cost).toLocaleString()}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total GP</p>
                   <p className="text-xl lg:text-2xl font-black text-emerald-500">R {Math.round(economics.aggregate.gp).toLocaleString()}</p>
                </div>
                <div className="hidden lg:block w-px h-10 bg-white/5"></div>
                <div className="space-y-1 w-[45%] lg:w-auto">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Margin</p>
                   <p className="text-xl lg:text-2xl font-black text-purple-400">{economics.aggregate.margin.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Card 1: Volume King */}
                <div className="bg-gradient-to-br from-blue-500/10 to-[#020617] border border-blue-500/20 rounded-[32px] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <Package className="absolute -right-4 -bottom-4 text-blue-500/10" size={120} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-2"><Crown size={14}/> Volume King</p>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tighter italic uppercase text-white leading-tight relative z-10 break-words whitespace-normal">{economics.topSeller.name}</h3>
                  </div>
                  <div className="mt-6 relative z-10">
                    <button onClick={() => setDrilldown({ metric: 'Units Sold', item: economics.topSeller.name, invoices: economics.topSeller.paidInvoices })} className="text-4xl font-black text-blue-400 tracking-tighter hover:text-blue-300 transition-colors underline decoration-blue-500/30 decoration-dashed underline-offset-4 text-left">
                      {economics.topSeller.qty} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Units</span>
                    </button>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-500/20 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg GP / Unit</p>
                         <p className="text-sm text-emerald-400">R {economics.topSeller.qty > 0 ? Math.round(economics.topSeller.gp / economics.topSeller.qty).toLocaleString() : 0}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Total Cost</p>
                         <p className="text-sm text-rose-400">R {Math.round(economics.topSeller.totalCost).toLocaleString()}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Gross Profit</p>
                         <p className="text-sm text-emerald-400">R {Math.round(economics.topSeller.gp).toLocaleString()}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Net Margin</p>
                         <p className="text-sm text-purple-400">{economics.topSeller.margin.toFixed(1)}%</p>
                       </div>
                    </div>
                    {/* COLLECTIONS ROW */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-blue-500/10 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Invoiced</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Invoiced', item: economics.topSeller.name, invoices: economics.topSeller.allInvoices })} className="text-sm text-slate-300 hover:text-blue-300 transition-colors underline decoration-white/30 decoration-dashed underline-offset-4">R {Math.round(economics.topSeller.invoicedRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Paid</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Paid', item: economics.topSeller.name, invoices: economics.topSeller.paidInvoices })} className="text-sm text-emerald-400 hover:text-blue-300 transition-colors underline decoration-emerald-500/30 decoration-dashed underline-offset-4">R {Math.round(economics.topSeller.paidRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Unpaid</p>
                         <p className="text-sm text-amber-400">R {Math.round(economics.topSeller.invoicedRev - economics.topSeller.paidRev).toLocaleString()}</p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Profit King */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-[#020617] border border-emerald-500/20 rounded-[32px] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <TrendingUp className="absolute -right-4 -bottom-4 text-emerald-500/10" size={120} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><Zap size={14}/> Profit King</p>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tighter italic uppercase text-white leading-tight relative z-10 break-words whitespace-normal">{economics.topGP.name}</h3>
                  </div>
                  <div className="mt-6 relative z-10">
                    <p className="text-4xl font-black text-emerald-400 tracking-tighter">R {Math.round(economics.topGP.gp).toLocaleString()} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">GP</span></p>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-500/20 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Units Sold</p>
                         <button onClick={() => setDrilldown({ metric: 'Units Sold', item: economics.topGP.name, invoices: economics.topGP.paidInvoices })} className="text-sm text-blue-400 hover:text-emerald-300 transition-colors underline decoration-blue-500/30 decoration-dashed underline-offset-4">{economics.topGP.qty}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Net Margin</p>
                         <p className="text-sm text-purple-400">{economics.topGP.margin.toFixed(1)}%</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg GP / Unit</p>
                         <p className="text-sm text-emerald-400">R {economics.topGP.qty > 0 ? Math.round(economics.topGP.gp / economics.topGP.qty).toLocaleString() : 0}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Total Cost</p>
                         <p className="text-sm text-rose-400">R {Math.round(economics.topGP.totalCost).toLocaleString()}</p>
                       </div>
                    </div>
                    {/* COLLECTIONS ROW */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-500/10 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Invoiced</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Invoiced', item: economics.topGP.name, invoices: economics.topGP.allInvoices })} className="text-sm text-slate-300 hover:text-emerald-300 transition-colors underline decoration-white/30 decoration-dashed underline-offset-4">R {Math.round(economics.topGP.invoicedRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Paid</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Paid', item: economics.topGP.name, invoices: economics.topGP.paidInvoices })} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline decoration-emerald-500/30 decoration-dashed underline-offset-4">R {Math.round(economics.topGP.paidRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Unpaid</p>
                         <p className="text-sm text-amber-400">R {Math.round(economics.topGP.invoicedRev - economics.topGP.paidRev).toLocaleString()}</p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Margin Profile */}
                <div className="bg-gradient-to-br from-purple-500/10 to-[#020617] border border-purple-500/20 rounded-[32px] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <Percent className="absolute -right-4 -bottom-4 text-purple-500/10" size={120} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-2"><Activity size={14}/> Best Margin Profile</p>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tighter italic uppercase text-white leading-tight relative z-10 break-words whitespace-normal">{economics.bestMargin.name}</h3>
                  </div>
                  <div className="mt-6 relative z-10">
                    <p className="text-4xl font-black text-purple-400 tracking-tighter">{economics.bestMargin.margin.toFixed(1)}% <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Margin</span></p>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-purple-500/20 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Units Sold</p>
                         <button onClick={() => setDrilldown({ metric: 'Units Sold', item: economics.bestMargin.name, invoices: economics.bestMargin.paidInvoices })} className="text-sm text-blue-400 hover:text-purple-300 transition-colors underline decoration-blue-500/30 decoration-dashed underline-offset-4">{economics.bestMargin.qty}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Gross Profit</p>
                         <p className="text-sm text-emerald-400">R {Math.round(economics.bestMargin.gp).toLocaleString()}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Avg GP / Unit</p>
                         <p className="text-sm text-emerald-400">R {economics.bestMargin.qty > 0 ? Math.round(economics.bestMargin.gp / economics.bestMargin.qty).toLocaleString() : 0}</p>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Total Cost</p>
                         <p className="text-sm text-rose-400">R {Math.round(economics.bestMargin.totalCost).toLocaleString()}</p>
                       </div>
                    </div>
                    {/* COLLECTIONS ROW */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-purple-500/10 text-xs font-bold text-slate-400">
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Invoiced</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Invoiced', item: economics.bestMargin.name, invoices: economics.bestMargin.allInvoices })} className="text-sm text-slate-300 hover:text-purple-300 transition-colors underline decoration-white/30 decoration-dashed underline-offset-4">R {Math.round(economics.bestMargin.invoicedRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Paid</p>
                         <button onClick={() => setDrilldown({ metric: 'Total Paid', item: economics.bestMargin.name, invoices: economics.bestMargin.paidInvoices })} className="text-sm text-emerald-400 hover:text-purple-300 transition-colors underline decoration-emerald-500/30 decoration-dashed underline-offset-4">R {Math.round(economics.bestMargin.paidRev).toLocaleString()}</button>
                       </div>
                       <div>
                         <p className="text-[9px] uppercase tracking-widest text-slate-500">Unpaid</p>
                         <p className="text-sm text-amber-400">R {Math.round(economics.bestMargin.invoicedRev - economics.bestMargin.paidRev).toLocaleString()}</p>
                       </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ANOMALY RADAR (Unmapped Items) */}
            {economics.unmapped.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-[40px] p-8 md:p-10 shadow-[0_0_50px_rgba(244,63,94,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/20 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-3 mb-8 relative z-10">
                  <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30 animate-pulse"><AlertOctagon size={24}/></div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">Mapping Anomalies Detected</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mt-1">{economics.unmapped.length} Unlinked Historical Records Found</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 relative z-10">
                  {economics.unmapped.map((u, i) => (
                    <div key={i} className="bg-[#020617] border border-rose-500/20 p-5 rounded-3xl flex flex-col shadow-xl">
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-white text-lg leading-tight break-words whitespace-normal">{u.desc}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                            {u.count} Unmapped Units &nbsp;&bull;&nbsp; R {Math.round(u.rev).toLocaleString()} Affected
                          </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                          
                          {/* INSPECT SOURCES ACCORDION BUTTON */}
                          <button 
                            onClick={() => setExpandedAnomaly(expandedAnomaly === u.desc ? null : u.desc)}
                            className="w-full sm:w-auto px-5 py-3 bg-[#0f172a] hover:bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <FileText size={14} className="text-slate-400"/> Inspect Sources {expandedAnomaly === u.desc ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </button>

                          {/* MAP ALIAS BUTTON */}
                          {isMapping === u.desc ? (
                             <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 w-full sm:w-auto">
                                <select 
                                  onChange={(e) => handleMapAnomaly(e.target.value)}
                                  className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer px-3 appearance-none"
                                >
                                   <option value="" disabled selected>Link to Catalog Item...</option>
                                   {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                                <button onClick={() => setIsMapping(null)} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl"><X size={14}/></button>
                             </div>
                          ) : (
                            <button 
                              onClick={() => setIsMapping(u.desc)}
                              className="w-full sm:w-auto px-6 py-3 bg-rose-500/20 hover:bg-rose-500 border border-rose-500/30 hover:border-rose-500 text-rose-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <ArrowRightLeft size={14}/> Auto-Map Alias
                            </button>
                          )}
                        </div>
                      </div>

                      {/* INVOICE SOURCE LIST (DROPDOWN) */}
                      <AnimatePresence>
                        {expandedAnomaly === u.desc && (
                           <motion.div 
                             initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                             className="mt-4 pt-4 border-t border-rose-500/20"
                           >
                             <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3">Source Documents ({u.invoices.length})</p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                               {u.invoices.map((inv: any) => (
                                 <div 
                                   key={inv.id} 
                                   onClick={() => handleViewDocument(inv)}
                                   className="flex items-center justify-between p-3 bg-[#0f172a] hover:bg-white/10 border border-white/5 rounded-xl cursor-pointer transition-colors group"
                                 >
                                    <div>
                                      <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">INV-{inv.invoice_number}</p>
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[120px]">{inv.profiles?.display_name || 'Unknown Client'}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${inv.status === 'paid' || inv.status === 'settled' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                      {inv.status}
                                    </span>
                                 </div>
                               ))}
                             </div>
                             <p className="text-[10px] text-slate-500 italic mt-3">Click an invoice to open the Document Editor and manually split or correct the items.</p>
                           </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CATALOG GRID */}
            <div className="pt-8 border-t border-white/5">
              <h2 className="text-xl font-black uppercase italic tracking-widest mb-6">Official Catalog</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(item => {
                  const profit = item.price - (item.cost || 0);
                  const margin = calculateMargin(item.price, item.cost || 0);

                  return (
                    <div key={item.id} className="bg-white/5 border border-white/10 p-8 rounded-[32px] hover:border-emerald-500/50 transition-all group relative overflow-hidden flex flex-col justify-between shadow-lg">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Tag size={120} className="text-emerald-500" />
                      </div>

                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Tag className="text-emerald-500" size={20}/>
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              {item.category}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-emerald-400"
                              title="Edit Item"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 transition-all text-slate-400 hover:text-rose-400"
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatSKU(item.id)}</p>
                          <h3 className="text-xl font-black italic uppercase leading-tight mt-1 pr-4 break-words whitespace-normal">{item.name}</h3>
                          {item.aliases && item.aliases.length > 0 && (
                            <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 tracking-widest flex items-center gap-1"><LinkIcon size={10}/> Linked to {item.aliases.length} historical aliases</p>
                          )}
                        </div>
                        
                        {item.internal_notes && (
                          <div className="flex items-start gap-2 bg-[#020617]/40 p-3 rounded-xl border border-white/5">
                            <AlignLeft size={12} className="text-slate-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-400 italic line-clamp-3">{item.internal_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="relative z-10 mt-8 space-y-3 bg-[#020617]/80 p-5 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit Price</p>
                          <p className="text-lg font-black text-emerald-400 leading-none">
                            R {Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="border-b border-white/10 pb-3">
                          <div className="flex justify-between items-end mb-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Unit Cost</p>
                            <p className="text-sm font-black text-rose-400 leading-none">
                              R {Number(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-end pt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit</p>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${margin >= 50 ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {margin}% Mgn
                            </span>
                          </div>
                          <p className="text-sm font-black text-blue-400 flex items-center gap-1 leading-none">
                            <TrendingUp size={12} /> R {profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          DRILLDOWN MODAL
          ========================================== */}
      <AnimatePresence>
        {drilldown && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrilldown(null)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="relative bg-[#0f172a] border border-white/10 rounded-[40px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-400"><Search size={24} /></div>
                  <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{drilldown.metric} Detail</h2>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mt-2">Filter: {drilldown.item}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setDrilldown(null)} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"><X size={20} /></button>
              </div>

              <div className="p-8 overflow-y-auto no-scrollbar">
                {drilldown.invoices.length > 0 ? (
                  <div className="bg-[#020617] rounded-3xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">Guardian</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Invoice #</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4 text-right">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {drilldown.invoices.map((inv: any, idx: number) => {
                          const invDate = new Date(inv.created_at).toLocaleDateString('en-ZA');
                          const dueDate = inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-ZA') : new Date(new Date(inv.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA');
                          
                          return (
                            <tr key={idx} onClick={() => { setDrilldown(null); handleViewDocument(inv); }} className="hover:bg-white/5 cursor-pointer transition-colors group">
                              <td className="px-6 py-4 font-bold text-sm group-hover:text-blue-400 transition-colors">{inv.profiles?.display_name || 'Unknown'}</td>
                              <td className="px-6 py-4 text-xs text-slate-400">{invDate}</td>
                              <td className="px-6 py-4 text-xs font-bold">INV-{inv.invoice_number}</td>
                              <td className="px-6 py-4 text-sm font-black text-emerald-400">R {Number(inv.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td className="px-6 py-4 text-xs text-slate-400 text-right">{dueDate}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-slate-500 italic p-8">No invoices found matching this specific metric.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          DOCUMENT VIEWER & INLINE EDITOR (Slide-over)
          ========================================== */}
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
                                  {items.map(b => (
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CREATE / EDIT ITEM MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-[#0f172a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl shadow-emerald-900/20 flex flex-col max-h-[95vh]"
            >
              <div className="flex items-center justify-between p-8 border-b border-white/5 bg-black/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    {editingId ? <Pencil size={18} className="text-emerald-400" /> : <Tag size={18} className="text-emerald-400" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">
                      {editingId ? 'Edit Catalog Item' : 'New Catalog Item'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Economics Definition</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto no-scrollbar flex-1 bg-[#0f172a]">
                <form id="itemForm" onSubmit={handleSaveItem} className="p-8 space-y-8">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Item Name / Description</label>
                        <input 
                          required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-white font-bold outline-none focus:border-emerald-500" 
                          placeholder="e.g. RAD Academy Polokwane Bootcamp" 
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                          <span className="text-[8px] font-bold text-emerald-500/70 uppercase tracking-widest">Auto-Saves New</span>
                        </div>
                        <input 
                          list="item-categories" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} 
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-white font-bold outline-none focus:border-emerald-500 placeholder:text-slate-600" 
                          placeholder="Select or Type New..."
                        />
                        <datalist id="item-categories">
                           {dynamicCategories.map(cat => <option key={cat} value={cat} />)}
                        </datalist>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-2">Client Unit Price (ZAR)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black">R</span>
                          <input 
                            required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} 
                            className="w-full bg-[#020617] border border-emerald-500/30 rounded-xl pl-10 pr-4 py-4 text-emerald-400 font-black text-lg outline-none focus:border-emerald-500" 
                            placeholder="0.00" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Internal Notes (Optional)</label>
                        <textarea 
                          value={formData.internal_notes} onChange={e => setFormData({...formData, internal_notes: e.target.value})} 
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-4 text-slate-300 text-sm outline-none focus:border-emerald-500 resize-none h-[64px]" 
                          placeholder="Only visible to admins..." 
                        />
                      </div>
                    </div>
                  </div>

                  {/* COST BREAKDOWN ENGINE WITH PROCUREMENT */}
                  <div className="bg-white/[0.02] border border-rose-500/20 rounded-3xl p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-rose-400">
                        <Receipt size={18} />
                        <h4 className="text-sm font-black uppercase tracking-widest">Internal Cost Breakdown</h4>
                      </div>
                      <div className="bg-[#020617] px-4 py-2 rounded-lg border border-rose-500/20">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Total Cost:</span>
                        <span className="text-rose-400 font-black">R {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <datalist id="historical-costs">
                        {historicalCosts.map((hc, idx) => <option key={idx} value={hc.name} />)}
                      </datalist>

                      {formData.cost_breakdown.map((costItem, idx) => (
                        <div key={costItem.id} className="bg-[#020617]/50 p-4 rounded-2xl border border-white/5 space-y-3 group">
                          
                          <div className="flex gap-3 items-start">
                            <div className="flex-1">
                              <input 
                                list="historical-costs"
                                value={costItem.name} 
                                onChange={e => handleCostLineChange(costItem.id, 'name', e.target.value)}
                                className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-rose-500 placeholder:text-slate-600"
                                placeholder="Cost Name (e.g. Teacher Commission, Raspberry Pi)"
                              />
                            </div>
                            <div className="w-36 relative shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500 font-black text-sm">R</span>
                              <input 
                                type="number" step="0.01" min="0"
                                value={costItem.amount === 0 ? '' : costItem.amount} 
                                onChange={e => handleCostLineChange(costItem.id, 'amount', e.target.value)}
                                className="w-full bg-[#020617] border border-white/10 rounded-xl pl-8 pr-3 py-3 text-sm text-rose-400 font-bold outline-none focus:border-rose-500"
                                placeholder="0.00"
                              />
                            </div>
                            <button 
                              type="button" onClick={() => handleRemoveCostLine(costItem.id)}
                              className="p-3 mt-0.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="flex gap-3 items-center">
                            <div className="w-1/3 relative flex items-center gap-2">
                              <div className="relative flex-1">
                                <Store size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <select 
                                  value={costItem.supplier_id || ""}
                                  onChange={e => handleCostLineChange(costItem.id, 'supplier_id', e.target.value)}
                                  className="w-full bg-[#020617] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-400 outline-none focus:border-rose-500 appearance-none"
                                >
                                  <option value="">No Supplier Linked</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                              <button 
                                type="button" onClick={() => setSupplierModalTarget(costItem.id)}
                                className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl transition-colors border border-rose-500/20 shrink-0"
                                title="Define New Supplier"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="flex-1 relative">
                              <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                              <input 
                                type="url"
                                value={costItem.url || ""} 
                                onChange={e => handleCostLineChange(costItem.id, 'url', e.target.value)}
                                className="w-full bg-[#020617] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-blue-400 outline-none focus:border-rose-500 placeholder:text-slate-600"
                                placeholder="Direct link to purchase item (Optional)"
                              />
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      onClick={handleAddCostLine}
                      className="w-full py-4 border border-dashed border-rose-500/30 text-rose-400 hover:bg-rose-500/5 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <ListPlus size={16} /> Add Cost Line Item
                    </button>
                  </div>

                </form>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/40 shrink-0">
                <button 
                  type="submit" form="itemForm" disabled={isSaving} 
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> {editingId ? 'Update Catalog' : 'Save to Catalog'}</>}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- NESTED: QUICK ADD SUPPLIER MODAL --- */}
      <AnimatePresence>
        {supplierModalTarget && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#0f172a] border border-rose-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-rose-900/20"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/40">
                <div className="flex items-center gap-3 text-rose-400">
                  <Store size={18} />
                  <h3 className="text-sm font-black uppercase tracking-widest">Define New Supplier</h3>
                </div>
                <button onClick={() => setSupplierModalTarget(null)} className="text-slate-500 hover:text-white"><X size={18}/></button>
              </div>

              <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Supplier Name</label>
                  <input required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500" placeholder="e.g. Evetech" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Website URL (Optional)</label>
                  <input type="url" value={newSupplier.website} onChange={e => setNewSupplier({...newSupplier, website: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-blue-400 text-sm outline-none focus:border-rose-500" placeholder="https://" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Location</label>
                    <input value={newSupplier.location} onChange={e => setNewSupplier({...newSupplier, location: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-rose-500" placeholder="e.g. Centurion" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-1"><Truck size={10}/> Logistics</label>
                    <select value={newSupplier.delivery_type} onChange={e => setNewSupplier({...newSupplier, delivery_type: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-rose-500 appearance-none">
                      <option>Delivery</option>
                      <option>Collection</option>
                      <option>Both</option>
                      <option>Not Applicable</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6">
                  <button type="submit" disabled={isSavingSupplier} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {isSavingSupplier ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16}/> Lock Supplier & Return</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}