/**
 * Utilitas bersama modul SDM & Kehadiran (dipakai sisi server & klien).
 * Berisi tipe, label Bahasa Indonesia, dan matematika payroll.
 *
 * Keputusan D8 (payroll): komponen gaji configurable, PPh 21 otomatis memakai
 * Tarif Efektif Rata-rata (TER), iuran BPJS Kesehatan & Ketenagakerjaan,
 * akrual THR prorata, slip gaji siap cetak.
 * Keputusan D9 (approval): approver default = atasan langsung (supervisor_id);
 * HR dapat mengambil alih bila atasan berhalangan (dicatat di approver_id).
 */

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

// ---------------------------------------------------------------------------
// Label status
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | "present"
  | "late"
  | "leave"
  | "sick"
  | "permit"
  | "absent";

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Hadir",
  late: "Terlambat",
  leave: "Cuti",
  sick: "Sakit",
  permit: "Ijin",
  absent: "Alpa",
};

export const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  late: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  leave: "bg-sky-400/20 text-sky-200 border-sky-300/40",
  sick: "bg-violet-400/20 text-violet-200 border-violet-300/40",
  permit: "bg-indigo-400/20 text-indigo-200 border-indigo-300/40",
  absent: "bg-rose-400/20 text-rose-200 border-rose-300/40",
};

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export const LEAVE_STATUS_STYLE: Record<LeaveRequestStatus, string> = {
  pending: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  approved: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  rejected: "bg-rose-400/20 text-rose-200 border-rose-300/40",
  cancelled: "bg-slate-400/20 text-slate-300 border-slate-300/40",
};

export type EmploymentStatus = "active" | "resigned" | "terminated";

export const EMPLOYMENT_LABEL: Record<EmploymentStatus, string> = {
  active: "Aktif",
  resigned: "Resign",
  terminated: "Diberhentikan",
};

export type PayrollPeriodStatus = "draft" | "finalized" | "paid";

export const PAYROLL_STATUS_LABEL: Record<PayrollPeriodStatus, string> = {
  draft: "Draf",
  finalized: "Final",
  paid: "Dibayar",
};

export const PAYROLL_STATUS_STYLE: Record<PayrollPeriodStatus, string> = {
  draft: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  finalized: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  paid: "bg-sky-400/20 text-sky-200 border-sky-300/40",
};

// ---------------------------------------------------------------------------
// Tipe baris
// ---------------------------------------------------------------------------

export type EmployeeRow = {
  id: string;
  employee_code: string;
  full_name: string;
  position: string | null;
  department: string | null;
  join_date: string | null;
  employment_status: EmploymentStatus;
  supervisor_id: string | null;
  supervisor_name: string | null;
  base_salary: number;
};

export type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  annual_quota_days: number;
  deducts_quota: boolean;
  requires_document: boolean;
};

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approver_id: string | null;
  approver_name: string | null;
  decided_at: string | null;
  created_at: string;
};

export type PayrollPeriodRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: PayrollPeriodStatus;
};

export type PayrollSlipRow = {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  position: string | null;
  department: string | null;
  base_salary: number;
  allowances: number;
  overtime_pay: number;
  thr_accrual: number;
  bpjs_health_employee: number;
  bpjs_health_employer: number;
  bpjs_employment_employee: number;
  bpjs_employment_employer: number;
  pph21_ter: number;
  other_deductions: number;
  gross_pay: number;
  net_pay: number;
};

// ---------------------------------------------------------------------------
// Matematika payroll (D8)
// ---------------------------------------------------------------------------

/**
 * Tarif iuran default (dapat dikonfigurasi per perusahaan di versi berikut).
 * BPJS Kesehatan: 1% karyawan + 4% perusahaan.
 * BPJS Ketenagakerjaan karyawan: JHT 2% + JP 1% = 3%.
 * BPJS Ketenagakerjaan perusahaan: JKK 0,54% + JKM 0,3% + JHT 3,7% + JP 2% = 6,54%.
 */
export const BPJS_RATES = {
  healthEmployee: 0.01,
  healthEmployer: 0.04,
  employmentEmployee: 0.03,
  employmentEmployer: 0.0654,
} as const;

/**
 * Tabel Tarif Efektif Rata-rata (TER) Kategori A — PMK 168/2023.
 * TER dikenakan SEKALI terhadap penghasilan bruto bulanan (bukan progresif).
 *
 * PENTING: angka-angka di bawah disalin dari ingatan terhadap lampiran
 * PMK 168/2023 dan BELUM diverifikasi baris-per-baris terhadap dokumen
 * aslinya. Struktur perhitungannya (satu tarif × bruto) sudah benar,
 * tetapi tim keuangan WAJIB memvalidasi tabel ini sebelum dipakai produksi.
 * Kategori yang dipakai di sini adalah Kategori A (TK/0, TK/1, K/0).
 */
