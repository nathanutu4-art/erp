"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { recordAttendance } from "../actions";
import { formatTanggal } from "@/lib/format";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STYLE,
  type AttendanceStatus,
  type EmployeeRow,
} from "../_lib/hr";
import type { DailyAttendanceRow, RecapRow } from "../page";

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ATTENDANCE_STYLE[status]}`}
    >
      {ATTENDANCE_LABEL[status]}
    </span>
  );
}

function formatJam(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function CatatKehadiranModal({
  tanggal,
  employees,
  onClose,
}: {
  tanggal: string;
  employees: EmployeeRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!employeeId) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      const res = await recordAttendance({
        employeeId,
        date: tanggal,
        status,
        clockIn: clockIn || undefined,
        clockOut: clockOut || undefined,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <GlassModal open onClose={onClose} title={`Catat Kehadiran — ${formatTanggal(tanggal)}`}>
      <div className="space-y-4">
        <label className="block" htmlFor="h-karyawan">
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Karyawan *
          </span>
          <select
            id="h-karyawan"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm bg-transparent"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id} className="bg-slate-900">
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>
        </label>
        <label className="block" htmlFor="h-status">
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Status *
          </span>
          <select
            id="h-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm bg-transparent"
          >
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
              <option key={s} value={s} className="bg-slate-900">
                {ATTENDANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            id="h-in"
            label="Jam Masuk"
            type="time"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
          />
          <GlassInput
            id="h-out"
            label="Jam Pulang"
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
          />
        </div>
        <GlassInput
          id="h-notes"
          label="Catatan"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="cth. Dinas luar kota"
        />
        {error && (
          <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-300/30 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <GlassButton variant="ghost" onClick={onClose} disabled={pending}>
            Batal
          </GlassButton>
          <GlassButton onClick={submit} disabled={pending || !employeeId}>
            {pending ? "Menyimpan…" : "Simpan"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export function KehadiranClient({
  tanggal,
  periode,
  daily,
  recap,
  employees,
}: {
  tanggal: string;
  periode: string;
  daily: DailyAttendanceRow[];
  recap: RecapRow[];
  employees: EmployeeRow[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const withParams = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("tab", "kehadiran");
    params.set("tanggal", patch.tanggal ?? tanggal);
    params.set("periode", patch.periode ?? periode);
    router.replace(`/sdm?${params.toString()}`);
  };

  const hadirCount = daily.filter((d) =>
    d.record && (d.record.status === "present" || d.record.status === "late")
  ).length;

  return (
    <div className="space-y-8">
      {/* Kehadiran harian */}
      <section aria-label="Kehadiran harian">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-100">
            Harian — {formatTanggal(tanggal)}
          </h2>
          <div className="flex-1" />
          <input
            type="date"
            value={tanggal}
            max="2100-12-31"
            onChange={(e) => e.target.value && withParams({ tanggal: e.target.value })}
            aria-label="Pilih tanggal"
            className="glass-input min-h-[44px] px-4 rounded-xl text-sm"
          />
          <GlassButton onClick={() => setShowModal(true)}>
            + Catat Kehadiran
          </GlassButton>
        </div>

        <div className="glass rounded-2xl">
          <div className="tbl-wrap">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-slate-300/80 border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Karyawan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Masuk</th>
                  <th className="px-4 py-3 font-semibold">Pulang</th>
                  <th className="px-4 py-3 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {daily.map(({ employee, record }: DailyAttendanceRow) => (
                  <tr
                    key={employee.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-100">
                        {employee.full_name}
                      </span>
                      <div className="text-xs text-slate-400">
                        {employee.employee_code}
                        {employee.department ? ` • ${employee.department}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {record ? (
                        <StatusBadge status={record.status} />
                      ) : (
                        <span className="text-slate-400 text-xs">Belum dicatat</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {formatJam(record?.clock_in_time ?? null)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {formatJam(record?.clock_out_time ?? null)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {record?.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {daily.length === 0 && (
              <div className="px-4 py-10 text-center text-slate-300/80 text-sm">
                Belum ada karyawan aktif. Tambahkan karyawan terlebih dahulu.
              </div>
            )}
          </div>
        </div>
        {daily.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            {hadirCount} dari {daily.length} karyawan tercatat hadir/terlambat
            pada {formatTanggal(tanggal)}.
          </p>
        )}
      </section>

      {/* Rekap bulanan */}
      <section aria-label="Rekap bulanan">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-100">Rekap Bulanan</h2>
          <div className="flex-1" />
          <input
            type="month"
            value={periode}
            onChange={(e) => e.target.value && withParams({ periode: e.target.value })}
            aria-label="Pilih bulan"
            className="glass-input min-h-[44px] px-4 rounded-xl text-sm"
          />
        </div>

        <div className="glass rounded-2xl">
          <div className="tbl-wrap">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-slate-300/80 border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Karyawan</th>
                  {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
                    <th key={s} className="px-3 py-3 font-semibold text-center">
                      {ATTENDANCE_LABEL[s]}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {recap.map((r: RecapRow) => (
                  <tr
                    key={r.employee.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-100">
                        {r.employee.full_name}
                      </span>
                      <div className="text-xs text-slate-400">
                        {r.employee.employee_code}
                      </div>
                    </td>
                    {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
                      <td key={s} className="px-3 py-3 text-center text-slate-200">
                        {r.counts[s] || "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-semibold text-slate-100">
                      {r.total || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recap.length === 0 && (
              <div className="px-4 py-10 text-center text-slate-300/80 text-sm">
                Belum ada karyawan aktif.
              </div>
            )}
          </div>
        </div>
      </section>

      {showModal && (
        <CatatKehadiranModal
          tanggal={tanggal}
          employees={employees}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
