import { SdmTabs } from "./_components/SdmTabs";
import { KaryawanClient } from "./_components/KaryawanClient";
import { KehadiranClient } from "./_components/KehadiranClient";
import { PengajuanClient } from "./_components/PengajuanClient";
import { PayrollClient } from "./_components/PayrollClient";
import { createClient } from "@/lib/supabase/server";
import {
  toNumber,
  type EmployeeRow,
  type LeaveTypeRow,
  type LeaveRequestRow,
  type PayrollPeriodRow,
  type PayrollSlipRow,
  type AttendanceStatus,
  type EmploymentStatus,
  type LeaveRequestStatus,
  type PayrollPeriodStatus,
} from "./_lib/hr";

const TABS = ["karyawan", "kehadiran", "pengajuan", "payroll"] as const;
type TabKey = (typeof TABS)[number];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriode(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(periode: string): [string, string] {
  const [y, m] = periode.split("-").map(Number);
  const safeY = Number.isFinite(y) ? y : new Date().getFullYear();
  const safeM = m >= 1 && m <= 12 ? m : 1;
  const last = new Date(safeY, safeM, 0).getDate();
  const mm = String(safeM).padStart(2, "0");
  return [`${safeY}-${mm}-01`, `${safeY}-${mm}-${String(last).padStart(2, "0")}`];
}

function isPeriodeValid(p: string | undefined): p is string {
  return !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function isTanggalValid(t: string | undefined): t is string {
  return !!t && /^\d{4}-\d{2}-\d{2}$/.test(t);
}

type SearchParams = {
  tab?: string;
  q?: string;
  tanggal?: string;
  periode?: string;
  status?: string;
  periode_id?: string;
};

// ---------------------------------------------------------------------------
// Tipe baris mentah dari Supabase
// ---------------------------------------------------------------------------

type RawEmployee = {
  id: string;
  employee_code: string;
  full_name: string;
  position: string | null;
  department: string | null;
  join_date: string | null;
  employment_status: string;
  supervisor_id: string | null;
  base_salary: string | number | null;
};

type RawLeaveType = {
  id: string;
  code: string;
  name: string;
  annual_quota_days: number;
  deducts_quota: boolean;
  requires_document: boolean;
};

type RawLeaveRequest = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: string | number;
  reason: string | null;
  status: string;
  approver_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type RawAttendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  status: string;
  notes: string | null;
};

type RawPayrollPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type RawPayrollSlip = {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  base_salary: string | number | null;
  allowances: string | number | null;
  overtime_pay: string | number | null;
  thr_accrual: string | number | null;
  bpjs_health_employee: string | number | null;
  bpjs_health_employer: string | number | null;
  bpjs_employment_employee: string | number | null;
  bpjs_employment_employer: string | number | null;
  pph21_ter: string | number | null;
  other_deductions: string | number | null;
  gross_pay: string | number | null;
  net_pay: string | number | null;
};

// ---------------------------------------------------------------------------
// Pengambilan data
// ---------------------------------------------------------------------------

async function getEmployeeMap(): Promise<{
  byId: Map<string, RawEmployee>;
  list: RawEmployee[];
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, position, department, join_date, employment_status, supervisor_id, base_salary"
    )
    .order("full_name");
  const list = ((data ?? []) as RawEmployee[]);
  return { byId: new Map(list.map((e) => [e.id, e])), list };
}

async function getEmployees(q: string): Promise<EmployeeRow[]> {
  const { byId, list } = await getEmployeeMap();
  const needle = q.trim().toLowerCase();
  return list
    .filter((e) => {
      if (!needle) return true;
      return [e.full_name, e.employee_code, e.position ?? "", e.department ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .map((e) => ({
      id: e.id,
      employee_code: e.employee_code,
      full_name: e.full_name,
      position: e.position,
      department: e.department,
      join_date: e.join_date,
      employment_status: e.employment_status as EmploymentStatus,
      supervisor_id: e.supervisor_id,
      supervisor_name: e.supervisor_id
        ? (byId.get(e.supervisor_id)?.full_name ?? null)
        : null,
      base_salary: toNumber(e.base_salary),
    }));
}

async function getLeaveTypes(): Promise<LeaveTypeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_types")
    .select("id, code, name, annual_quota_days, deducts_quota, requires_document")
    .order("name");
  return ((data ?? []) as RawLeaveType[]);
}

async function getLeaveRequests(status: string): Promise<LeaveRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approver_id, decided_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as RawLeaveRequest[]).filter(
    (r) => !status || status === "semua" || r.status === status
  );

  const { byId: empById } = await getEmployeeMap();
  const types = new Map((await getLeaveTypes()).map((t) => [t.id, t.name]));

  return rows.map((r) => {
    const emp = empById.get(r.employee_id);
    const approver = r.approver_id ? empById.get(r.approver_id) : undefined;
    return {
      id: r.id,
      employee_id: r.employee_id,
      employee_name: emp?.full_name ?? "—",
      employee_code: emp?.employee_code ?? "—",
      leave_type_id: r.leave_type_id,
      leave_type_name: types.get(r.leave_type_id) ?? "—",
      start_date: r.start_date,
      end_date: r.end_date,
      total_days: toNumber(r.total_days),
      reason: r.reason,
      status: r.status as LeaveRequestStatus,
      approver_id: r.approver_id,
      approver_name: approver?.full_name ?? null,
      decided_at: r.decided_at,
      created_at: r.created_at,
    };
  });
}

