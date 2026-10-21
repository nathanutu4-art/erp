"use client";

/**
 * ============================================================================
 * KOMPONEN PENGAJUAN CUTI & IZIN (LEAVE REQUESTS CLIENT)
 * ============================================================================
 * 
 * Pengelolaan alur perizinan dan cuti karyawan:
 * 1. Banner Alur Approval: Panduan alur persetujuan atasan langsung & wewenang takeover oleh HR.
 * 2. Tabel Pengajuan: Menampilkan nama pemohon, jenis (Cuti Tahunan, Izin, Sakit), rentang tanggal, durasi hari, dan status.
 * 3. Aksi Cepat: Tombol persetujuan (Setujui / Tolak) yang langsung memutasi status pengajuan dan memotong kuota cuti.
 * 4. Modal Ajukan: Form permohonan baru dengan kalkulasi otomatis jumlah hari kerja inklusif.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { createLeaveRequest, decideLeaveRequest } from "../actions";
import { formatTanggal } from "@/lib/format";
import {
  LEAVE_STATUS_LABEL,
  inclusiveDays,
  type EmployeeRow,
  type LeaveRequestRow,
  type LeaveRequestStatus,
  type LeaveTypeRow,
} from "../_lib/hr";

const STATUS_OPTIONS = [
  { key: "semua", label: "Semua Status" },
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
  { key: "cancelled", label: "Dibatalkan" },
] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function AjukanModal({
  employees,
  leaveTypes,
  onClose,
}: {
  employees: EmployeeRow[];
  leaveTypes: LeaveTypeRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const days = inclusiveDays(startDate, endDate);
  const canSave =
    !!employeeId && !!leaveTypeId && days > 0 && !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createLeaveRequest({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Ajukan Cuti / Izin / Sakit">
      <div>
        <div className="field">
          <label htmlFor="p-karyawan">Karyawan *</label>
          <select
            id="p-karyawan"
            aria-label="Karyawan"
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
          <label htmlFor="p-jenis">Jenis Pengajuan *</label>
          <select
            id="p-jenis"
            aria-label="Jenis pengajuan"
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (kuota {t.annual_quota_days} hari)
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="p-mulai">Tanggal Mulai *</label>
            <input
              id="p-mulai"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="p-selesai">Tanggal Selesai *</label>
            <input
              id="p-selesai"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="p-alasan">Alasan Pengajuan</label>
          <input
            id="p-alasan"
            type="text"
            placeholder="mis. Acara keluarga / sakit flu"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            disabled={!canSave}
          >
            {pending ? "Mengirim…" : `Kirim Pengajuan (${days} hari)`}
          </button>
        </div>
      </div>
    </GlassModal>
  );
}

export function PengajuanClient({
  requests,
  leaveTypes,
  employees,
  initialStatus,
}: {
  requests: LeaveRequestRow[];
  leaveTypes: LeaveTypeRow[];
  employees: EmployeeRow[];
  initialStatus: string;
}) {
  const router = useRouter();
  const [deciding, startDeciding] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStatus = (s: string) => {
    const params = new URLSearchParams();
    params.set("tab", "pengajuan");
    if (s && s !== "semua") params.set("status", s);
    router.replace(`/sdm?${params.toString()}`);
  };

  const decide = (id: string, decision: "approved" | "rejected") => {
    setError(null);
    startDeciding(async () => {
      const res = await decideLeaveRequest({ requestId: id, decision });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="fin-view on">
      <div className="flow-note">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M12 11v5" />
        </svg>
        <div>
          <b>Alur persetujuan:</b> pengajuan cuti, izin, dan sakit disetujui oleh{" "}
          <b>atasan langsung</b> karyawan. Apabila atasan berhalangan,{" "}
          <b>HR dapat melakukan takeover</b> dan memproses pengajuan atas nama atasan.
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Pengajuan Cuti, Izin &amp; Sakit</h3>
            <p>
              {pendingCount} pengajuan menunggu keputusan · Menampilkan {requests.length} pengajuan
            </p>
          </div>
          <div className="spacer" />
          <select
            className="select"
            value={initialStatus || "semua"}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter status pengajuan"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
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
            Ajukan Cuti / Izin
          </button>
        </div>

        {error && (
          <div style={{ padding: "14px 22px 0" }}>
            <p
              role="alert"
              style={{
                fontSize: "13px",
                color: "var(--danger)",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger)",
                borderRadius: "9px",
                padding: "10px 14px",
              }}
            >
              {error}
            </p>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Jenis</th>
                <th>Periode</th>
                <th className="num" style={{ width: "80px" }}>Hari</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Diputuskan Oleh</th>
                <th style={{ width: "160px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-note">
                      Tidak ada pengajuan pada filter status ini.
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((r: LeaveRequestRow) => (
                  <tr key={r.id}>
                    <td>
                      <b style={{ display: "block" }}>{r.employee_name}</b>
                      <span className="mono small muted">{r.employee_code}</span>
                    </td>
                    <td>{r.leave_type_name}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatTanggal(r.start_date)} — {formatTanggal(r.end_date)}
                    </td>
                    <td className="num">{r.total_days}</td>
                    <td>{r.reason ?? "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === "approved"
                            ? "b-green"
                            : r.status === "rejected" || r.status === "cancelled"
                            ? "b-red"
                            : "b-amber"
                        }`}
                      >
                        <i />
                        {LEAVE_STATUS_LABEL[r.status as LeaveRequestStatus]}
                      </span>
                    </td>
                    <td className="small">
                      {r.approver_name ? (
                        <>
                          <b>{r.approver_name}</b>
                          {r.decided_at && (
                            <span className="muted" style={{ display: "block" }}>
                              {formatTanggal(r.decided_at)}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.status === "pending" ? (
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => decide(r.id, "approved")}
                            disabled={deciding}
                            className="btn btn-sm btn-primary"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(r.id, "rejected")}
                            disabled={deciding}
                            className="btn btn-sm btn-danger-ghost"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AjukanModal
          employees={employees}
          leaveTypes={leaveTypes}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
