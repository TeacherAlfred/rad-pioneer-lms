"use client";

import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Bar } from 'recharts';
import { Calendar } from 'lucide-react';

interface YearlyFinancialChartProps {
  data: any[];
}

export default function YearlyFinancialChart({ data }: YearlyFinancialChartProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mt-8">
      <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <Calendar size={16} className="text-blue-600"/> Annual Revenue & Collections
        </h3>
      </div>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              tickFormatter={(value: number) => `R${value >= 1000 ? (value / 1000) + 'k' : value}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', paddingTop: '20px' }} />

            {/* BILLED STACK (Blue Scale) */}
            <Bar yAxisId="left" dataKey="billed_term" stackId="billed" name="Billed: Term Lessons" fill="#1e3a8a" maxBarSize={40} />
            <Bar yAxisId="left" dataKey="billed_bootcamp" stackId="billed" name="Billed: Bootcamps" fill="#3b82f6" maxBarSize={40} />
            <Bar yAxisId="left" dataKey="billed_hardware" stackId="billed" name="Billed: Kits & Hardware" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />

            {/* PAID STACK (Emerald Scale) */}
            <Bar yAxisId="left" dataKey="paid_term" stackId="paid" name="Paid: Term Lessons" fill="#064e3b" maxBarSize={40} />
            <Bar yAxisId="left" dataKey="paid_bootcamp" stackId="paid" name="Paid: Bootcamps" fill="#10b981" maxBarSize={40} />
            <Bar yAxisId="left" dataKey="paid_hardware" stackId="paid" name="Paid: Kits & Hardware" fill="#6ee7b7" radius={[4, 4, 0, 0]} maxBarSize={40} />

            <Line yAxisId="left" type="monotone" dataKey="uncollected" name="Total Uncollected" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-2xl min-w-[220px] text-xs z-50">
        <p className="font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-700 pb-2">{label} Breakdown</p>
        
        <div className="space-y-4">
           {/* Billed Breakdown */}
           <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Invoiced (Billed)</p>
              {payload.filter((p:any) => p.dataKey.includes('billed')).map((entry: any, index: number) => (
                entry.value > 0 && <div key={index} className="flex justify-between items-center gap-6 mb-1">
                  <span className="text-[10px] font-bold" style={{ color: entry.color }}>{entry.name.replace('Billed: ', '')}</span>
                  <span className="text-white font-bold">R {Math.round(entry.value).toLocaleString()}</span>
                </div>
              ))}
           </div>

           {/* Paid Breakdown */}
           <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Collected On-Time</p>
              {payload.filter((p:any) => p.dataKey.includes('paid')).map((entry: any, index: number) => (
                entry.value > 0 && <div key={index} className="flex justify-between items-center gap-6 mb-1">
                  <span className="text-[10px] font-bold" style={{ color: entry.color }}>{entry.name.replace('Paid: ', '')}</span>
                  <span className="text-white font-bold">R {Math.round(entry.value).toLocaleString()}</span>
                </div>
              ))}
           </div>

           {/* Uncollected Total */}
           <div className="pt-3 border-t border-slate-700">
              {payload.filter((p:any) => p.dataKey === 'uncollected').map((entry: any, index: number) => (
                <div key={index} className="flex justify-between items-center gap-6">
                  <span className="text-[10px] font-black uppercase" style={{ color: entry.color }}>{entry.name}</span>
                  <span className="text-white font-black">R {Math.round(entry.value).toLocaleString()}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }
  return null;
};