// Device-local progress for the Tutorial Hub - the default for every
// visitor (spec S5's same-device minimum), independent of whether they
// ever link a phone. Phone-linked sync (src/lib/tutorialProgress.ts,
// src/app/api/tutorials/progress/route.ts) is a later, optional promotion
// of this same shape, not a replacement for it.

export type LocalTutorialProgress = {
  currentStepOrderIndex: number;
  updatedAt: string;
  completedAt: string | null;
};

const STORAGE_KEY = 'rad_tutorial_progress';
const TOKEN_KEY = 'rad_tutorial_progress_token';

type ProgressMap = Record<string, LocalTutorialProgress>;

function readMap(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map: ProgressMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable - progress just won't survive this visit,
    // never a gate on reaching the content (spec S9).
  }
}

export function getLocalProgress(tutorialId: string): LocalTutorialProgress | null {
  return readMap()[tutorialId] || null;
}

export function getAllLocalProgress(): ProgressMap {
  return readMap();
}

export function setLocalProgress(tutorialId: string, currentStepOrderIndex: number, completed: boolean) {
  const map = readMap();
  map[tutorialId] = {
    currentStepOrderIndex,
    updatedAt: new Date().toISOString(),
    completedAt: completed ? new Date().toISOString() : (map[tutorialId]?.completedAt ?? null),
  };
  writeMap(map);
}

// Merges server-resolved progress (from the resume token flow) into local
// storage without clobbering more recent local progress on this same
// device - the server row only wins when it's actually further along.
export function mergeServerProgress(rows: { tutorial_id: string; current_step_order_index: number; completed_at: string | null }[]) {
  const map = readMap();
  for (const row of rows) {
    const existing = map[row.tutorial_id];
    if (!existing || row.current_step_order_index > existing.currentStepOrderIndex) {
      map[row.tutorial_id] = {
        currentStepOrderIndex: row.current_step_order_index,
        updatedAt: new Date().toISOString(),
        completedAt: row.completed_at,
      };
    }
  }
  writeMap(map);
}

export function getStoredProgressToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredProgressToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // best-effort, same as writeMap above
  }
}
