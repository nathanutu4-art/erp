/**
 * ============================================================================
 * SUBTABS NAVIGASI MODUL SDM & KEHADIRAN (HR TABS)
 * ============================================================================
 * 
 * Bilah navigasi horizontal kaca (`.subtabs`) untuk berpindah sub-modul SDM:
 * - Karyawan | Kehadiran | Pengajuan Cuti / Izin | Payroll
 * ============================================================================
 */

import Link from "next/link";

const TABS = [
  { key: "karyawan", label: "Karyawan" },
  { key: "kehadiran", label: "Kehadiran" },
  { key: "pengajuan", label: "Pengajuan Cuti / Izin" },
  { key: "payroll", label: "Payroll" },
] as const;

export function SdmTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Navigasi modul SDM" className="subtabs">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "karyawan" ? "/sdm" : `/sdm?tab=${t.key}`}
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