export type DailyAttendanceRow = {
  employee: EmployeeRow;
  record: {
    status: AttendanceStatus;
    clock_in_time: string | null;
    clock_out_time: string | null;
    notes: string | null;
  } | null;
};

async function getDailyAttendance(tanggal: string): Promise<DailyAttendanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select(
      "employee_id, attendance_date, clock_in_time, clock_out_time, status, notes"
    )
    .eq("attendance_date", tanggal);
  const recByEmp = new Map(
    ((data ?? []) as RawAttendance[]).map((r) => [r.employee_id, r])
  );

  const employees = (await getEmployees("")).filter(
    (e) => e.employment_status === "active"
  );
  return employees.map((employee) => {
    const r = recByEmp.get(employee.id);
    return {
      employee,
      record: r
        ? {
            status: r.status as AttendanceStatus,
            clock_in_time: r.clock_in_time,
            clock_out_time: r.clock_out_time,
            notes: r.notes,
          }
        : null,
    };
  });
}

export type RecapRow = {
  employee: EmployeeRow;
  counts: Record<AttendanceStatus, number>;
  total: number;
};

const EMPTY_COUNTS: Record<AttendanceStatus, number> = {
  present: 0,
  late: 0,
  leave: 0,
  sick: 0,
  permit: 0,
  absent: 0,
};

async function getMonthlyRecap(periode: string): Promise<RecapRow[]> {
  const [start, end] = monthRange(periode);
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("employee_id, status")
    .gte("attendance_date", start)
    .lte("attendance_date", end);
  const rows = ((data ?? []) as Array<{ employee_id: string; status: string }>);

  const employees = (await getEmployees("")).filter(
    (e) => e.employment_status === "active"
  );
  const countsByEmp = new Map<string, Record<AttendanceStatus, number>>();
  for (const r of rows) {
    const c =
      countsByEmp.get(r.employee_id) ?? ({ ...EMPTY_COUNTS } as Record<
        AttendanceStatus,
        number
      >);
    const s = r.status as AttendanceStatus;
    if (s in c) c[s] += 1;
    countsByEmp.set(r.employee_id, c);
  }
  return employees.map((employee) => {
    const counts = countsByEmp.get(employee.id) ?? { ...EMPTY_COUNTS };
    return {
      employee,
      counts,
      total: (Object.values(counts) as number[]).reduce((a, b) => a + b, 0),
    };
  });
}

async function getPayrollPeriods(): Promise<PayrollPeriodRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_periods")
    .select("id, name, start_date, end_date, status")
    .order("start_date", { ascending: false });
  return ((data ?? []) as RawPayrollPeriod[]).map((p) => ({
    ...p,
    status: p.status as PayrollPeriodStatus,
  }));
}

