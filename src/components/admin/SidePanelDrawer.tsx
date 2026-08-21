"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";

// Generic right-anchored slide-over shell, extracted from finance/pipeline's
// quote inspector drawer (the best-built of three independently hand-rolled
// drawers in this codebase). Shell only - header/body/footer content is
// entirely caller-supplied.
//
// IMPORTANT: this component does not gate its own visibility and does not
// render its own AnimatePresence. Framer Motion's exit animation only fires
// when a component actually mounts/unmounts as a child of AnimatePresence -
// an internal `if (!open) return null` would make this always "present" from
// AnimatePresence's perspective and silently kill the exit animation. Callers
// must conditionally render this component itself:
//
//   <AnimatePresence>
//     {isOpen && data && (
//       <SidePanelDrawer onClose={...} header={...} footer={...}>
//         {...body...}
//       </SidePanelDrawer>
//     )}
//   </AnimatePresence>
export function SidePanelDrawer({
  onClose,
  header,
  subheader,
  footer,
  children,
  widthClassName = "max-w-2xl",
  panelClassName = "bg-[#0f172a] border-l border-white/10",
  zIndexClassName = "z-[100]",
}: {
  onClose: () => void;
  header: React.ReactNode;
  /** Optional pinned strip between header and the scrollable body (e.g. a
   * summary row that shouldn't scroll away with the rest of the content). */
  subheader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  widthClassName?: string;
  panelClassName?: string;
  zIndexClassName?: string;
}) {
  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex justify-end`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`relative w-full ${widthClassName} ${panelClassName} h-full flex flex-col shadow-2xl z-10`}
      >
        <div className="p-6 md:p-8 border-b border-white/5 bg-black/20 flex justify-between items-start shrink-0">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {subheader && <div className="shrink-0">{subheader}</div>}

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">{children}</div>

        {footer && (
          <div className="p-6 border-t border-white/5 bg-black/40 flex flex-wrap gap-3 shrink-0">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}
