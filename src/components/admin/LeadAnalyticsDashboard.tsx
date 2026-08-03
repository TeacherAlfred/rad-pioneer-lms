'use client';

import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell
} from 'recharts';
import { Filter, Clock, MessageSquare, Layers } from 'lucide-react';

interface AnalyticsData {
  funnelDistribution: { stage: string; count: number }[];
  effortData: { stage: string; avgContacts: number | string; avgDaysInStage: number }[];
  sourceData: { source: string; total: number; [key: string]: any }[];
  totalLeads: number;
  totalInteractions: number;
}

interface Props {
  data: AnalyticsData;
}

// Brand colors mapped to stages for the stacked bar chart
const STAGE_COLORS: Record<string, string> = {
  'Sourced': '#94a3b8',        // slate-400
  'Contacted': '#60a5fa',      // blue-400
  'Engaged': '#c084fc',        // purple-400
  'Active Trial': '#f472b6',   // pink-400
  'Pitch': '#fb923c',          // amber-400
  'Won': '#34d399',            // emerald-400
  'Lost': '#f87171',           // rose-400
};

type MetricTab = 'funnel' | 'effort' | 'velocity' | 'source';

export default function LeadAnalyticsDashboard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<MetricTab>('funnel');

  // Format avgContacts to ensure they are numbers for Recharts
  const formattedEffortData = data.effortData.map(d => ({
    ...d,
    avgContacts: typeof d.avgContacts === 'string' ? parseFloat(d.avgContacts) : d.avgContacts
  }));

  // Custom Tooltip for cleaner UI
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl">
          <p className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (activeTab) {
      case 'funnel':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.funnelDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Total Leads" radius={[6, 6, 0, 0]}>
                {data.funnelDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage] || '#d946ef'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'effort':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedEffortData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgContacts" name="Avg Interactions" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'velocity':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedEffortData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgDaysInStage" name="Avg Days in Stage" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'source':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.sourceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '20px' }} />
              {Object.keys(STAGE_COLORS).map(stage => (
                <Bar key={stage} dataKey={stage} stackId="a" fill={STAGE_COLORS[stage]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8">
      
      {/* Interactive Tabs */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-6">
        <button 
          onClick={() => setActiveTab('funnel')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'funnel' ? 'bg-fuchsia-100 text-fuchsia-700 border-2 border-fuchsia-200' : 'bg-slate-50 text-slate-500 border-2 border-slate-100 hover:border-slate-200'
          }`}
        >
          <Filter size={14} /> Funnel Flow
        </button>
        
        <button 
          onClick={() => setActiveTab('effort')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'effort' ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' : 'bg-slate-50 text-slate-500 border-2 border-slate-100 hover:border-slate-200'
          }`}
        >
          <MessageSquare size={14} /> Interaction Effort
        </button>
        
        <button 
          onClick={() => setActiveTab('velocity')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'velocity' ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' : 'bg-slate-50 text-slate-500 border-2 border-slate-100 hover:border-slate-200'
          }`}
        >
          <Clock size={14} /> Stage Velocity
        </button>

        <button 
          onClick={() => setActiveTab('source')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'source' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' : 'bg-slate-50 text-slate-500 border-2 border-slate-100 hover:border-slate-200'
          }`}
        >
          <Layers size={14} /> Sourcing Breakdown
        </button>
      </div>

      {/* Dynamic Title Context */}
      <div>
        <h3 className="text-xl font-black uppercase italic text-slate-800">
          {activeTab === 'funnel' && 'Current Pipeline Distribution'}
          {activeTab === 'effort' && 'Average Touchpoints Required Per Stage'}
          {activeTab === 'velocity' && 'Average Days Spent in Stage'}
          {activeTab === 'source' && 'Lead Quality by Acquisition Channel'}
        </h3>
        <p className="text-sm font-medium text-slate-500 mt-1">
          {activeTab === 'funnel' && 'Visualizes where all active and historical leads are currently sitting in your pipeline.'}
          {activeTab === 'effort' && 'Highlights the amount of manual interaction (calls, emails, WhatsApps) logged against a lead while they occupied a specific stage.'}
          {activeTab === 'velocity' && 'Calculates the timeframe between a lead entering a stage and their most recent interaction.'}
          {activeTab === 'source' && 'Cross-references the marketing source against current pipeline stages to identify the highest quality channels.'}
        </p>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[500px] mt-8">
        {renderChart()}
      </div>

    </div>
  );
}