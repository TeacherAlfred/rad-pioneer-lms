"use client";

import { useEffect, useRef } from "react";

export interface ReaderShortcutHandlers {
  onNextPage: () => void;
  onPrevPage: () => void;
  onOpenNote: () => void;
  onToggleFullscreen: () => void;
  onEscape: () => void;
  /** Wired in once the command palette (Phase 5) exists. */
  onOpenPalette?: () => void;
}

export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/**
 * Global reader keybindings. Handlers are read from a ref so callers don't
 * need to memoize them - passing fresh inline functions every render is fine
 * and won't re-bind the listener.
 */
export function useReaderShortcuts(handlers: ReaderShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const typing = isTypingTarget(document.activeElement);

      // Cmd/Ctrl+K always active, even while typing - beats the browser's own binding.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        h.onOpenPalette?.();
        return;
      }

      if (e.key === "Escape") {
        h.onEscape();
        return;
      }

      if (typing) return;

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          h.onNextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          h.onPrevPage();
          break;
        case "n":
        case "N":
          h.onOpenNote();
          break;
        case "f":
        case "F":
          h.onToggleFullscreen();
          break;
        case "/":
          e.preventDefault();
          h.onOpenPalette?.();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
