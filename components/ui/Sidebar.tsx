"use client";

/**
 * ============================================================================
 * KOMPONEN SIDEBAR NAVIGASI UTAMA (SIDEBAR NAVIGATION)
 * ============================================================================
 * 
 * Bilah navigasi vertikal yang menampilkan:
 * 1. Brand Identitas: Logo inisial 2 huruf dan nama perusahaan yang tersinkronisasi
 *    secara dinamis dari tabel `companies` di Supabase.
 * 2. Kelompok Menu (NAV_GROUPS):
 *    - Utama: Dashboard, Keuangan & Akuntansi
 *    - Operasional: SDM & Kehadiran, Inventaris & Gudang, Pembelian & Penjualan, CRM, Aset Tetap
 *    - Sistem: Pengaturan
 * 3. Indikator Status Aktif: Menandai item menu yang sedang dibuka sesuai pathname Next.js.
 * 4. Sidebar Foot: Menampilkan tahun buku fiskal dan bulan periode akuntansi saat ini.
 * ============================================================================
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavGroup = {
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }>;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
        ),
      },
      {
        href: "/keuangan",
        label: "Keuangan & Akuntansi",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
            <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Operasional",
    items: [
      {
        href: "/sdm",
        label: "SDM & Kehadiran",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M15.5 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        href: "/inventaris",
        label: "Inventaris & Gudang",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.3 7 12 12l8.7-5" />
            <path d="M12 22V12" />
          </svg>
        ),
      },
      {
        href: "/pembelian-penjualan",
        label: "Pembelian & Penjualan",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1.6" />
            <circle cx="19" cy="21" r="1.6" />
            <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21.5 7H6" />
          </svg>
        ),
      },
      {
        href: "/crm",
        label: "CRM Pelanggan",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.1a5 5 0 1 1 7.5 6.5z" />
          </svg>
        ),
      },
      {
        href: "/aset",
        label: "Aset Tetap",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
            <path d="M9 21v-4h6v4" />
            <path d="M9 10h.01M15 10h.01M12 13.5h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Sistem",
    items: [
      {
        href: "/pengaturan",
        label: "Pengaturan",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9c.23.6.86 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
];

type SidebarProps = {
  companyName?: string;
  companyAddress?: string;
  onNavigate?: () => void;
  onClose?: () => void;
};

export function Sidebar({
  companyName = "PT Maju Bersama",
  companyAddress,
  onNavigate,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const currentYear = new Date().getFullYear();
  const currentMonthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date());

  const logoInitial = companyName.slice(0, 2).toUpperCase() || "MB";
  const subTitle = companyAddress
    ? companyAddress.split(",")[0]
    : "Distribusi & Jasa · Jakarta";

  return (
    <>
      <div className="brand">
        <div className="brand-mark">{logoInitial}</div>
        <div>
          <div className="brand-name">{companyName}</div>
          <div className="brand-sub">{subTitle}</div>
        </div>
        {onClose && (
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="nav" aria-label="Navigasi utama">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`nav-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        Tahun buku <b>{currentYear}</b> · Periode <b>{currentMonthName}</b>
        <br />
        Sistem ERP Terpadu
      </div>
    </>
  );
}
