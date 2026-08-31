"use client";

import { motion } from "framer-motion";

interface ReadingGaugeProps {
  /** 0-100 */
  progress: number;
  size?: number;
  label?: string;
  /** Hides the tick ring - suited to small/header contexts where ticks would just look cluttered. */
  showTicks?: boolean;
}

const TICK_COUNT = 32;

export default function ReadingGauge({ progress, size = 120, label, showTicks = true }: ReadingGaugeProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const circumference = 2 * Math.PI * r;
  // Arc sweeps 270° starting at -135°, matching the needle's own range below.
  const sweep = 0.75;
  const dashArray = circumference * sweep;
  const dashOffset = dashArray * (1 - clamped / 100);

  const needleAngle = -135 + (clamped / 100) * 270;

  const ticks = Array.from({ length: TICK_COUNT }).map((_, i) => {
    const angle = -135 + (i / (TICK_COUNT - 1)) * 270;
    const rad = (angle * Math.PI) / 180;
    const major = i % 4 === 0;
    const rOuter = r + 8;
    const rInner = major ? r + 2 : r + 5;
    return {
      key: i,
      x1: cx + Math.cos(rad) * rOuter,
      y1: cy + Math.sin(rad) * rOuter,
      x2: cx + Math.cos(rad) * rInner,
      y2: cy + Math.sin(rad) * rInner,
      major,
    };
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gauge-brass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e6c179" />
            <stop offset="100%" stopColor="#c79a4b" />
          </linearGradient>
        </defs>

        {showTicks &&
          ticks.map((t) => (
            <line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? "#cbd5e1" : "#e2e8f0"}
              strokeWidth={t.major ? 1.4 : 1}
            />
          ))}

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={3}
          strokeDasharray={`${dashArray} ${circumference}`}
          transform={`rotate(-225 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#gauge-brass)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
          transform={`rotate(-225 ${cx} ${cy})`}
          style={{ filter: "drop-shadow(0 0 4px rgba(199,154,75,0.45))" }}
        />

        {/* Needle starts well clear of center so it never crosses the
            percentage readout - it only occupies the outer ring, no hub
            dot sitting on top of the digits. */}
        <motion.g
          initial={false}
          animate={{ rotate: needleAngle }}
          transition={{ type: "spring", stiffness: 60, damping: 14 }}
          style={{ originX: `${cx}px`, originY: `${cy}px` }}
        >
          <line x1={cx + r * 0.55} y1={cy} x2={cx + r - 6} y2={cy} stroke="#c79a4b" strokeWidth={2} strokeLinecap="round" />
        </motion.g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: size * 0.06 }}>
        <span
          className="font-bold text-slate-900 font-precision leading-none"
          style={{ fontSize: Math.max(11, size * 0.15) }}
        >
          {Math.round(clamped)}%
        </span>
        {label && <span className="text-[8px] font-data uppercase tracking-widest text-slate-400 mt-1">{label}</span>}
      </div>
    </div>
  );
}
