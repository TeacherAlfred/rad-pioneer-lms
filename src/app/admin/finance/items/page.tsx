"use client";
"use no memo";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Tag, Archive, Loader2, ArrowLeft, X, Save, TrendingUp, Activity, Pencil, Trash2, AlignLeft, ListPlus, Receipt, Link as LinkIcon, Store, Truck } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function ItemsPortal() {
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- Main Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    internal_notes: "",
    category: "Tuition",
    cost_breakdown: [] as { id: string, name: string, amount: number, supplier_id: string, url: string }[]
  });

  // --- Quick-Add Supplier State ---
  const [supplierModalTarget, setSupplierModalTarget] = useState<string | null>(null); // Holds the ID of the cost line that triggered it
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "", website: "", location: "", delivery_type: "Delivery"
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [itemsRes, suppliersRes] = await Promise.all([
        supabase.from('billing_items').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name', { ascending: true })
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setItems(itemsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- DYNAMIC CATEGORY ENGINE ---
  // Automatically builds a list of every category you've ever used in the DB
  const dynamicCategories = useMemo(() => {
    const categorySet = new Set(["Bootcamp", "Tuition", "Hardware", "Event", "Other"]);
    items.forEach(item => {
      if (item.category && item.category.trim() !== "") {
        categorySet.add(item.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [items]);

  // --- SMART COST ENGINE ---
  const historicalCosts = useMemo(() => {
    const costsMap = new Map<string, number>();
    items.forEach(item => {
      if (item.cost_breakdown && Array.isArray(item.cost_breakdown)) {
        item.cost_breakdown.forEach((cb: any) => {
          if (!costsMap.has(cb.name) && cb.name.trim() !== "") {
            costsMap.set(cb.name, Number(cb.amount));
          }
        });
      }
    });
    return Array.from(costsMap.entries()).map(([name, amount]) => ({ name, amount }));
  }, [items]);

  const totalCost = formData.cost_breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAddCostLine = () => {
    setFormData(prev => ({
      ...prev,
      cost_breakdown: [...prev.cost_breakdown, { id: Math.random().toString(36).substring(7), name: "", amount: 0, supplier_id: "", url: "" }]
    }));
  };

  const handleRemoveCostLine = (id: string) => {
    setFormData(prev => ({
      ...prev,
      cost_breakdown: prev.cost_breakdown.filter(cb => cb.id !== id)
    }));
  };

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

  // --- QUICK ADD SUPPLIER LOGIC ---
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;
    
    setIsSavingSupplier(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{
          name: newSupplier.name,
          website: newSupplier.website,
          location: newSupplier.location,
          delivery_type: newSupplier.delivery_type
        }])
        .select()
        .single();

      if (error) throw error;

      // 1. Add the new supplier to the local list immediately
      setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      
      // 2. Auto-select this supplier in the cost line that triggered the modal!
      if (supplierModalTarget) {
        handleCostLineChange(supplierModalTarget, 'supplier_id', data.id);
      }

      // 3. Clean up
      setNewSupplier({ name: "", website: "", location: "", delivery_type: "Delivery" });
      setSupplierModalTarget(null);
    } catch (err: any) {
      alert("Failed to save supplier: " + err.message);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({ name: "", price: "", internal_notes: "", category: "Tuition", cost_breakdown: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      internal_notes: item.internal_notes || "",
      category: item.category,
      cost_breakdown: item.cost_breakdown || []
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
        name: formData.name,
        price: parseFloat(formData.price),
        cost: finalTotalCost, 
        cost_breakdown: cleanBreakdown,
        internal_notes: formData.internal_notes,
        category: formData.category,
        is_active: true
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
    } catch (err: any) {
      alert(`Failed to ${editingId ? 'update' : 'create'} item: ` + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatSKU = (id: string) => id ? `SKU-${id.substring(0, 8).toUpperCase()}` : "SKU-UNKNOWN";
  const calculateMargin = (price: number, cost: number) => {
    if (!price || price <= 0) return 0;
    return Math.round(((price - cost) / price) * 100);
  };

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

        {/* CATALOG GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="animate-spin text-emerald-500" size={40} />
             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Loading Catalog...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => {
              const profit = item.price - (item.cost || 0);
              const margin = calculateMargin(item.price, item.cost || 0);

              return (
                <div key={item.id} className="bg-white/5 border border-white/10 p-8 rounded-[32px] hover:border-emerald-500/50 transition-all group relative overflow-hidden flex flex-col justify-between">
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
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-emerald-400"
                        title="Edit Item"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatSKU(item.id)}</p>
                      <h3 className="text-xl font-black italic uppercase leading-tight mt-1 pr-4">{item.name}</h3>
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
                      
                      {item.cost_breakdown && item.cost_breakdown.length > 0 && (
                        <div className="space-y-2 mt-3 pl-2 border-l border-white/5">
                          {item.cost_breakdown.map((cb: any, idx: number) => {
                            const supplier = suppliers.find(s => s.id === cb.supplier_id);
                            return (
                              <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-start text-[10px] text-slate-400 font-bold">
                                  <span className="truncate pr-2 leading-tight">{cb.name}</span>
                                  <span className="text-rose-400 shrink-0">R {Number(cb.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                {(supplier || cb.url) && (
                                  <div className="flex items-center gap-2 text-[8px] text-slate-500 uppercase tracking-widest">
                                    {supplier && <span className="flex items-center gap-1"><Store size={8}/> {supplier.name}</span>}
                                    {cb.url && (
                                      <a href={cb.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                        <LinkIcon size={8}/> Link
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
        )}
      </div>

      {/* --- CREATE / EDIT ITEM MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-[#0f172a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl shadow-emerald-900/20 flex flex-col max-h-[95vh]"
            >
              {/* Modal Header */}
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
                  
                  {/* Core Details */}
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
                      
                      {/* DYNAMIC CATEGORY FIELD */}
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
                          
                          {/* Row 1: Name and Amount */}
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

                          {/* Row 2: Procurement (Supplier & URL) */}
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
                              {/* QUICK ADD SUPPLIER BUTTON */}
                              <button 
                                type="button"
                                onClick={() => setSupplierModalTarget(costItem.id)}
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