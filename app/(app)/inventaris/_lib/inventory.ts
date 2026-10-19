/**
 * Utilitas bersama modul Inventaris & Gudang.
 * Berisi tipe, label Bahasa Indonesia, dan helper angka.
 */

export type ProductWithWarehouse = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  avg_cost: number;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  /** Gudang dari mutasi terakhir produk (null bila belum ada mutasi). */
  latestWarehouseCode: string | null;
  latestWarehouseName: string | null;
};

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_default: boolean;
  /** Estimasi stok = Σmasuk − Σkeluar dari trail mutasi (bukan saldo resmi). */
  estimatedStock: number;
};

export type MutationDirection = "in" | "out";

export const DIRECTION_LABEL: Record<MutationDirection, string> = {
  in: "Masuk",
  out: "Keluar",
};

const REFERENCE_LABEL: Record<string, string> = {
  manual: "Manual",
  saldo_awal: "Saldo Awal",
  opname: "Opname",
  purchase_order: "Purchase Order",
  sales_invoice: "Invoice Penjualan",
  adjustment: "Penyesuaian",
};

export function referenceLabel(ref: string | null | undefined): string {
  if (!ref) return "—";
  return REFERENCE_LABEL[ref] ?? ref;
}

/** Konversi nilai numeric Supabase (string|number) menjadi number yang aman. */
export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalisasi relasi hasil join: di runtime berupa objek tunggal,
 * tetapi tipe inferensi Supabase menyatakannya sebagai array.
 */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Rupiah dengan 2 desimal, mis. Rp 12.500,50 — untuk HPP average. */
export function formatIDR2(
  value: number | string | null | undefined
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/** Kuantitas hingga 3 desimal tanpa nol berlebih, mis. 10, 2,5, 0,125. */
export function formatQty(
  value: number | string | null | undefined
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(safe);
}

/** Tanggal hari ini dalam format YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validasi format tanggal YYYY-MM-DD. */
export function isDateValid(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
