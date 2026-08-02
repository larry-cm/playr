"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children?: ReactNode;
}

export default function Modal({ isOpen, title, onClose, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl rounded-2xl backdrop-blur-xl shadow-2xl p-6"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-white/95">{title}</h3>
          <button
            onClick={onClose}
            className="ml-auto text-secondary bg-transparent p-2 rounded-full transition-colors duration-200 hover:cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Cerrar"
            autoFocus
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 text-sm text-white/90">{children}</div>
      </div>
    </div>
  );
}
