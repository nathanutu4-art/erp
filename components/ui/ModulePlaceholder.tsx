/**
 * ============================================================================
 * PLACEHOLDER MODUL (MODULE PLACEHOLDER)
 * ============================================================================
 * 
 * Komponen hero banner pengenalan modul (`.mod-hero`):
 * - Menampilkan ikon grafis modul, judul fitur, deskripsi bisnis, dan keterangan integrasi database.
 * ============================================================================
 */

import { GlassCard } from "@/components/ui/GlassCard";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
};

export function ModulePlaceholder({
  title,
  description,
  icon,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-4">
      <div className="card mod-hero">
        <div className="m-ic">
          {icon ?? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9c.23.6.86 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
            </svg>
          )}
        </div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="card card-pad text-center">
        <p className="font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
          Modul Terintegrasi
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Modul ini terhubung langsung ke database PostgreSQL Supabase dan mematuhi hak akses pengguna.
        </p>
      </div>
    </div>
  );
}
