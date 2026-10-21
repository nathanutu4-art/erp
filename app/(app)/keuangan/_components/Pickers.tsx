"use client";

/**
 * ============================================================================
 * KOMPONEN PEMILIH PERIODE & TANGGAL (DATE & PERIOD PICKERS)
 * ============================================================================
 * 
 * Komponen pemilih waktu yang mengupdate parameter URL query secara reaktif:
 * 1. PeriodePicker: Memilih bulan dan tahun (input month) untuk Laba Rugi dan Arus Kas.
 * 2. TanggalPicker: Memilih tanggal spesifik (input date) untuk posisi Neraca.
 * ============================================================================
 */

import { usePathname, useRouter } from "next/navigation";

/** Pemilih bulan (input type=month) yang menulis ?tab=…&periode=YYYY-MM ke URL. */
export function PeriodePicker({
  value,
  tab,
  label,
}: {
  value: string;
  tab: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
      <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-2)" }}>
        {label}:
      </label>
      <input
        type="month"
        aria-label={label}
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            router.replace(`${pathname}?tab=${tab}&periode=${e.target.value}`);
          }
        }}
        className="select"
        style={{ height: "37px", padding: "0 10px" }}
      />
    </div>
  );
}

/** Pemilih tanggal (input type=date) yang menulis ?tab=neraca&tanggal=YYYY-MM-DD. */
export function TanggalPicker({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
      <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-2)" }}>
        {label}:
      </label>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            router.replace(`${pathname}?tab=neraca&tanggal=${e.target.value}`);
          }
        }}
        className="select"
        style={{ height: "37px", padding: "0 10px" }}
      />
    </div>
  );
}
