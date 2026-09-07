"use client";

import { useEffect, useState } from "react";
import { Search, User, X } from "lucide-react";

export type PickerLead = {
  id: string;
  name: string | null;
  phone: string;
  email?: string | null;
  company_name?: string | null;
  customer_type?: string;
};

// Search-or-create a lead against /admin/api/finance-v2/leads - the
// existing search+create-or-find endpoint (ilike on name/phone/company_name,
// findOrCreateLeadByPhone on create), reused as-is rather than duplicated.
// Extracted from the identical inline pattern in the finance-v2 composer/
// balances/capture pages (2026-09-07) for the call queue's "add a lead"
// step; those three pages keep their own inline copies for now (not
// retrofitted in this pass).
export function LeadPicker({
  value,
  onChange,
  source,
}: {
  value: PickerLead | null;
  onChange: (lead: PickerLead | null) => void;
  source: string;
}) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<PickerLead[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (search.length > 2) {
      const t = setTimeout(async () => {
        const res = await fetch(`/admin/api/finance-v2/leads?q=${encodeURIComponent(search)}`);
        const { leads } = await res.json();
        setSuggestions(leads || []);
      }, 250);
      return () => clearTimeout(t);
    }
    setSuggestions([]);
  }, [search]);

  async function createLead() {
    const digits = newPhone.replace(/\D/g, "");
    if (!digits) return;
    setCreating(true);
    try {
      const res = await fetch("/admin/api/finance-v2/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, name: search || null, email: newEmail || null, source }),
      });
      const { lead } = await res.json();
      if (lead) {
        onChange(lead);
        setSearch("");
        setSuggestions([]);
        setNewPhone("");
        setNewEmail("");
      }
    } finally {
      setCreating(false);
    }
  }

  if (value) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl relative group">
        <button onClick={() => onChange(null)} className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={11} /></button>
        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><User size={10} /> Lead</p>
        <p className="text-sm font-black text-slate-900 mt-0.5">{value.company_name || value.name || "Unnamed"}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{value.email || "No email"} · {value.phone}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads by name or phone..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 text-xs outline-none focus:border-slate-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {suggestions.map(l => (
            <button
              key={l.id}
              onClick={() => { onChange(l); setSearch(""); setSuggestions([]); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 text-xs font-bold transition-colors"
            >
              {l.company_name || l.name || "Unnamed"} <span className="text-[10px] text-slate-400 ml-1.5">{l.phone}</span>
            </button>
          ))}
        </div>
      )}
      {search.length > 2 && suggestions.length === 0 && (
        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
          <p className="text-[10px] text-slate-500">No matching lead — create one:</p>
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone number" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-slate-400" />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (optional)" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-slate-400" />
          <button onClick={createLead} disabled={creating || !newPhone.trim()} className="w-full py-2 bg-slate-900 rounded-lg text-[10px] font-black uppercase text-white disabled:opacity-50">
            {creating ? "Creating..." : `Create Lead: ${search}`}
          </button>
        </div>
      )}
    </div>
  );
}
