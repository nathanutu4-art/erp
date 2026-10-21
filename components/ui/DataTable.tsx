/**
 * ============================================================================
 * WADAH TABEL DATA TERPADU (DATA TABLE CONTAINER)
 * ============================================================================
 * 
 * Membungkus tabel data ke dalam kartu kaca (`.card` + `.card-head` + `.tbl-wrap`):
 * 1. Card Header: Judul tabel, sub-judul informasi jumlah baris, bilah pencarian (`search-box`), dan slot tombol aksi.
 * 2. Table Wrapper: Wadah scroll horizontal responsif (`.tbl-wrap`) untuk elemen tabel `table.tbl`.
 * ============================================================================
 */

import type { ReactNode } from "react";

type DataTableProps = {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function DataTable({
  title,
  subtitle,
  searchPlaceholder = "Cari…",
  searchValue,
  onSearchChange,
  actions,
  children,
}: DataTableProps) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="spacer" />
        {onSearchChange !== undefined && (
          <div className="search-box">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        )}
        {actions}
      </div>
      <div className="tbl-wrap">{children}</div>
    </div>
  );
}
