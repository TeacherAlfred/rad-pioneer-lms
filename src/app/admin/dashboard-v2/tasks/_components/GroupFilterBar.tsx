"use client";

export type TaskGroup = { id: string; name: string; color: string | null };

export function GroupFilterBar({
  groups,
  selected,
  onToggle,
  onClear,
}: {
  groups: TaskGroup[];
  selected: string[];
  onToggle: (groupId: string) => void;
  onClear: () => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onClear}
        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
          selected.length === 0 ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-500 hover:text-stone-900"
        }`}
      >
        All
      </button>
      {groups.map((g) => {
        const active = selected.includes(g.id);
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              active ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 text-stone-500 hover:text-stone-900"
            }`}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
