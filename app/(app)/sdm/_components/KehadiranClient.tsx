"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { recordAttendance } from "../actions";
import { formatTanggal } from "@/lib/format";
import {
  ATTENDANCE_LABEL,
  type AttendanceStatus,
  type EmployeeRow,
} from "../_lib/hr";
import type { DailyAttendanceRow, RecapRow } from "../page";

function attendanceBadgeClass(s: AttendanceStatus): string {
  switch (s) {
    case "present":
      return "b-green";
    case "late":
      return "b-amber";
    case "leave":
    case "permit":
      return "b-blue";
    case "sick":
      return "b-amber";
    case "absent":
      return "b-red";
    default:
      return "b-gray";
  }
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`badge ${attendanceBadgeClass(status)}`}>
      <i />
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
      <div>
        <div className="field">
          <label htmlFor="h-karyawan">Karyawan *</label>
          <select
            id="h-karyawan"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="h-status">Status *</label>
          <select
            id="h-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
          >
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
              <option key={s} value={s}>
                {ATTENDANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="h-in">Jam Masuk</label>
            <input
              id="h-in"
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="h-out">Jam Pulang</label>
            <input
              id="h-out"
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="h-catatan">Catatan</label>
          <input
            id="h-catatan"
            type="text"
            placeholder="cth. Terlambat karena hujan deras"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "var(--danger)",
              background: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              borderRadius: "9px",
              padding: "10px 14px",
              marginBottom: "14px",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "9px", marginTop: "18px" }}>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Menyimpan…" : "Simpan Kehadiran"}
          </button>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Kehadiran harian */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Kehadiran Harian</h3>
            <p>
              {formatTanggal(tanggal)} · {hadirCount} dari {daily.length} karyawan hadir
            </p>
          </div>
          <div className="spacer" />
          <input
            type="date"
            value={tanggal}
            max="2100-12-31"
            onChange={(e) => e.target.value && withParams({ tanggal: e.target.value })}
            aria-label="Pilih tanggal"
            className="select"
            style={{ height: "37px", padding: "0 10px" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Catat Kehadiran
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Status</th>
                <th>Jam Masuk</th>
                <th>Jam Pulang</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-note">
                      Belum ada karyawan aktif. Tambahkan karyawan terlebih dahulu.
                    </div>
                  </td>
                </tr>
              ) : (
                daily.map(({ employee, record }: DailyAttendanceRow) => (
                  <tr key={employee.id}>
                    <td>
                      <b style={{ display: "block" }}>{employee.full_name}</b>
                      <span className="mono small muted">
                        {employee.employee_code}
                        {employee.department ? ` · ${employee.department}` : ""}
                      </span>
                    </td>
                    <td>
                      {record ? (
                        <StatusBadge status={record.status} />
                      ) : (
                        <span className="badge b-gray">Belum dicatat</span>
                      )}
                    </td>
                    <td className="mono">{formatJam(record?.clock_in_time ?? null)}</td>
                    <td className="mono">{formatJam(record?.clock_out_time ?? null)}</td>
                    <td>{record?.notes ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rekap bulanan */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Rekap Bulanan Kehadiran</h3>
            <p>Agregat absensi karyawan per periode</p>
          </div>
          <div className="spacer" />
          <input
            type="month"
            value={periode}
            onChange={(e) => e.target.value && withParams({ periode: e.target.value })}
            aria-label="Pilih bulan"
            className="select"
            style={{ height: "37px", padding: "0 10px" }}
          />
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Karyawan</th>
                {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
                  <th key={s} className="num">
                    {ATTENDANCE_LABEL[s]}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {recap.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-note">Belum ada karyawan aktif.</div>
                  </td>
                </tr>
              ) : (
                recap.map((r: RecapRow) => (
                  <tr key={r.employee.id}>
                    <td>
                      <b style={{ display: "block" }}>{r.employee.full_name}</b>
                      <span className="mono small muted">{r.employee.employee_code}</span>
                    </td>
                    {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => (
                      <td key={s} className="num">
                        {r.counts[s] || "—"}
                      </td>
                    ))}
                    <td className="num" style={{ fontWeight: 700 }}>
                      {r.total || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
