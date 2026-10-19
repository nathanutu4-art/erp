"use client";

import { useEffect } from "react";

type GlassModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function GlassModal({ open, onClose, title, children }: GlassModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-default"
      />
      <div className="glass-strong relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="glass min-w-[44px] min-h-[44px] rounded-xl text-slate-200 hover:bg-white/15 transition-colors font-bold"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
