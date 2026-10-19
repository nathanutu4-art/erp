/**
 * Utilitas bersama modul Aset Tetap (dipakai sisi server & klien).
 * Berisi tipe, label Bahasa Indonesia, dan matematika penyusutan.
 */

export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function isDateValid(s: string | null | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type DepreciationMethod = "straight_line" | "declining_balance";

export const DEPRECIATION_METHOD_LABEL: Record<DepreciationMethod, string> = {
  straight_line: "Garis Lurus",
  declining_balance: "Saldo Menurun",
};

export const DEPRECIATION_METHOD_ORDER: DepreciationMethod[] = [
  "straight_line",
  "declining_balance",
];

export type AssetStatus = "active" | "under_maintenance" | "disposed";

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  active: "Aktif",
  under_maintenance: "Perawatan",
  disposed: "Dilepas",
};

export const ASSET_STATUS_STYLE: Record<AssetStatus, string> = {
  active: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  under_maintenance: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  disposed: "bg-slate-400/20 text-slate-300 border-slate-300/40",
};

/** Tanggal hari pertama bulan, format YYYY-MM-DD. */
export function firstDayOfMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-01`;
}

/** Geser (tahun, bulan) sebanyak n bulan ke depan. */
export function addMonths(
  year: number,
  month1to12: number,
  n: number
): { year: number; month: number } {
  const total = year * 12 + (month1to12 - 1) + n;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

/** Nama bulan + tahun dalam Bahasa Indonesia, mis. "Mar 2026". */
export function formatPeriode(periodDate: string): string {
  const d = new Date(`${periodDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return periodDate.slice(0, 7);
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }).format(d);
}

export type ScheduleRow = {
  periodDate: string;
  amountCents: number;
  accumulatedCents: number;
  bookValueCents: number;
};

/**
 * Membangun jadwal penyusutan bulanan dalam satuan SEN agar presisi.
 * Periode pertama = bulan perolehan aset.
 *
 * - Garis lurus (D7, default): (harga − nilai sisa) / umur ekonomis.
 *   Pembulatan ke bawah per bulan; bulan terakhir menyerap sisa agar
 *   total tepat sama dengan nilai yang dapat disusutkan.
 * - Saldo menurun (double-declining): tarif 2/umur per bulan atas nilai
 *   buku awal bulan, tidak pernah di bawah nilai sisa; bulan terakhir
 *   menyesuaikan ke nilai sisa.
 */
export function buildSchedule(args: {
  purchaseCostCents: number;
  salvageCents: number;
  usefulLifeMonths: number;
  purchaseYear: number;
  purchaseMonth1to12: number;
  method: DepreciationMethod;
}): ScheduleRow[] {
  const depreciable = Math.max(0, args.purchaseCostCents - args.salvageCents);
  const rows: ScheduleRow[] = [];
  let accumulated = 0;

  if (args.method === "straight_line") {
    const monthly = Math.floor(depreciable / args.usefulLifeMonths);
    for (let i = 0; i < args.usefulLifeMonths; i++) {
      const isLast = i === args.usefulLifeMonths - 1;
      const amount = isLast ? depreciable - accumulated : monthly;
      accumulated += amount;
      const { year, month } = addMonths(
        args.purchaseYear,
        args.purchaseMonth1to12,
        i
      );
      rows.push({
        periodDate: firstDayOfMonth(year, month),
        amountCents: amount,
        accumulatedCents: accumulated,
        bookValueCents: args.purchaseCostCents - accumulated,
      });
    }
    return rows;
  }

  // declining_balance (double-declining)
  const rate = 2 / args.usefulLifeMonths;
  let book = args.purchaseCostCents;
  for (let i = 0; i < args.usefulLifeMonths; i++) {
    const isLast = i === args.usefulLifeMonths - 1;
    let amount = Math.round(book * rate);
    if (isLast || book - amount < args.salvageCents) {
      amount = Math.max(0, book - args.salvageCents);
    }
    accumulated += amount;
    book -= amount;
    const { year, month } = addMonths(
      args.purchaseYear,
      args.purchaseMonth1to12,
      i
    );
    rows.push({
      periodDate: firstDayOfMonth(year, month),
      amountCents: amount,
      accumulatedCents: accumulated,
      bookValueCents: book,
    });
    if (book <= args.salvageCents) break;
  }
  return rows;
}
