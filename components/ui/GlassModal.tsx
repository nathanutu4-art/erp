"use client";

/**
 * ============================================================================
 * DIALOG MODAL KACA (GLASS MODAL)
 * ============================================================================
 * 
 * Jendela dialog overlay kaca transparan dengan animasi pop:
 * 1. Overlay Backdrop: Menutupi layar dengan blur 7px dan menangkap klik luar untuk menutup modal.
 * 2. Aksesibilitas: Mendukung tombol `Escape` keyboard untuk menutup dialog (`aria-modal="true"`).
 * 3. Header Terpadu: Judul, deskripsi singkat, dan tombol silang (✕) penutup.
 * 4. Pilihan Ukuran: Mode normal (max-width 520px) atau mode lebar (`wide`, max-width 760px).
 * ============================================================================
 */

import { useEffect } from "react";

type GlassModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
};

export function GlassModal({
  open,
  onClose,
  title,
  subtitle,
  wide = false,
  children,
}: GlassModalProps) {
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
      className="overlay open"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="spacer" />
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup dialog"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
