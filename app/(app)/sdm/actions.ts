"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL SDM & KEHADIRAN (HR ACTIONS)
 * ============================================================================
 * 
 * Mengeksekusi mutasi data ketenagakerjaan secara aman di sisi server:
 * 1. createEmployee(): Mendaftarkan staf baru dan menghasilkan nomor induk otomatis EMP-YYYY-NNNN.
 * 2. recordAttendance(): Mencatat log presensi harian per karyawan beserta jam masuk/pulang.
 * 3. createLeaveRequest(): Mengajukan cuti/izin/sakit dengan validasi kuota cuti tahunan tersisa.
 * 4. decideLeaveRequest(): Memproses persetujuan (approve/reject) oleh atasan langsung atau takeover HR.
 * 5. generatePayrollPeriod(): Menghasilkan periode penggajian dan mengalkulasi slip gaji seluruh staf aktif.
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeSlip,
  inclusiveDays,
  toNumber,
  one,
} from "./_lib/hr";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type EmployeeRef = {
  id: string;
  full_name: string;
  supervisor_id: string | null;
  employment_status: string;
  base_salary: string | number | null;
};

/**
 * Nomor karyawan berformat EMP-YYYY-NNNN, mis. EMP-2026-0007.
 */
async function generateEmployeeCode(
  supabase: SupabaseClient,
  year: string,
  extraBump = 0
): Promise<string> {
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .like("employee_code", `EMP-${year}-%`);
  const seq = (count ?? 0) + 1 + extraBump;
  return `EMP-${year}-${String(seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Karyawan
// ---------------------------------------------------------------------------

export async function createEmployee(input: {
  fullName: string;
  position?: string;
  department?: string;
  joinDate?: string;
  supervisorId?: string | null;
  baseSalary?: number;
}): Promise<ActionResult & { employeeCode?: string }> {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Nama lengkap wajib diisi." };
  if (input.joinDate && !ISO_DATE.test(input.joinDate)) {
    return { ok: false, error: "Tanggal bergabung tidak valid." };
  }
  const baseSalary = Math.max(0, Math.round(Number(input.baseSalary) || 0));

  const supabase = await createClient();

  const supervisorId =
    input.supervisorId && input.supervisorId.trim()
      ? input.supervisorId.trim()
      : null;
  if (supervisorId) {
    const { data: sup } = await supabase
      .from("employees")
      .select("id")
      .eq("id", supervisorId)
      .maybeSingle();
    if (!sup) return { ok: false, error: "Atasan tidak ditemukan." };
  }

  const year = new Date().getFullYear().toString();
  let employeeCode = await generateEmployeeCode(supabase, year);
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt++) {
    if (attempt > 0) {
      employeeCode = await generateEmployeeCode(supabase, year, attempt);
    }
    const { error } = await supabase.from("employees").insert({
      employee_code: employeeCode,
      full_name: fullName,
      position: input.position?.trim() || null,
      department: input.department?.trim() || null,
      join_date: input.joinDate || null,
      supervisor_id: supervisorId,
      base_salary: baseSalary,
    });
    if (!error) {
      saved = true;
    } else if ((error as { code?: string }).code !== "23505") {
      return { ok: false, error: "Gagal menyimpan karyawan. Silakan coba lagi." };
    }
    // 23505 = kode bentrok: coba nomor berikutnya.
  }
  if (!saved) {
    return { ok: false, error: "Gagal menyimpan karyawan. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  return { ok: true, employeeCode };
}

// ---------------------------------------------------------------------------
// Kehadiran
// ---------------------------------------------------------------------------

const VALID_ATTENDANCE = [
  "present",
  "late",
  "leave",
  "sick",
  "permit",
  "absent",
] as const;

function toTimeOrNull(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  const t = v.trim();
  // Terima "HH:MM" dari input time; simpan sebagai timestamp hari ini.
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) {
    const full = t.length === 5 ? `${t}:00` : t;
    return new Date(`1970-01-01T${full}`).toISOString();
  }
  return null;
}

export async function recordAttendance(input: {
  employeeId: string;
  date: string;
  status: string;
  clockIn?: string;
  clockOut?: string;
  notes?: string;
}): Promise<ActionResult> {
  if (!ISO_DATE.test(input.date)) {
    return { ok: false, error: "Tanggal tidak valid." };
  }
  if (!(VALID_ATTENDANCE as readonly string[]).includes(input.status)) {
    return { ok: false, error: "Status kehadiran tidak valid." };
  }

  const supabase = await createClient();
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", input.employeeId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Karyawan tidak ditemukan." };

  const payload = {
    employee_id: input.employeeId,
    attendance_date: input.date,
    clock_in_time: toTimeOrNull(input.clockIn),
    clock_out_time: toTimeOrNull(input.clockOut),
    status: input.status,
    notes: input.notes?.trim() || null,
  };

  // Satu baris per karyawan per hari: upsert bila sudah ada.
  const { error } = await supabase
    .from("attendance_records")
    .upsert(payload, { onConflict: "employee_id,attendance_date" });
  if (error) {
    return { ok: false, error: "Gagal menyimpan kehadiran. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pengajuan (cuti / ijin / sakit)
// ---------------------------------------------------------------------------

export async function createLeaveRequest(input: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<ActionResult> {
  if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(input.endDate)) {
    return { ok: false, error: "Rentang tanggal tidak valid." };
  }
  const days = inclusiveDays(input.startDate, input.endDate);
  if (days <= 0) {
    return {
      ok: false,
      error: "Tanggal selesai harus sama atau setelah tanggal mulai.",
    };
  }

  const supabase = await createClient();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name, supervisor_id, employment_status")
    .eq("id", input.employeeId)
    .maybeSingle();
  const employee = emp as EmployeeRef | null;
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  if (employee.employment_status !== "active") {
    return {
      ok: false,
      error: "Hanya karyawan aktif yang dapat mengajukan cuti/ijin/sakit.",
    };
  }

  const { data: lt } = await supabase
    .from("leave_types")
    .select("id, name, requires_document")
    .eq("id", input.leaveTypeId)
    .maybeSingle();
  if (!lt) return { ok: false, error: "Jenis pengajuan tidak ditemukan." };

  const { error } = await supabase.from("leave_requests").insert({
    employee_id: input.employeeId,
    leave_type_id: input.leaveTypeId,
    start_date: input.startDate,
    end_date: input.endDate,
    total_days: days,
    reason: input.reason?.trim() || null,
    // D9: approver default = atasan langsung karyawan.
    approver_id: employee.supervisor_id,
    status: "pending",
  });
  if (error) {
    return { ok: false, error: "Gagal menyimpan pengajuan. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  revalidatePath("/dashboard");
  return { ok: true };
}

type LeaveRequestDecisionRow = {
  id: string;
  status: string;
  employee_id: string;
  approver_id: string | null;
  employee: { supervisor_id: string | null } | Array<{ supervisor_id: string | null }> | null;
};

/**
 * Memutuskan pengajuan (setujui / tolak).
 * D9: hanya atasan langsung (approver/supervisor karyawan) atau HR/Admin
 * (takeover) yang boleh memutuskan. Bila yang memutuskan adalah HR/Admin
 * dan bukan atasan langsung, approver_id dicatat sebagai orang yang
 * memutuskan — inilah jejak "HR mengambil alih" di data.
 */
export async function decideLeaveRequest(input: {
  requestId: string;
  decision: "approved" | "rejected";
}): Promise<ActionResult> {
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, error: "Keputusan tidak valid." };
  }

  const supabase = await createClient();
  const current = await getCurrentUser();
  if (!current?.user) {
    return { ok: false, error: "Anda harus masuk untuk memutuskan pengajuan." };
  }

  const { data } = await supabase
    .from("leave_requests")
    .select(
      "id, status, employee_id, approver_id, employee:employees!inner(supervisor_id)"
    )
    .eq("id", input.requestId)
    .maybeSingle();
  const req = data as LeaveRequestDecisionRow | null;
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (req.status !== "pending") {
    return { ok: false, error: "Hanya pengajuan berstatus Menunggu yang dapat diputuskan." };
  }

  // Karyawan yang terhubung ke login saat ini (bila ada).
  const { data: me } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", current.user.id)
    .maybeSingle();
  const myEmployeeId = (me as { id: string } | null)?.id ?? null;

  const supervisorId = one(req.employee)?.supervisor_id ?? null;
  const isSupervisor =
    !!myEmployeeId &&
    (myEmployeeId === req.approver_id || myEmployeeId === supervisorId);

  const roleName = current.profile?.role_name ?? null;
  const isHrAdmin = roleName === "admin" || roleName === "hr";

  if (!isSupervisor && !isHrAdmin) {
    return {
      ok: false,
      error:
        "Hanya atasan langsung karyawan atau HR yang dapat memutuskan pengajuan ini.",
    };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: input.decision,
      decided_at: new Date().toISOString(),
      // Catat siapa yang memutuskan (jejak HR takeover).
      approver_id: myEmployeeId ?? req.approver_id,
    })
    .eq("id", input.requestId);
  if (error) {
    return { ok: false, error: "Gagal menyimpan keputusan. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export async function createPayrollPeriod(input: {
  name: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama periode wajib diisi." };
  if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(input.endDate)) {
    return { ok: false, error: "Rentang tanggal periode tidak valid." };
  }
  if (input.endDate < input.startDate) {
    return {
      ok: false,
      error: "Tanggal selesai harus sama atau setelah tanggal mulai.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_periods").insert({
    name,
    start_date: input.startDate,
    end_date: input.endDate,
    status: "draft",
  });
  if (error) {
    return { ok: false, error: "Gagal membuat periode. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  return { ok: true };
}

export type SlipInputRow = {
  employeeId: string;
  allowances: number;
  overtimePay: number;
  otherDeductions: number;
};

/**
 * Generate slip gaji untuk satu periode draf dari daftar karyawan aktif.
 * Perhitungan memakai computeSlip (BPJS, TER, akrual THR). Slip yang sudah
 * ada untuk karyawan tersebut dilewati (idempoten per karyawan).
 */
export async function generatePayrollSlips(input: {
  periodId: string;
  rows: SlipInputRow[];
}): Promise<ActionResult & { generated?: number }> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", input.periodId)
    .maybeSingle();
  const prow = period as { id: string; status: string } | null;
  if (!prow) return { ok: false, error: "Periode penggajian tidak ditemukan." };
  if (prow.status !== "draft") {
    return {
      ok: false,
      error: "Slip hanya dapat di-generate untuk periode berstatus Draf.",
    };
  }

  const employeeIds = [...new Set(input.rows.map((r) => r.employeeId))];
  if (employeeIds.length === 0) {
    return { ok: false, error: "Tidak ada karyawan untuk dihitung." };
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("id, base_salary, employment_status")
    .in("id", employeeIds);
  const byId = new Map(
    ((employees ?? []) as EmployeeRef[]).map((e) => [e.id, e])
  );

  // Lewati karyawan yang slipnya sudah ada di periode ini.
  const { data: existing } = await supabase
    .from("payroll_slips")
    .select("employee_id")
    .eq("payroll_period_id", input.periodId);
  const existingIds = new Set(
    ((existing ?? []) as Array<{ employee_id: string }>).map(
      (s) => s.employee_id
    )
  );

  const payload = [];
  for (const row of input.rows) {
    const emp = byId.get(row.employeeId);
    if (!emp || emp.employment_status !== "active") continue;
    if (existingIds.has(row.employeeId)) continue;
    const c = computeSlip({
      baseSalary: toNumber(emp.base_salary),
      allowances: row.allowances,
      overtimePay: row.overtimePay,
      otherDeductions: row.otherDeductions,
    });
    payload.push({
      payroll_period_id: input.periodId,
      employee_id: row.employeeId,
      ...c,
    });
  }

  if (payload.length === 0) {
    return {
      ok: false,
      error: "Tidak ada slip baru — semua karyawan sudah memiliki slip di periode ini.",
    };
  }

  const { error } = await supabase.from("payroll_slips").insert(payload);
  if (error) {
    return { ok: false, error: "Gagal menyimpan slip gaji. Silakan coba lagi." };
  }

  revalidatePath("/sdm");
  return { ok: true, generated: payload.length };
}

/** Finalisasi periode: mengunci slip agar tidak bisa di-generate ulang/diubah. */
export async function finalizePayrollPeriod(
  periodId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", periodId)
    .maybeSingle();
  const prow = period as { id: string; status: string } | null;
  if (!prow) return { ok: false, error: "Periode tidak ditemukan." };
  if (prow.status !== "draft") {
    return {
      ok: false,
      error: "Hanya periode berstatus Draf yang dapat difinalisasi.",
    };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", periodId);
  if (error) return { ok: false, error: "Gagal memfinalisasi periode." };

  revalidatePath("/sdm");
  return { ok: true };
}

/** Tandai periode final sebagai sudah dibayar. */
export async function markPayrollPaid(periodId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", periodId)
    .maybeSingle();
  const prow = period as { id: string; status: string } | null;
  if (!prow) return { ok: false, error: "Periode tidak ditemukan." };
  if (prow.status !== "finalized") {
    return {
      ok: false,
      error: "Hanya periode berstatus Final yang dapat ditandai dibayar.",
    };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "paid" })
    .eq("id", periodId);
  if (error) return { ok: false, error: "Gagal memperbarui status periode." };

  revalidatePath("/sdm");
  return { ok: true };
}
