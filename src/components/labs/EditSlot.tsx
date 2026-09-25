'use client';

import s from '@/app/labs/[slug]/rad-lab.module.css';
import { useLabEdit, type EditTarget } from './LabEditContext';

// Pencil button pinned to the top-right of the nearest `.editable` block.
// Renders nothing on the public site.
export function EditSlot({ target, label }: { target: EditTarget; label: string }) {
  const edit = useLabEdit();
  if (!edit) return null;
  return (
    <button
      type="button"
      className={s.editSlot}
      onClick={e => { e.stopPropagation(); edit.open(target); }}
      aria-label={`Edit ${label}`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M11.3 2.3a1.6 1.6 0 0 1 2.3 2.3L5.3 13l-3.1.8.8-3.1 8.3-8.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      Edit {label}
    </button>
  );
}
