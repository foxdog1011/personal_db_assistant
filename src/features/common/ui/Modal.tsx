import React, { useEffect, useRef } from "react";

const FOCUSABLE =
  "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex=\"-1\"])";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered in the header bar; omit to suppress header entirely */
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

/**
 * Generic modal overlay.
 * - Backdrop: bg-black/50 backdrop-blur-sm
 * - role="dialog" aria-modal="true" for screen readers
 * - Focuses panel on open; restores focus to opener on close
 * - Tab key trapped within modal; Esc → onClose()
 * - Body scroll locked while open
 * - Entrance animation via .modal-animate (defined in index.css)
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
  className = "",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Save opener focus → focus panel → restore on close
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Esc to close + Tab focus trap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === panel) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`modal-animate outline-none bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — only rendered when title is provided */}
        {title !== undefined && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {title}
            </div>
            <button
              onClick={onClose}
              aria-label="關閉"
              className="ml-3 shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
