import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  toNumber,
  ATTENDANCE_LABEL,
  ATTENDANCE_STYLE,
  EMPLOYMENT_LABEL,
  type AttendanceStatus,
  type EmployeeRow,
  type EmploymentStatus,
} from "../../_lib/hr";

type QuotaRow = {
  leaveTypeId: string;
  name: string;
  quota: number;
  used: number;
  remaining: number;
};

type AttendanceRow = {
  attendance_date: string;
  status: AttendanceStatus;
  clock_in_time: string | null;
  clock_out_time: string | null;
  notes: string | null;
};

async function getEmployee(id: string): Promise<EmployeeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, position, department, join_date, employment_status, supervisor_id, base_salary"
    )
    .eq("id", id)
    .maybeSingle();
  const e = data as {
    id: string;
    employee_code: string;
    full_name: string;
    position: string | null;
    department: string | null;
    join_date: string | null;
    employment_status: string;
    supervisor_id: string | null;
    base_salary: string | number | null;
  } | null;
  if (!e) return null;

  let supervisorName: string | null = null;
  if (e.supervisor_id) {
    const { data: sup } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", e.supervisor_id)
      .maybeSingle();
    supervisorName =
      (sup as { full_name: string } | null)?.full_name ?? null;
  }

  return {
    id: e.id,
    employee_code: e.employee_code,
    full_name: e.full_name,
    position: e.position,
    department: e.department,
    join_date: e.join_date,
    employment_status: e.employment_status as EmploymentStatus,
    supervisor_id: e.supervisor_id,
    supervisor_name: supervisorName,
    base_salary: toNumber(e.base_salary),
  };
}

async function getRecentAttendance(employeeId: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("attendance_date, status, clock_in_time, clock_out_time, notes")
    .eq("employee_id", employeeId)
    .order("attendance_date", { ascending: false })
    .limit(30);
  return ((data ?? []) as Array<{
    attendance_date: string;
    status: string;
    clock_in_time: string | null;
    clock_out_time: string | null;
    notes: string | null;
  }>).map((r) => ({
    attendance_date: r.attendance_date,
    status: r.status as AttendanceStatus,
    clock_in_time: r.clock_in_time,
    clock_out_time: r.clock_out_time,
    notes: r.notes,
  }));
}

async function getQuotaUsage(employeeId: string): Promise<QuotaRow[]> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { data: types } = await supabase
    .from("leave_types")
    .select("id, name, annual_quota_days, deducts_quota")
    .order("name");
  const { data: requests } = await supabase
    .from("leave_requests")
    .select("leave_type_id, total_days")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);

  const usedByType = new Map<string, number>();
  for (const r of ((requests ?? []) as Array<{
    leave_type_id: string;
    total_days: string | number | null;
  }>)) {
    usedByType.set(
      r.leave_type_id,
      (usedByType.get(r.leave_type_id) ?? 0) + toNumber(r.total_days)
    );
  }

  return ((types ?? []) as Array<{
    id: string;
    name: string;
    annual_quota_days: number;
    deducts_quota: boolean;
  }>)
    .filter((t) => t.deducts_quota)
    .map((t) => {
      const used = usedByType.get(t.id) ?? 0;
      return {
        leaveTypeId: t.id,
        name: t.name,
        quota: t.annual_quota_days,
        used: Math.round(used * 10) / 10,
        remaining: Math.max(0, t.annual_quota_days - used),
      };
    });
}

function formatJam(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default async function KaryawanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let employee: EmployeeRow | null = null;
  let attendance: AttendanceRow[] = [];
  let quotas: QuotaRow[] = [];
  try {
    employee = await getEmployee(id);
    if (employee) {
      [attendance, quotas] = await Promise.all([
        getRecentAttendance(id),
        getQuotaUsage(id),
      ]);
    }
  } catch {
    employee = null;
  }

  if (!employee) notFound();

  return (
    <div>
      <Link
        href="/sdm"
        className="inline-flex items-center min-h-[44px] text-sm text-teal-200 hover:text-teal-100 mb-4"
      >
        ← Kembali ke daftar karyawan
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profil */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-teal-400/25 border border-teal-300/40 flex items-center justify-center text-2xl font-extrabold text-teal-100">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-100">
                {employee.full_name}
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                {employee.employee_code}
              </p>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ["Jabatan", employee.position ?? "—"],
              ["Departemen", employee.department ?? "—"],
              ["Atasan Langsung", employee.supervisor_name ?? "—"],
              [
                "Tanggal Bergabung",
                employee.join_date ? formatTanggal(employee.join_date) : "—",
              ],
              ["Gaji Pokok", formatIDR(employee.base_salary)],
              [
                "Status",
                EMPLOYMENT_LABEL[employee.employment_status] ??
                  employee.employment_status,
              ],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-slate-400">{label as string}</dt>
                <dd className="text-slate-100 font-medium text-right">
                  {value as string}
                </dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        {/* Sisa cuti */}
        <GlassCard className="p-6">
          <h2 className="font-bold text-slate-100 mb-1">Sisa Kuota Cuti</h2>
          <p className="text-xs text-slate-400 mb-4">
            Tahun berjalan ({new Date().getFullYear()})
          </p>
          {quotas.length === 0 ? (
            <p className="text-sm text-slate-300/80">
              Tidak ada jenis cuti berkuota yang terdaftar.
            </p>
          ) : (
            <div className="space-y-4">
              {quotas.map((q) => {
                const pct =
                  q.quota > 0
                    ? Math.min(100, Math.round((q.used / q.quota) * 100))
                    : 0;
                return (
                  <div key={q.leaveTypeId}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-200 font-medium">{q.name}</span>
                      <span className="text-slate-300">
                        <span className="font-bold text-teal-200">
                          {q.remaining}
                        </span>{" "}
                        / {q.quota} hari
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-400/80 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Terpakai {q.used} hari
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Riwayat kehadiran */}
        <GlassCard className="p-6 lg:col-span-1">
          <h2 className="font-bold text-slate-100 mb-4">
            Riwayat Kehadiran Terakhir
          </h2>
          {attendance.length === 0 ? (
            <p className="text-sm text-slate-300/80">
              Belum ada catatan kehadiran untuk karyawan ini.
            </p>
          ) : (
            <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {attendance.map((a) => (
                <li
                  key={a.attendance_date}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="text-slate-200 font-medium">
                      {formatTanggal(a.attendance_date)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatJam(a.clock_in_time)} — {formatJam(a.clock_out_time)}
                      {a.notes ? ` • ${a.notes}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ATTENDANCE_STYLE[a.status]}`}
                  >
                    {ATTENDANCE_LABEL[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
