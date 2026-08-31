"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { Plus, Minus, Maximize2, X, ArrowRight } from "lucide-react";
import type { NoteGraphNode, NoteGraphEdge, NoteEdgeReason } from "../../reader/_actions/notes";

interface SimNode extends SimulationNodeDatum, NoteGraphNode {}
interface SimLink {
  source: SimNode | string;
  target: SimNode | string;
  reason: NoteEdgeReason;
}

const EDGE_STYLE: Record<NoteEdgeReason, { color: string; width: number }> = {
  "note-tag": { color: "rgba(199,154,75,0.55)", width: 1.6 },
  tag: { color: "rgba(199,154,75,0.35)", width: 1.2 },
  author: { color: "rgba(147,160,180,0.32)", width: 1 },
  keyword: { color: "rgba(199,154,75,0.15)", width: 0.8 },
};

const EDGE_LABEL: Record<NoteEdgeReason, string> = {
  "note-tag": "Shared tag",
  tag: "Shared collection",
  author: "Same author",
  keyword: "Similar wording",
};

function colorForBook(bookId: string): string {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) hash = bookId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 42%, 52%)`;
}

const NODE_RADIUS = 5;
const HOVER_RADIUS = 7;
const CLICK_DRAG_THRESHOLD = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface NotesConstellationProps {
  nodes: NoteGraphNode[];
  edges: NoteGraphEdge[];
}

export default function NotesConstellation({ nodes: rawNodes, edges: rawEdges }: NotesConstellationProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const hoveredIdRef = useRef<string | null>(null);
  const focusedIdRef = useRef<string | null>(null);
  const neighborIdsRef = useRef<Set<string>>(new Set());
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const animationRef = useRef<number | null>(null);

  const dragRef = useRef<{ node: SimNode; startX: number; startY: number; moved: boolean } | null>(null);
  const panRef = useRef<{ startScreenX: number; startScreenY: number; startTx: number; startTy: number } | null>(null);

  const [dims, setDims] = useState({ width: 800, height: 560 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [focusedNode, setFocusedNode] = useState<SimNode | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== dims.width * dpr || canvas.height !== dims.height * dpr) {
      canvas.width = dims.width * dpr;
      canvas.height = dims.height * dpr;
      canvas.style.width = `${dims.width}px`;
      canvas.style.height = `${dims.height}px`;
    }
    const { x: tx, y: ty, k } = transformRef.current;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
    ctx.clearRect(-tx / k, -ty / k, dims.width / k, dims.height / k);

    const hoveredId = hoveredIdRef.current;
    const focusedId = focusedIdRef.current;
    const neighbors = neighborIdsRef.current;
    const emphasizeId = focusedId || hoveredId;

    simLinksRef.current.forEach((link) => {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      if (source.x === undefined || target.x === undefined) return;
      const dim = emphasizeId && source.id !== emphasizeId && target.id !== emphasizeId;
      const style = EDGE_STYLE[link.reason];
      ctx.beginPath();
      ctx.moveTo(source.x, source.y!);
      ctx.lineTo(target.x, target.y!);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width / k;
      ctx.globalAlpha = dim ? 0.1 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    simNodesRef.current.forEach((node) => {
      if (node.x === undefined || node.y === undefined) return;
      const isEmphasized = node.id === emphasizeId;
      const isDimmed = focusedId ? node.id !== focusedId && !neighbors.has(node.id) : Boolean(hoveredId && !isEmphasized);
      ctx.beginPath();
      ctx.arc(node.x, node.y, isEmphasized ? HOVER_RADIUS : NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = colorForBook(node.bookId);
      ctx.globalAlpha = isDimmed ? 0.15 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isEmphasized) {
        ctx.lineWidth = 1.5 / k;
        ctx.strokeStyle = "#0f172a";
        ctx.stroke();
      }
    });
  }, [dims]);

  // Physics setup - runs once per actual dataset/size change, never on hover/focus/pan/zoom.
  useEffect(() => {
    const simNodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = rawEdges.map((e) => ({ source: e.source, target: e.target, reason: e.reason }));
    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-35))
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(65)
          .strength(0.2)
      )
      .force("center", forceCenter(dims.width / 2, dims.height / 2))
      .force("collide", forceCollide(NODE_RADIUS + 3));

    simulationRef.current = simulation;
    simulation.on("tick", draw);

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges, dims.width, dims.height]);

  // Hover/focus changes redraw immediately without perturbing the simulation.
  useEffect(() => {
    hoveredIdRef.current = hoveredNode?.id ?? null;
    draw();
  }, [hoveredNode, draw]);

  useEffect(() => {
    focusedIdRef.current = focusedNode?.id ?? null;
    if (focusedNode) {
      const ids = new Set<string>();
      simLinksRef.current.forEach((link) => {
        const source = link.source as SimNode;
        const target = link.target as SimNode;
        if (source.id === focusedNode.id) ids.add(target.id);
        if (target.id === focusedNode.id) ids.add(source.id);
      });
      neighborIdsRef.current = ids;
    } else {
      neighborIdsRef.current = new Set();
    }
    draw();
  }, [focusedNode, draw]);

  const animateTransform = (target: Transform, duration = 450) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const start = { ...transformRef.current };
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      transformRef.current = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        k: start.k + (target.k - start.k) * eased,
      };
      draw();
      if (t < 1) {
        animationRef.current = requestAnimationFrame(step);
      }
    };
    animationRef.current = requestAnimationFrame(step);
  };

  const boundsOf = (ids: Set<string> | null): { minX: number; maxX: number; minY: number; maxY: number } | null => {
    const nodes = ids ? simNodesRef.current.filter((n) => ids.has(n.id)) : simNodesRef.current;
    const withPos = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
    if (withPos.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    withPos.forEach((n) => {
      minX = Math.min(minX, n.x!);
      maxX = Math.max(maxX, n.x!);
      minY = Math.min(minY, n.y!);
      maxY = Math.max(maxY, n.y!);
    });
    return { minX, maxX, minY, maxY };
  };

  const fitToView = (ids: Set<string> | null = null, padding = 60) => {
    const bounds = boundsOf(ids);
    if (!bounds) return;
    const w = Math.max(bounds.maxX - bounds.minX, 40);
    const h = Math.max(bounds.maxY - bounds.minY, 40);
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((dims.width - padding) / w, (dims.height - padding) / h)));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    animateTransform({ x: dims.width / 2 - cx * k, y: dims.height / 2 - cy * k, k });
  };

  const zoomBy = (factor: number) => {
    const { x, y, k } = transformRef.current;
    const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    const cx = dims.width / 2;
    const cy = dims.height / 2;
    const worldX = (cx - x) / k;
    const worldY = (cy - y) / k;
    animateTransform({ x: cx - worldX * newK, y: cy - worldY * newK, k: newK }, 200);
  };

  const getLocalPoint = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const toWorld = (screenX: number, screenY: number) => {
    const { x, y, k } = transformRef.current;
    return { x: (screenX - x) / k, y: (screenY - y) / k };
  };

  const nodeAtWorld = (wx: number, wy: number): SimNode | null => {
    const { k } = transformRef.current;
    const hitRadius = (HOVER_RADIUS + 3) / k;
    for (const node of simNodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue;
      const dx = node.x - wx;
      const dy = node.y - wy;
      if (dx * dx + dy * dy <= hitRadius ** 2) return node;
    }
    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const { x, y, k } = transformRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    const { x: screenX, y: screenY } = getLocalPoint(e);
    const worldX = (screenX - x) / k;
    const worldY = (screenY - y) / k;
    transformRef.current = { x: screenX - worldX * newK, y: screenY - worldY * newK, k: newK };
    draw();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x: sx, y: sy } = getLocalPoint(e);
    const { x: wx, y: wy } = toWorld(sx, sy);
    const node = nodeAtWorld(wx, wy);
    if (node) {
      dragRef.current = { node, startX: sx, startY: sy, moved: false };
      node.fx = node.x;
      node.fy = node.y;
      simulationRef.current?.alphaTarget(0.15).restart();
    } else {
      panRef.current = { startScreenX: sx, startScreenY: sy, startTx: transformRef.current.x, startTy: transformRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: sx, y: sy } = getLocalPoint(e);

    if (dragRef.current) {
      const drag = dragRef.current;
      const { x: wx, y: wy } = toWorld(sx, sy);
      if (Math.hypot(sx - drag.startX, sy - drag.startY) > CLICK_DRAG_THRESHOLD) drag.moved = true;
      drag.node.fx = wx;
      drag.node.fy = wy;
      return;
    }

    if (panRef.current) {
      const pan = panRef.current;
      transformRef.current = {
        ...transformRef.current,
        x: pan.startTx + (sx - pan.startScreenX),
        y: pan.startTy + (sy - pan.startScreenY),
      };
      draw();
      return;
    }

    const { x: wx, y: wy } = toWorld(sx, sy);
    const node = nodeAtWorld(wx, wy);
    if (node !== hoveredNode) {
      setHoveredNode(node);
      setTooltipPos({ x: sx, y: sy });
    } else if (node) {
      setTooltipPos({ x: sx, y: sy });
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag) {
      simulationRef.current?.alphaTarget(0);
      if (!drag.moved) {
        // A click, not a drag - focus this note instead of navigating away immediately.
        drag.node.fx = null;
        drag.node.fy = null;
        setFocusedNode(drag.node);
      }
      // If actually dragged, leave fx/fy set so the node stays where it was placed.
    }
    dragRef.current = null;
    panRef.current = null;
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
    if (dragRef.current) {
      simulationRef.current?.alphaTarget(0);
      dragRef.current = null;
    }
    panRef.current = null;
  };

  const handleBackgroundDoubleClick = () => {
    setFocusedNode(null);
  };

  return (
    <div>
      <div ref={containerRef} className="relative w-full h-[560px] bg-white border border-slate-200 rounded-[20px] shadow-sm overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onDoubleClick={handleBackgroundDoubleClick}
          className="cursor-grab active:cursor-grabbing"
        />

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => zoomBy(1.3)} className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors" title="Zoom in">
            <Plus size={14} strokeWidth={2.5} />
          </button>
          <div className="h-px bg-slate-100" />
          <button onClick={() => zoomBy(1 / 1.3)} className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors" title="Zoom out">
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <div className="h-px bg-slate-100" />
          <button onClick={() => fitToView(null)} className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors" title="Fit all notes">
            <Maximize2 size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Lightweight hover preview - only while nothing is focused */}
        {hoveredNode && !focusedNode && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 max-w-xs"
            style={{
              left: Math.min(tooltipPos.x + 14, dims.width - 260),
              top: Math.min(tooltipPos.y + 14, dims.height - 120),
            }}
          >
            <p className="font-data text-[9px] uppercase tracking-widest text-brass-400 mb-1">{hoveredNode.bookTitle}</p>
            {hoveredNode.excerpt && (
              <p className="font-display italic text-sm text-white/90 leading-snug line-clamp-3">"{hoveredNode.excerpt}"</p>
            )}
            {!hoveredNode.excerpt && hoveredNode.userComment && (
              <p className="font-precision text-xs text-white/80 leading-snug line-clamp-3">{hoveredNode.userComment}</p>
            )}
            <p className="font-data text-[9px] text-white/40 mt-2">Click to focus</p>
          </div>
        )}

        {/* Sticky focus panel */}
        {focusedNode && (
          <div className="absolute top-4 left-4 z-10 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 max-w-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-data text-[9px] uppercase tracking-widest text-brass-600">{focusedNode.bookTitle}</p>
              <button onClick={() => setFocusedNode(null)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
            {focusedNode.excerpt && (
              <p className="font-display italic text-base text-slate-700 leading-snug mb-2">"{focusedNode.excerpt}"</p>
            )}
            {focusedNode.userComment && (
              <p className="font-precision text-sm text-slate-900 leading-snug mb-3">{focusedNode.userComment}</p>
            )}
            <p className="font-data text-[9px] text-slate-400 uppercase tracking-widest mb-4">
              {neighborIdsRef.current.size} connected {neighborIdsRef.current.size === 1 ? "note" : "notes"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fitToView(new Set([focusedNode.id, ...neighborIdsRef.current]))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors"
              >
                Frame connections
              </button>
              <button
                onClick={() => router.push(`/projects/reader-v2/${focusedNode.bookId}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Open Book <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 font-data text-[10px] uppercase tracking-widest text-slate-400">
        {(Object.keys(EDGE_STYLE) as NoteEdgeReason[]).map((reason) => (
          <span key={reason} className="flex items-center gap-2">
            <span className="w-4 h-px" style={{ backgroundColor: EDGE_STYLE[reason].color.replace(/[\d.]+\)$/, "1)") }} />
            {EDGE_LABEL[reason]}
          </span>
        ))}
        <span className="text-slate-300">·</span>
        <span>{rawNodes.length} notes, {rawEdges.length} connections</span>
        <span className="text-slate-300">·</span>
        <span>Scroll to zoom, drag background to pan, double-click to clear focus</span>
      </div>
    </div>
  );
}
