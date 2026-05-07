"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Users, Wallet, TrendingUp, AlertCircle, Edit, CheckCircle2, 
  X, Loader2, Save, Phone, Mail, Link as LinkIcon, FileText, Eye, UserCog, 
  ArrowUpDown, ArrowUp, ArrowDown, EyeOff, Filter, SlidersHorizontal
} from "lucide-react";
import { useRouter } from "next/navigation";

const LATEST_TC_VERSION = "v2.1"; 

const STATUS_OPTIONS = ["active", "inactive", "pending", "locked"];
const FUNNEL_STAGES = ["Lead (New)", "Trial Active", "Active (Paid Client)", "Churned", "Paused"];
const ACCOUNT_TIERS = ["none", "bootcamp", "lms_trial", "lms_access", "full"]; // DB strict format

// Helper to make DB strings pretty (e.g. "lms_trial" -> "LMS Trial")
const formatLabel = (str: string) => {
  if (!str) return "None";
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

export default function AdminParentHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  // View Toggles
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Advanced Filters
  const [filters, setFilters] = useState({
    status: "active",
    funnelStage: "",
    accountTier: "",
    financialHealth: "all", // 'all', 'outstanding', 'clean'
    paymentHabit: "all", // 'all', 'early', 'late'
  });

  // Modal States
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [isFullEditModalOpen, setIsFullEditModalOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<any>(null);
  const [metaForm, setMetaForm] = useState<string>("");
  const [fullEditForm, setFullEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchGuardians();
  }, []);

  async function fetchGuardians() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parent_financial_dashboard_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enrichedData = data.map((g: any) => ({
        ...g,
        metadataObj: typeof g.metadata === 'string' ? JSON.parse(g.metadata) : (g.metadata || {}),
        finances: {
          outstanding: Number(g.outstanding), 
          monthsActive: Number(g.months_active),
          totalRevenue: Number(g.total_revenue),
          totalProfit: Number(g.total_profit),
          avgDaysToPay: Number(g.avg_days_to_pay), 
        },
        family: {
          childrenCount: Number(g.children_count),
          hasLinkedParent: g.has_linked_parent,
        }
      }));

      setGuardians(enrichedData);
    } catch (err) {
      console.error("Error fetching guardians:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />;
  };

  // --- The Master Filter & Sort Engine ---
  const processedGuardians = useMemo(() => {
    let result = guardians.filter(g => {
      // 1. Test Account Check
      if (!showTestAccounts && g.metadataObj?.is_test_account === true) return false;

      // 2. Search Query
      const matchesSearch = g.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            g.metadataObj?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Dropdown Filters
      if (filters.status && g.status !== filters.status) return false;
      if (filters.funnelStage && g.funnel_stage !== filters.funnelStage) return false;
      if (filters.accountTier && (g.account_tier || 'none') !== filters.accountTier) return false;

      // 4. Financial Health Filter
      if (filters.financialHealth === 'outstanding' && g.finances.outstanding <= 0) return false;
      if (filters.financialHealth === 'clean' && g.finances.outstanding > 0) return false;

      // 5. Payment Habit Filter
      if (filters.paymentHabit === 'late' && g.finances.avgDaysToPay <= 0) return false;
      if (filters.paymentHabit === 'early' && g.finances.avgDaysToPay > 0) return false;

      return true;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key.includes('.')) {
          const [obj, prop] = sortConfig.key.split('.');
          aVal = a[obj]?.[prop];
          bVal = b[obj]?.[prop];
        } else {
          aVal = a[sortConfig.key];
          bVal = b[sortConfig.key];
        }
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [guardians, searchQuery, sortConfig, showTestAccounts, filters]);

  // --- Inline Update Handlers ---
  const handleInlineUpdate = async (id: string, field: string, value: any) => {
    try {
      if (field === 'status' && value !== 'active') {
        setGuardians(prev => prev.filter(g => g.id !== id));
      } else {
        setGuardians(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
      }
      const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      fetchGuardians(); 
    }
  };

  const toggleTestAccount = async (guardian: any) => {
    const isCurrentlyTest = guardian.metadataObj?.is_test_account === true;
    const newMetaObj = { ...guardian.metadataObj, is_test_account: !isCurrentlyTest };
    setGuardians(prev => prev.map(g => g.id === guardian.id ? { ...g, metadata: JSON.stringify(newMetaObj), metadataObj: newMetaObj } : g));
    try {
      const { error } = await supabase.from("profiles").update({ metadata: JSON.stringify(newMetaObj) }).eq("id", guardian.id);
      if (error) throw error;
    } catch (err) { fetchGuardians(); }
  };

  // --- Modal Forms ---
  const openMetaModal = (guardian: any) => {
    setSelectedGuardian(guardian);
    setMetaForm(JSON.stringify(guardian.metadataObj, null, 2));
    setIsMetaModalOpen(true);
  };

  const saveMetadata = async () => {
    setIsSaving(true);
    try {
      const parsedMeta = JSON.parse(metaForm);
      await supabase.from("profiles").update({ metadata: JSON.stringify(parsedMeta) }).eq("id", selectedGuardian.id);
      setGuardians(prev => prev.map(g => g.id === selectedGuardian.id ? { ...g, metadata: JSON.stringify(parsedMeta), metadataObj: parsedMeta } : g));
      setIsMetaModalOpen(false);
    } catch (err) { alert("Invalid JSON format or save failed."); } 
    finally { setIsSaving(false); }
  };

  const openFullEditModal = (guardian: any) => {
    setSelectedGuardian(guardian);
    setFullEditForm({
      display_name: guardian.display_name || "",
      email: guardian.metadataObj?.email || "",
      phone: guardian.metadataObj?.phone || "",
      status: guardian.status || "",
      funnel_stage: guardian.funnel_stage || "",
      account_tier: guardian.account_tier || "none"
    });
    setIsFullEditModalOpen(true);
  };

  const saveFullProfile = async () => {
    setIsSaving(true);
    try {
      const updatedMeta = { ...selectedGuardian.metadataObj, email: fullEditForm.email, phone: fullEditForm.phone };
      const payload = {
        display_name: fullEditForm.display_name,
        status: fullEditForm.status,
        funnel_stage: fullEditForm.funnel_stage,
        account_tier: fullEditForm.account_tier,
        metadata: JSON.stringify(updatedMeta)
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", selectedGuardian.id);
      if (error) throw error;

      setGuardians(prev => prev.map(g => g.id === selectedGuardian.id ? { ...g, ...payload, metadataObj: updatedMeta } : g));
      setIsFullEditModalOpen(false);
    } catch (err) { alert("Failed to save full record."); } 
    finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      
      {/* Top Level KPI Cards */}
      <div className="max-w-[1600px] mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Users size={24} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Visible Guardians</p>
            <h3 className="text-2xl font-black text-slate-900">{processedGuardians.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Wallet size={24} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Visible Revenue</p>
            <h3 className="text-2xl font-black text-slate-900">
              R{processedGuardians.reduce((acc, g) => acc + (g.finances?.totalRevenue || 0), 0).toLocaleString()}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><AlertCircle size={24} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Visible Outstanding</p>
            <h3 className="text-2xl font-black text-slate-900">
              R{processedGuardians.reduce((acc, g) => acc + (g.finances?.outstanding || 0), 0).toLocaleString()}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><TrendingUp size={24} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Days to Pay</p>
            <h3 className="text-2xl font-black text-slate-900">
              {(processedGuardians.reduce((acc, g) => acc + (g.finances?.avgDaysToPay || 0), 0) / (processedGuardians.length || 1)).toFixed(1)} Days
            </h3>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col h-[75vh]">
        
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Parent Hub</h2>
              <p className="text-xs text-slate-500 font-medium">Manage all registered guardians, financials, and CRM states.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${showFilters ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
              >
                <SlidersHorizontal size={14} /> Filters
              </button>
              <button
                onClick={() => setShowTestAccounts(!showTestAccounts)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${showTestAccounts ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
              >
                {showTestAccounts ? <Eye size={14} /> : <EyeOff size={14} />} {showTestAccounts ? "Tests Visible" : "Tests Hidden"}
              </button>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" placeholder="Search by name or email..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 px-6 flex flex-wrap gap-4 shrink-0 shadow-inner">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">CRM Status</label>
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer text-slate-700">
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Funnel Stage</label>
              <select value={filters.funnelStage} onChange={e => setFilters({...filters, funnelStage: e.target.value})} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer text-slate-700">
                <option value="">All Stages</option>
                {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Account Tier</label>
              <select value={filters.accountTier} onChange={e => setFilters({...filters, accountTier: e.target.value})} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer text-slate-700">
                <option value="">All Tiers</option>
                {ACCOUNT_TIERS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Financial Health</label>
              <select value={filters.financialHealth} onChange={e => setFilters({...filters, financialHealth: e.target.value})} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer text-slate-700">
                <option value="all">All Accounts</option>
                <option value="outstanding">Has Outstanding Balance</option>
                <option value="clean">Zero Balance / Clean</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payment Habits</label>
              <select value={filters.paymentHabit} onChange={e => setFilters({...filters, paymentHabit: e.target.value})} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer text-slate-700">
                <option value="all">All Accounts</option>
                <option value="early">Pays Early (Good)</option>
                <option value="late">Pays Late (Warning)</option>
              </select>
            </div>
            <div className="ml-auto self-end">
              <button onClick={() => setFilters({status: "", funnelStage: "", accountTier: "", financialHealth: "all", paymentHabit: "all"})} className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors px-3 py-1.5">
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 overflow-auto no-scrollbar relative">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : processedGuardians.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Filter size={40} className="opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest">No parents match filters.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100/80 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-200/50 transition-colors group" onClick={() => handleSort('display_name')}>
                    <div className="flex items-center gap-2">Guardian <SortIcon columnKey="display_name" /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-200/50 transition-colors group" onClick={() => handleSort('family.childrenCount')}>
                    <div className="flex items-center gap-2">Linked Family <SortIcon columnKey="family.childrenCount" /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-200/50 transition-colors group" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">CRM States <SortIcon columnKey="status" /></div>
                  </th>
                  <th className="px-6 py-4">T&C / Welcome</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-200/50 transition-colors group" onClick={() => handleSort('finances.outstanding')}>
                    <div className="flex items-center gap-2">Financial Health <SortIcon columnKey="finances.outstanding" /></div>
                  </th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedGuardians.map(g => {
                  const isTestAccount = g.metadataObj?.is_test_account === true;
                  return (
                  <tr key={g.id} className={`transition-colors group ${isTestAccount ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}`}>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">{g.display_name || "Unknown"}</span>
                          {isTestAccount && <span className="bg-amber-400 text-amber-950 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-sm">Test</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Mail size={12}/> {g.metadataObj.email || "No Email"}</span>
                          <span className="flex items-center gap-1"><Phone size={12}/> {g.metadataObj.phone || "No Phone"}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                          Updated: {new Date(g.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit">
                          <Users size={12} /> {g.family.childrenCount} Linked Child(ren)
                        </span>
                        {g.family.hasLinkedParent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit">
                            <LinkIcon size={12} /> Linked to Co-Guardian
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 w-40">
                        <select 
                          value={g.status || ""} onChange={(e) => handleInlineUpdate(g.id, 'status', e.target.value)}
                          className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border outline-none cursor-pointer ${g.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                        </select>
                        <select 
                          value={g.funnel_stage || ""} onChange={(e) => handleInlineUpdate(g.id, 'funnel_stage', e.target.value)}
                          className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg outline-none cursor-pointer w-full truncate"
                        >
                          <option value="">No Stage</option>
                          {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select 
                          value={g.account_tier || "none"} onChange={(e) => handleInlineUpdate(g.id, 'account_tier', e.target.value)}
                          className="text-[10px] font-black uppercase tracking-widest bg-blue-50 border border-blue-100 text-blue-700 px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                        >
                          {ACCOUNT_TIERS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                        </select>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">T&C: {g.tc_accepted_version || "None"}</span>
                          {g.tc_accepted_version === LATEST_TC_VERSION && (
                            <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Latest</span>
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer group/toggle">
                          <input 
                            type="checkbox" checked={g.show_welcome_guide || false} 
                            onChange={(e) => handleInlineUpdate(g.id, 'show_welcome_guide', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-600 group-hover/toggle:text-slate-900 transition-colors">Show Welcome Guide</span>
                        </label>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className={`border p-3 rounded-xl flex flex-col gap-1.5 w-48 ${isTestAccount ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Outstanding:</span>
                          <span className={`font-black ${g.finances.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>R{g.finances.outstanding}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Rev / Profit:</span>
                          <span className="font-bold text-slate-900">R{g.finances.totalRevenue} / <span className="text-emerald-600">R{g.finances.totalProfit}</span></span>
                        </div>
                        <div className={`flex justify-between items-center text-xs border-t pt-1.5 mt-0.5 ${isTestAccount ? 'border-amber-200' : 'border-slate-200'}`}>
                          <span className="text-slate-500 font-medium">Avg Time to Pay:</span>
                          <span className={`font-bold text-[10px] ${g.finances.avgDaysToPay > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {g.finances.avgDaysToPay > 0 ? `${g.finances.avgDaysToPay} Days Late` : `${Math.abs(g.finances.avgDaysToPay)} Days Early`}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <button 
                          onClick={() => router.push(`/admin/parents/${g.id}`)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-pink-50 text-pink-600 hover:bg-pink-500 hover:text-white border border-pink-200 hover:border-pink-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          <Eye size={14} /> Impersonate
                        </button>
                        <div className="grid grid-cols-3 gap-1">
                          <button 
                            onClick={() => openFullEditModal(g)}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                            title="Edit Core Record"
                          >
                            <UserCog size={14} />
                          </button>
                          <button 
                            onClick={() => openMetaModal(g)}
                            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
                            title="Edit JSON Metadata"
                          >
                            <FileText size={14} />
                          </button>
                          <button 
                            onClick={() => toggleTestAccount(g)}
                            className={`flex items-center justify-center gap-1.5 px-2 py-2 border rounded-xl transition-all shadow-sm ${isTestAccount ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                            title={isTestAccount ? "Unhide Account" : "Hide (Mark as Test)"}
                          >
                            {isTestAccount ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                      </div>
                    </td>

                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Editor Modals remain unchanged below this line */}
      {isMetaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Advanced Meta Editor</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Direct JSON Access</p>
              </div>
              <button onClick={() => setIsMetaModalOpen(false)} className="p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-slate-900"><X size={16} /></button>
            </div>
            
            <div className="p-6 bg-white">
              <textarea 
                value={metaForm} 
                onChange={(e) => setMetaForm(e.target.value)}
                className="w-full h-64 bg-slate-900 text-emerald-400 font-mono text-sm p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                spellCheck="false"
              />
            </div>
            
            <div className="p-6 pt-0 bg-white">
              <button onClick={saveMetadata} disabled={isSaving} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Payload
              </button>
            </div>
          </div>
        </div>
      )}

      {isFullEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Edit Guardian Record</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">ID: {selectedGuardian?.id}</p>
              </div>
              <button onClick={() => setIsFullEditModalOpen(false)} className="p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-slate-900"><X size={16} /></button>
            </div>
            
            <div className="p-6 md:p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                <input type="text" value={fullEditForm.display_name} onChange={e => setFullEditForm({...fullEditForm, display_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                <input type="email" value={fullEditForm.email} onChange={e => setFullEditForm({...fullEditForm, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Phone Number</label>
                <input type="tel" value={fullEditForm.phone} onChange={e => setFullEditForm({...fullEditForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none" />
              </div>
              
              <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Account Statuses</h4>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Account Tier</label>
                <select value={fullEditForm.account_tier} onChange={e => setFullEditForm({...fullEditForm, account_tier: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none appearance-none">
                  {ACCOUNT_TIERS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">CRM Status</label>
                <select value={fullEditForm.status} onChange={e => setFullEditForm({...fullEditForm, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none appearance-none">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Funnel Stage</label>
                <select value={fullEditForm.funnel_stage} onChange={e => setFullEditForm({...fullEditForm, funnel_stage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none appearance-none">
                  <option value="">-- No Stage Selected --</option>
                  {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            
            <div className="p-6 md:p-8 pt-0 bg-white">
              <button onClick={saveFullProfile} disabled={isSaving} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Update Guardian Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}