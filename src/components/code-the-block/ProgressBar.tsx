export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>{label}</span>
          <span>
            {done}/{total}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-rad-teal transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
