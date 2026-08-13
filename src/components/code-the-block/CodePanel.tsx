"use client";

import { useState } from "react";
import type { CodeSample } from "@/lib/code-the-block/content/types";

export function CodePanel({ code }: { code: CodeSample }) {
  const [tab, setTab] = useState<"blocks" | "python">("blocks");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {/* Tabbed view on narrow screens */}
      <div className="lg:hidden">
        <div className="flex border-b border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={() => setTab("blocks")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "blocks" ? "bg-rad-blue text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🧩 Blocks
          </button>
          <button
            type="button"
            onClick={() => setTab("python")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "python" ? "bg-rad-purple text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🐍 Python
          </button>
        </div>
        <pre className="overflow-x-auto bg-slate-950 p-4 text-sm leading-relaxed text-slate-200">
          <code>{tab === "blocks" ? code.blocks : code.python}</code>
        </pre>
      </div>

      {/* Side-by-side on wide screens */}
      <div className="hidden lg:grid lg:grid-cols-2">
        <div className="border-r border-slate-800 bg-slate-950 p-4">
          <div className="mb-2 text-xs font-semibold text-slate-500">🧩 BLOCKS</div>
          <pre className="overflow-x-auto text-sm leading-relaxed text-slate-200">
            <code>{code.blocks}</code>
          </pre>
        </div>
        <div className="bg-slate-950 p-4">
          <div className="mb-2 text-xs font-semibold text-slate-500">🐍 PYTHON</div>
          <pre className="overflow-x-auto text-sm leading-relaxed text-slate-200">
            <code>{code.python}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
