"use client";

import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Users } from 'lucide-react';
import { useMemo } from 'react';

interface MonthlyStudentChartProps {
  data: any[];
}

export default function MonthlyStudentChart({ data }: MonthlyStudentChartProps) {
  
  // Calculate total active for the trend line
  const chartData = useMemo(() => {
    return data.map(month => ({
      ...month,
      total_all: month.term_online + month.term_in_person + month.bootcamp_online + month.bootcamp_in_person + month.trial_online
    }));
  }, [data]);

  return (
    <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mt-8">
      <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <Users size={16} className="text-blue-600"/> Annual Enrollment Volume
        </h3>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" axisLine={false} tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10}
            />
            <YAxis 
              axisLine={false} tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomStudentTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', paddingTop: '20px' }} />

            {/* Term: Deep Indigo (In Person) vs Light Indigo (Online) */}
            <Bar dataKey="term_in_person" name="Term (In Person)" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={15} />
            <Bar dataKey="term_online" name="Term (Online)" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={15} />

            {/* Bootcamp: Deep Sky (In Person) vs Light Sky (Online) */}
            <Bar dataKey="bootcamp_in_person" name="Bootcamp (In Person)" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={15} />
            <Bar dataKey="bootcamp_online" name="Bootcamp (Online)" fill="#7dd3fc" radius={[4, 4, 0, 0]} maxBarSize={15} />

            {/* Trial: Emerald (Online Only) */}
            <Bar dataKey="trial_online" name="Trial (Online)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={15} />

            {/* Total Active Trend Line */}
            <Line 
              type="monotone" 
              dataKey="total_all" 
              name="Total Active" 
              stroke="#0f172a" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#0f172a', strokeWidth: 2, stroke: '#fff' }} 
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const CustomStudentTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-2xl min-w-[220px] text-xs z-50">
        <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
           <span className="font-black uppercase tracking-widest text-slate-400">{label} Volume</span>
           <span className="font-black text-white text-sm bg-slate-800 px-2 py-1 rounded-lg border border-slate-600 shadow-sm">{data.total_all} Active</span>
        </div>
        
        <div className="space-y-4">
            {/* Term Breakdown */}
            {(data.term_online > 0 || data.term_in_person > 0) && (
              <div>
                <div className="font-black uppercase tracking-widest text-[10px] mb-1.5 text-indigo-400">Term Lessons</div>
                {data.term_in_person > 0 && <div className="flex justify-between text-slate-300 ml-2 font-medium"><span className="text-[10px]">In Person</span><span>{data.term_in_person}</span></div>}
                {data.term_online > 0 && <div className="flex justify-between text-slate-300 ml-2 font-medium"><span className="text-[10px]">Online</span><span>{data.term_online}</span></div>}
              </div>
            )}

            {/* Bootcamp Breakdown */}
            {(data.bootcamp_online > 0 || data.bootcamp_in_person > 0) && (
              <div>
                <div className="font-black uppercase tracking-widest text-[10px] mb-1.5 text-sky-400">Bootcamps</div>
                {data.bootcamp_in_person > 0 && <div className="flex justify-between text-slate-300 ml-2 font-medium"><span className="text-[10px]">In Person</span><span>{data.bootcamp_in_person}</span></div>}
                {data.bootcamp_online > 0 && <div className="flex justify-between text-slate-300 ml-2 font-medium"><span className="text-[10px]">Online</span><span>{data.bootcamp_online}</span></div>}
              </div>
            )}

            {/* Trial Breakdown */}
            {data.trial_online > 0 && (
              <div>
                <div className="font-black uppercase tracking-widest text-[10px] mb-1.5 text-emerald-400">Trials</div>
                <div className="flex justify-between text-slate-300 ml-2 font-medium"><span className="text-[10px]">Online</span><span>{data.trial_online}</span></div>
              </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};