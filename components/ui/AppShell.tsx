"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { SignOutButton } from "@/components/ui/SignOutButton";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  roleName: string | null;
  companyName?: string;
  companyAddress?: string;
};

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  children,
  userName,
  roleName,
  companyName = "PT Maju Bersama",
  companyAddress,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const currentYear = new Date().getFullYear();
  const currentMonthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date());

  const TITLES: Record<string, { title: string; crumb: string }> = {
    "/dashboard": { title: "Dashboard", crumb: `Ringkasan bisnis · ${companyName}` },
    "/keuangan": { title: "Keuangan & Akuntansi", crumb: "Bagan Akun, Jurnal, dan Laporan Keuangan" },
    "/sdm": { title: "SDM & Kehadiran", crumb: "Manajemen Karyawan, Presensi, dan Penggajian" },
    "/inventaris": { title: "Inventaris & Gudang", crumb: "Stok Barang, Pergudangan, dan Kartu Stok" },
    "/pembelian-penjualan": { title: "Pembelian & Penjualan", crumb: "Pesanan Pembelian, Faktur, dan Pengiriman" },
    "/crm": { title: "CRM Pelanggan", crumb: "Kelola Relasi dan Interaksi Pelanggan" },
    "/aset": { title: "Aset Tetap", crumb: "Inventarisasi dan Penyusutan Aset Perusahaan" },
    "/pengaturan": { title: "Pengaturan", crumb: "Profil Perusahaan dan Konfigurasi Sistem" },
  };

  const matchedKey =
    Object.keys(TITLES).find(
      (key) => pathname === key || (key !== "/dashboard" && pathname.startsWith(key))
    ) ?? "/dashboard";
  const { title, crumb } = TITLES[matchedKey] ?? {
    title: "ERP",
    crumb: companyName,
  };

  const initials = getInitials(userName);

  return (
    <div className="app">
      {/* Sidebar Tunggal (Desktop Sticky & Mobile Drawer) */}
      <aside className={`sidebar ${drawerOpen ? "open" : ""}`} id="sidebar">
        <Sidebar
          companyName={companyName}
          companyAddress={companyAddress}
          onNavigate={() => setDrawerOpen(false)}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`backdrop ${drawerOpen ? "on" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Area Utama */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <button
            type="button"
            className="icon-btn hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div>
            <h1 id="pageTitle">{title}</h1>
            <div className="crumb" id="pageCrumb">
              {crumb}
            </div>
          </div>

          <div className="spacer" />

          <span className="proto-chip">
            <i />
            Sistem Aktif
          </span>

          <span className="period-chip">
            Periode: {currentMonthName} {currentYear}
          </span>

          <button
            type="button"
            className="icon-btn"
            id="bellBtn"
            aria-label="Notifikasi"
            title="Notifikasi"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            <span className="dot" />
          </button>

          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <b>{userName}</b>
              <span>{roleName ?? "Staf"}</span>
            </div>
          </div>

          <SignOutButton />
        </header>

        {/* Konten Halaman */}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
