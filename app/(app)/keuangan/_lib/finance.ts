/**
 * Utilitas bersama modul Keuangan & Akuntansi (dipakai sisi server).
 * Berisi tipe, label Bahasa Indonesia, dan matematika saldo normal.
 */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: "Aset",
  liability: "Liabilitas",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

export type JournalStatus = "draft" | "posted" | "void";

export const STATUS_LABEL: Record<JournalStatus, string> = {
  draft: "Draf",
  posted: "Dibukukan",
  void: "Dibatalkan",
};

export const STATUS_STYLE: Record<JournalStatus, string> = {
  draft: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  posted: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  void: "bg-rose-400/20 text-rose-200 border-rose-300/40",
};

/** Kode akun kas & setara kas untuk Arus Kas. */
export const CASH_ACCOUNT_CODES = ["1100", "1110"];

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

/**
 * Saldo akun mengikuti saldo normal PSAK:
 * Aset & Beban = debit − kredit; Liabilitas, Ekuitas & Pendapatan = kredit − debit.
 * Akun kontra-aset (mis. Akumulasi Penyusutan, tipe "asset") otomatis bernilai
 * negatif bila sisi kreditnya dominan — itu penyajian yang benar.
 */
export function saldoNormal(
  type: AccountType,
  debit: number,
  credit: number
): number {
  return type === "asset" || type === "expense"
    ? debit - credit
    : credit - debit;
}

/** Opsi akun ringkas untuk pemilih akun (dropdown/modal). */
export type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  is_header: boolean;
  is_active: boolean;
};

/** Label periode "2026-10" menjadi "Oktober 2026". */
export function labelPeriode(periode: string): string {
  const [y, m] = periode.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return periode;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}
