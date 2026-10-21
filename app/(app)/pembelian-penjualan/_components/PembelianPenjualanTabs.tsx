/**
 * ============================================================================
 * SUBTABS NAVIGASI MODUL PEMBELIAN & PENJUALAN (PURCHASING & SALES TABS)
 * ============================================================================
 * 
 * Bilah navigasi horizontal kaca (`.subtabs`) untuk berpindah sub-modul rantai pasok:
 * - Pesanan Pembelian (PO) | Faktur Penjualan (Invoice) | Surat Jalan (Delivery Note)
 * ============================================================================
 */

import Link from "next/link";

const TABS = [
  { key: "po", label: "Pesanan Pembelian (PO)" },
  { key: "invoice", label: "Faktur Penjualan" },
  { key: "surat-jalan", label: "Surat Jalan" },
] as const;

export function PembelianPenjualanTabs({ active }: { active: string }) {
  return (
    <nav
      aria-label="Navigasi modul pembelian dan penjualan"
      className="subtabs"
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={
              t.key === "po"
                ? "/pembelian-penjualan"
                : `/pembelian-penjualan?tab=${t.key}`
            }
            aria-current={isActive ? "page" : undefined}
            className={`subtab ${isActive ? "active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
