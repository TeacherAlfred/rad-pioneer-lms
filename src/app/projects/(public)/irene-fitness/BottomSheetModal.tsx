'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Shared shell for every "tap to open a sheet from the bottom" interaction on
// this platform - story detail, FAQ, contact form, opt-out. One gesture to
// learn once, reused everywhere rather than each feature inventing its own.
//
// Portaled to document.body rather than rendered in place: the header icons
// live inside <nav className="... backdrop-blur-xl">, and backdrop-filter on
// an ancestor establishes a new containing block for position:fixed
// descendants - without the portal, this modal's "fixed inset-0" resolves
// against the ~70px header bar instead of the viewport, crushing it into an
// unusable sliver. Modals opened from inside the page body (not the nav)
// aren't affected, but the portal is correct regardless of where this gets
// used next.
//
// No SSR mounted-guard needed: every current caller only renders this in
// response to a client-side click (panel/openStoryId state starts falsy),
// so it never appears in the initial server-rendered tree where `document`
// wouldn't exist yet.
export function BottomSheetModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[80vh] overflow-y-auto p-6"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-black text-lg">{title}</p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