const TER_A_BRACKETS: Array<[upperBound: number, rate: number]> = [
  [5400000, 0],
  [5650000, 0.0025],
  [5950000, 0.005],
  [6300000, 0.0075],
  [6750000, 0.01],
  [7500000, 0.0125],
  [8550000, 0.015],
  [9650000, 0.0175],
  [10950000, 0.02],
  [11950000, 0.0225],
  [12950000, 0.025],
  [14050000, 0.03],
  [15100000, 0.035],
  [16400000, 0.04],
  [17500000, 0.05],
  [18700000, 0.06],
  [19900000, 0.07],
  [21300000, 0.08],
  [22600000, 0.09],
  [24100000, 0.1],
  [25800000, 0.11],
  [28000000, 0.12],
  [30500000, 0.13],
  [32200000, 0.14],
  [35400000, 0.15],
  [39100000, 0.16],
  [43100000, 0.17],
  [47800000, 0.18],
  [54400000, 0.19],
  [60200000, 0.2],
  [66700000, 0.21],
  [74300000, 0.22],
  [83500000, 0.23],
  [95000000, 0.24],
  [110000000, 0.25],
  [125000000, 0.26],
  [140000000, 0.27],
  [158000000, 0.28],
  [180000000, 0.29],
  [197000000, 0.3],
  [220000000, 0.31],
  [247000000, 0.32],
  [280000000, 0.33],
  [Number.POSITIVE_INFINITY, 0.34],
];

/** Tarif TER Kategori A untuk penghasilan bruto bulanan tertentu. */
export function terRateA(grossMonthly: number): number {
  const g = Math.max(0, grossMonthly);
  for (const [upper, rate] of TER_A_BRACKETS) {
    if (g <= upper) return rate;
  }
  return 0.34;
}

export type SlipComputation = {
  base_salary: number;
  allowances: number;
  overtime_pay: number;
  thr_accrual: number;
  bpjs_health_employee: number;
  bpjs_health_employer: number;
  bpjs_employment_employee: number;
  bpjs_employment_employer: number;
  pph21_ter: number;
  other_deductions: number;
  gross_pay: number;
  net_pay: number;
};

const rupiah = (n: number): number => Math.round(n);

/**
 * Hitung seluruh komponen slip gaji dari gaji pokok + input periode.
 * Basis iuran BPJS = gaji pokok (penyederhanaan v1 yang umum dipakai UKM).
 * PPh 21 TER dikenakan atas (gaji pokok + tunjangan + lembur); akrual THR
 * dikecualikan dari TER bulanan pada v1 (dihitung ulang saat pembayaran THR).
 */
export function computeSlip(input: {
  baseSalary: number;
  allowances?: number;
  overtimePay?: number;
  otherDeductions?: number;
}): SlipComputation {
  const base_salary = Math.max(0, rupiah(input.baseSalary));
  const allowances = Math.max(0, rupiah(input.allowances ?? 0));
  const overtime_pay = Math.max(0, rupiah(input.overtimePay ?? 0));
  const other_deductions = Math.max(0, rupiah(input.otherDeductions ?? 0));

  const thr_accrual = rupiah(base_salary / 12);
  const bpjs_health_employee = rupiah(base_salary * BPJS_RATES.healthEmployee);
  const bpjs_health_employer = rupiah(base_salary * BPJS_RATES.healthEmployer);
  const bpjs_employment_employee = rupiah(
    base_salary * BPJS_RATES.employmentEmployee
  );
  const bpjs_employment_employer = rupiah(
    base_salary * BPJS_RATES.employmentEmployer
  );

  const terBase = base_salary + allowances + overtime_pay;
  const pph21_ter = rupiah(terBase * terRateA(terBase));

  const gross_pay = base_salary + allowances + overtime_pay + thr_accrual;
  const net_pay =
    gross_pay -
    (bpjs_health_employee +
      bpjs_employment_employee +
      pph21_ter +
      other_deductions);

  return {
    base_salary,
    allowances,
    overtime_pay,
    thr_accrual,
    bpjs_health_employee,
    bpjs_health_employer,
    bpjs_employment_employee,
    bpjs_employment_employer,
    pph21_ter,
    other_deductions,
    gross_pay,
    net_pay,
  };
}

/** Jumlah hari kalender inklusif antara dua tanggal ISO (YYYY-MM-DD). */
export function inclusiveDays(startISO: string, endISO: string): number {
  const s = new Date(`${startISO}T00:00:00`).getTime();
  const e = new Date(`${endISO}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}
