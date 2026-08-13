"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/lib/tableSort";

export function SortableHeader({
  label, column, sortColumn, sortDirection, onSort, className,
}: {
  label: string;
  column: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sortColumn === column;
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-slate-600 ${className || ''}`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronsUpDown size={12} className="opacity-30" />}
      </span>
    </th>
  );
}
