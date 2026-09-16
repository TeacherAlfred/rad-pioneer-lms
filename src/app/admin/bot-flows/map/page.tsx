"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, GitBranch, X, ShieldAlert, VolumeX, MessageSquareReply } from "lucide-react";

type Button = { id: string; title: string };

type FlowRow = {
  id: string;
  trigger_button_id: string;
  label: string;
  action_type: "message" | "template" | "bot_media" | "tag_only";
  message_body: string | null;
  message_buttons: Button[] | null;
  template_name: string | null;
  template_language: string | null;
  template_button_payloads: string[] | null;
  bot_media_keyword: string | null;
  add_tags: string[] | null;
  notify_admin: boolean;
  skip_human_handoff: boolean;
  sets_opted_out: boolean;
  requires_approval: boolean;
  expects_reply: boolean;
  active: boolean;
};

type Node = FlowRow & { column: number };
type Edge = { fromId: string; toId: string; label: string };

const TYPE_BADGE: Record<string, string> = {
  template: "bg-indigo-50 text-indigo-600",
  bot_media: "bg-emerald-50 text-emerald-600",
  tag_only: "bg-amber-50 text-amber-600",
  message: "bg-blue-50 text-blue-600",
};
const TYPE_LABEL: Record<string, string> = {
  template: "Template",
  bot_media: "Bot Media",
  tag_only: "Tag Only",
  message: "Message",
};

// Every button-id a flow can hand a lead that, if tapped, would match
// another flow's trigger_button_id - the two chaining mechanisms bot_flows
// itself supports (a message's own buttons, or a template's button
// payloads). bot_media items can also chain via their own buttons, but
// those aren't bot_flows rows, so there's no flow-to-flow edge to draw for
// them here.
function outgoingIds(flow: FlowRow): { id: string; label: string }[] {
  if (flow.action_type === "message") {
    return (flow.message_buttons || []).map(b => ({ id: b.id, label: b.title }));
  }
  if (flow.action_type === "template") {
    return (flow.template_button_payloads || []).filter(Boolean).map(id => ({ id, label: id }));
  }
  return [];
}

// Layered left-to-right layout, entirely derived from the live table every
// render - a root is just "nothing points at it", so a newly added flow
// slots into its correct column automatically with zero configuration.
// BFS first-visit-wins handles a node reachable from multiple roots (or a
// pure cycle with no root at all, via the trailing fallback pass) without
// needing real cycle detection.
function layoutFlows(flows: FlowRow[]): { nodes: Node[]; edges: Edge[] } {
  const byTrigger = new Map(flows.map(f => [f.trigger_button_id, f]));
  const edges: Edge[] = [];
  const incoming = new Set<string>();
  for (const f of flows) {
    for (const out of outgoingIds(f)) {
      const target = byTrigger.get(out.id);
      if (target && target.id !== f.id) {
        edges.push({ fromId: f.id, toId: target.id, label: out.label });
        incoming.add(target.id);
      }
    }
  }

  const column = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    adjacency.set(e.fromId, [...(adjacency.get(e.fromId) || []), e.toId]);
  }

  let queue = flows.filter(f => !incoming.has(f.id)).map(f => f.id);
  queue.forEach(id => column.set(id, 0));
  while (queue.length > 0) {
    const next: string[] = [];
    for (const id of queue) {
      const col = column.get(id)!;
      for (const targetId of adjacency.get(id) || []) {
        if (!column.has(targetId)) {
          column.set(targetId, col + 1);
          next.push(targetId);
        }
      }
    }
    queue = next;
  }
  // Anything still unvisited only has incoming edges from other unvisited
  // nodes - a pure cycle with no external trigger. Treat each as its own
  // root rather than dropping it from the map.
  for (const f of flows) {
    if (!column.has(f.id)) column.set(f.id, 0);
  }

  const nodes: Node[] = flows.map(f => ({ ...f, column: column.get(f.id)! }));
  return { nodes, edges };
}

