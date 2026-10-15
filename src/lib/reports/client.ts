// Browser-side helpers and response shapes for the /admin/api/reports routes.

import type { Report, ReportContent, ReportRevision, Rubric, RosterState } from './types';
import type { RosterLearner, RunSummary, GuardianLink } from './server';

export type { RosterLearner, RunSummary, GuardianLink };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export type RunResponse = { run: RunSummary; roster: RosterLearner[]; rubrics: Rubric[] };

export type ReportEvent = { id: string; event: string; actor_type: string; actor_id: string | null; meta: Record<string, unknown>; at: string };
export type ReportLinkRow = {
  id: string; guardian_lead_id: string; created_at: string; expires_at: string; revoked_at: string | null;
  last_used_at: string | null; leads: { name: string | null } | null;
};

export type ReportDetailResponse = {
  report: Report;
  content: ReportContent | null;
  published: ReportRevision | null;
  revisions: ReportRevision[];
  enrolment: { id: string; session_id: string; kids: { id: string; name: string } | null } | null;
  events: ReportEvent[];
  links: ReportLinkRow[];
};

export type SendResult = { reportId: string; links?: GuardianLink[]; error?: string };

export const STATE_LABEL: Record<RosterState, string> = {
  no_data: 'Assessment pending',
  not_started: 'Ready to generate',
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  sent: 'Sent',
  viewed: 'Viewed',
};

export const STATE_STYLE: Record<RosterState, string> = {
  no_data: 'bg-slate-100 text-slate-500',
  not_started: 'bg-sky-50 text-sky-700',
  draft: 'bg-amber-50 text-amber-700',
  in_review: 'bg-violet-50 text-violet-700',
  published: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-emerald-100 text-emerald-800',
};

export function waLink(phone: string | null, message: string): string {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0/, '27');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | null): string {
  if (!iso) return 'No date';
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' });
}
