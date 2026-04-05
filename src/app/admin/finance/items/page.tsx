"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Tag, DollarSign, Archive, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ItemsPortal() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock items based on your Quotation history
  const initialItems = [
    { id: 'btcmp-plk', name: 'RAD Academy Polokwane Bootcamp', price: 1250.00, category: 'Bootcamp' },
    { id: 'tution-t2', name: 'Term 2 Tuition Fees', price: 3275.00, category: 'Tuition' }
  ];

  useEffect(() => {
    // We'll eventually fetch from a 'billing_items' table
    setItems(initialItems);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex justify-between items-end border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/finance" className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2">
              <ArrowLeft size={14}/> Back to Finance
            </Link>
            <h1 className="text-5xl font-black tracking-tighter italic uppercase">Items_<span className="text-emerald-500">Catalog</span></h1>
          </div>
          <button className="bg-emerald-600 px-6 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2">
            <Plus size={16}/> Define New Item
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white/5 border border-white/10 p-6 rounded-[32px] hover:border-emerald-500/50 transition-all group">
              <Tag className="text-emerald-500 mb-4" size={24}/>
              <p className="text-[10px] font-black text-slate-500 uppercase">{item.id}</p>
              <h3 className="text-xl font-black italic uppercase leading-none mt-1">{item.name}</h3>
              <p className="text-2xl font-black text-emerald-400 mt-4">R {item.price.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}