async function getPayrollSlips(periodId: string): Promise<PayrollSlipRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_slips")
    .select(
      "id, payroll_period_id, employee_id, base_salary, allowances, overtime_pay, thr_accrual, bpjs_health_employee, bpjs_health_employer, bpjs_employment_employee, bpjs_employment_employer, pph21_ter, other_deductions, gross_pay, net_pay"
    )
    .eq("payroll_period_id", periodId);
  const rows = ((data ?? []) as RawPayrollSlip[]);
  const { byId } = await getEmployeeMap();
  return rows
    .map((s) => {
      const emp = byId.get(s.employee_id);
      return {
        id: s.id,
        payroll_period_id: s.payroll_period_id,
        employee_id: s.employee_id,
        employee_name: emp?.full_name ?? "—",
        employee_code: emp?.employee_code ?? "—",
        position: emp?.position ?? null,
        department: emp?.department ?? null,
        base_salary: toNumber(s.base_salary),
        allowances: toNumber(s.allowances),
        overtime_pay: toNumber(s.overtime_pay),
        thr_accrual: toNumber(s.thr_accrual),
        bpjs_health_employee: toNumber(s.bpjs_health_employee),
        bpjs_health_employer: toNumber(s.bpjs_health_employer),
        bpjs_employment_employee: toNumber(s.bpjs_employment_employee),
        bpjs_employment_employer: toNumber(s.bpjs_employment_employer),
        pph21_ter: toNumber(s.pph21_ter),
        other_deductions: toNumber(s.other_deductions),
        gross_pay: toNumber(s.gross_pay),
        net_pay: toNumber(s.net_pay),
      };
    })
    .sort((a, b) => (a.employee_name < b.employee_name ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

export default async function SdmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabKey)
    : "karyawan";

  return (
    <div>
      <SdmTabs active={tab} />

      <div>
        {tab === "karyawan" && <KaryawanTab q={params.q ?? ""} />}
        {tab === "kehadiran" && (
          <KehadiranTab
            tanggal={isTanggalValid(params.tanggal) ? params.tanggal! : todayISO()}
            periode={isPeriodeValid(params.periode) ? params.periode! : currentPeriode()}
          />
        )}
        {tab === "pengajuan" && (
          <PengajuanTab status={params.status ?? "semua"} />
        )}
        {tab === "payroll" && (
          <PayrollTab periodeId={params.periode_id ?? null} />
        )}
      </div>
    </div>
  );
}

async function KaryawanTab({ q }: { q: string }) {
  let employees: EmployeeRow[] = [];
  let activeEmployees: EmployeeRow[] = [];
  try {
    employees = await getEmployees(q);
    activeEmployees = (await getEmployees("")).filter(
      (e) => e.employment_status === "active"
    );
  } catch {
    employees = [];
    activeEmployees = [];
  }
  return (
    <KaryawanClient
      employees={employees}
      supervisors={activeEmployees}
      initialQ={q}
    />
  );
}

async function KehadiranTab({
  tanggal,
  periode,
}: {
  tanggal: string;
  periode: string;
}) {
  let daily: DailyAttendanceRow[] = [];
  let recap: RecapRow[] = [];
  let activeEmployees: EmployeeRow[] = [];
  try {
    [daily, recap] = await Promise.all([
      getDailyAttendance(tanggal),
      getMonthlyRecap(periode),
    ]);
    activeEmployees = daily.map((d) => d.employee);
  } catch {
    daily = [];
    recap = [];
    activeEmployees = [];
  }
  return (
    <KehadiranClient
      tanggal={tanggal}
      periode={periode}
      daily={daily}
      recap={recap}
      employees={activeEmployees}
    />
  );
}

async function PengajuanTab({ status }: { status: string }) {
  let requests: LeaveRequestRow[] = [];
  let leaveTypes: LeaveTypeRow[] = [];
  let activeEmployees: EmployeeRow[] = [];
  try {
    [requests, leaveTypes] = await Promise.all([
      getLeaveRequests(status),
      getLeaveTypes(),
    ]);
    activeEmployees = (await getEmployees("")).filter(
      (e) => e.employment_status === "active"
    );
  } catch {
    requests = [];
    leaveTypes = [];
    activeEmployees = [];
  }
  return (
    <PengajuanClient
      requests={requests}
      leaveTypes={leaveTypes}
      employees={activeEmployees}
      initialStatus={status}
    />
  );
}

async function PayrollTab({ periodeId }: { periodeId: string | null }) {
  let periods: PayrollPeriodRow[] = [];
  let slips: PayrollSlipRow[] = [];
  let activeEmployees: EmployeeRow[] = [];
  let selected: PayrollPeriodRow | null = null;
  try {
    periods = await getPayrollPeriods();
    selected =
      periods.find((p) => p.id === periodeId) ?? periods[0] ?? null;
    if (selected) {
      [slips, activeEmployees] = await Promise.all([
        getPayrollSlips(selected.id),
        getEmployees("").then((all) =>
          all.filter((e) => e.employment_status === "active")
        ),
      ]);
    }
  } catch {
    periods = [];
    slips = [];
    activeEmployees = [];
    selected = null;
  }
  return (
    <PayrollClient
      periods={periods}
      selectedPeriod={selected}
      slips={slips}
      employees={activeEmployees}
    />
  );
}