export default function BotFlowsMapPage() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/bot-flows");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bot flows");
      setFlows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const { nodes, edges } = useMemo(() => layoutFlows(flows), [flows]);

  const columns = useMemo(() => {
    const byCol = new Map<number, Node[]>();
    for (const n of nodes) {
      (byCol.get(n.column) || byCol.set(n.column, []).get(n.column)!).push(n);
    }
    return Array.from(byCol.entries()).sort((a, b) => a[0] - b[0]);
  }, [nodes]);

  // Measures real card positions after layout/paint and draws the SVG
  // overlay from scratch - recomputed on data change, window resize, and
  // container resize (a card's height depends on its own content, so the
  // container can reflow without the window itself resizing).
  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setCanvasSize({ width: container.scrollWidth, height: container.scrollHeight });
      const next = edges.map(e => {
        const fromEl = cardRefs.current.get(e.fromId);
        const toEl = cardRefs.current.get(e.toId);
        if (!fromEl || !toEl) return null;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        return {
          x1: fromRect.right - containerRect.left + container.scrollLeft,
          y1: fromRect.top - containerRect.top + container.scrollTop + fromRect.height / 2,
          x2: toRect.left - containerRect.left + container.scrollLeft,
          y2: toRect.top - containerRect.top + container.scrollTop + toRect.height / 2,
        };
      }).filter((l): l is { x1: number; y1: number; x2: number; y2: number } => !!l);
      setLines(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [edges, nodes]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/bot-flows" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Bot Flows
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <GitBranch size={22} className="text-blue-500" /> Flow Map
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Live, computed from the bot_flows table every load - a flow with nothing pointing at it (a template payload, a hardcoded webhook entry point) starts a new column on the left; a new flow chained from an existing one slots in on its own, no setup needed here.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : nodes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-400 text-sm">No flows yet.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-auto" style={{ maxHeight: "75vh" }}>
            <div ref={containerRef} className="relative p-8" style={{ minWidth: "fit-content" }}>
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={canvasSize.width}
                height={canvasSize.height}
                style={{ overflow: "visible" }}
              >
                <defs>
                  <marker id="map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                  </marker>
                </defs>
                <g className="text-slate-300">
                  {lines.map((l, i) => {
                    const midX = (l.x1 + l.x2) / 2;
                    return (
                      <path
                        key={i}
                        d={`M${l.x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${l.x2},${l.y2}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        markerEnd="url(#map-arrow)"
                      />
                    );
                  })}
                </g>
              </svg>

              <div className="relative flex gap-16">
                {columns.map(([col, colNodes]) => (
                  <div key={col} className="flex flex-col gap-4" style={{ width: 260 }}>
                    {colNodes.map(node => (
                      <div
                        key={node.id}
                        ref={el => { if (el) cardRefs.current.set(node.id, el); else cardRefs.current.delete(node.id); }}
                        onClick={() => setSelected(node)}
                        className={`relative bg-white border rounded-2xl p-3.5 shadow-sm cursor-pointer hover:border-slate-400 transition-colors ${node.active ? "border-slate-200" : "border-slate-100 opacity-50"}`}
                      >
                        <p className="text-[13px] font-bold text-slate-800 leading-snug">{node.label}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{node.trigger_button_id}</p>
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${TYPE_BADGE[node.action_type]}`}>
                            {TYPE_LABEL[node.action_type]}
                          </span>
                          {node.requires_approval && (
                            <span title="Requires approval" className="text-amber-500"><ShieldAlert size={12} /></span>
                          )}
                          {node.sets_opted_out && (
                            <span title="Sets opted_out" className="text-rose-500"><VolumeX size={12} /></span>
                          )}
                          {node.expects_reply && (
                            <span title="Captures a reply" className="text-blue-500"><MessageSquareReply size={12} /></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">{selected.label}</h3>
                <p className="text-[12px] font-mono text-slate-400 mt-0.5">{selected.trigger_button_id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><X size={13} /></button>
            </div>
            <div className="px-6 pt-4 pb-5 space-y-3 overflow-y-auto text-sm">
              <span className={`inline-flex text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_BADGE[selected.action_type]}`}>
                {TYPE_LABEL[selected.action_type]}
              </span>
              {selected.action_type === "message" && (
                <div className="bg-slate-50 rounded-xl px-3.5 py-3 text-[13px] text-slate-700 whitespace-pre-wrap">{selected.message_body}</div>
              )}
              {selected.action_type === "template" && (
                <p className="text-slate-600">Template: <b>{selected.template_name}</b> ({selected.template_language})</p>
              )}
              {selected.action_type === "bot_media" && (
                <p className="text-slate-600">Bot Media keyword: <b>"{selected.bot_media_keyword}"</b></p>
              )}
              {(selected.message_buttons || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Buttons</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.message_buttons || []).map(b => (
                      <span key={b.id} className="text-[11px] bg-slate-50 px-2 py-0.5 rounded-full text-slate-500">{b.title} → {b.id}</span>
                    ))}
                  </div>
                </div>
              )}
              {(selected.add_tags || []).length > 0 && (
                <p className="text-[12px] text-slate-500">Tags: {(selected.add_tags || []).join(", ")}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.requires_approval && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Requires approval</span>}
                {selected.sets_opted_out && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">Sets opted_out</span>}
                {selected.expects_reply && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Captures reply</span>}
                {selected.notify_admin && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Notifies admin</span>}
                {!selected.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Inactive</span>}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <Link
                href="/admin/bot-flows"
                className="block w-full text-center py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors duration-150"
              >
                Edit this flow
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
