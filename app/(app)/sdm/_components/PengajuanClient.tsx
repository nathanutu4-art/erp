"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { createLeaveRequest, decideLeaveRequest } from "../actions";
import { formatTanggal } from "@/lib/format";
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_STYLE,
  inclusiveDays,
  type EmployeeRow,
  type LeaveRequestRow,
  type LeaveRequestStatus,
  type LeaveTypeRow,
} from "../_lib/hr";

const STATUS_OPTIONS = [
  { key: "semua", label: "Semua" },
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

  const chosenType = leaveTypes.find((t) => t.id === leaveTypeId);
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
        reason,
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
    <GlassModal open onClose={onClose} title="Ajukan Cuti / Ijin / Sakit">
      <div className="space-y-4">
        <label className="block" htmlFor="p-karyawan">
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Karyawan *
          </span>
          <select
            id="p-karyawan"
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
        <label className="block" htmlFor="p-jenis">
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Jenis Pengajuan *
          </span>
          <select
            id="p-jenis"
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm bg-transparent"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900">
                {t.name}
                {t.deducts_quota ? ` (kuota ${t.annual_quota_days} hari/thn)` : ""}
              </option>
            ))}
          </select>
        </label>
        {chosenType?.requires_document && (
          <p className="text-xs text-amber-200 bg-amber-400/10 border border-amber-300/30 rounded-xl px-4 py-2.5">
            Jenis pengajuan ini mewajibkan surat keterangan (mis. surat sakit).
            Lampirkan dokumen fisik/digital ke HR setelah mengajukan.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            id="p-start"
            label="Tanggal Mulai *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <GlassInput
            id="p-end"
            label="Tanggal Selesai *"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <p className="text-sm text-slate-300">
          Total:{" "}
          <span className="font-bold text-slate-100">
            {days > 0 ? `${days} hari` : "—"}
          </span>
        </p>
        <GlassInput
          id="p-reason"
          label="Alasan"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="cth. Keperluan keluarga"
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
          <GlassButton onClick={submit} disabled={!canSave}>
            {pending ? "Menyimpan…" : "Ajukan"}
          </GlassButton>
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
    <div>
      <GlassCard className="px-4 py-3 mb-4 flex items-start gap-3">
        <span className="text-teal-300 text-lg leading-none mt-0.5">ⓘ</span>
        <p className="text-xs text-slate-300/90 leading-relaxed">
          <span className="font-semibold text-slate-100">Alur persetujuan:</span>{" "}
          pengajuan diteruskan ke atasan langsung karyawan. Bila atasan
          berhalangan, <span className="font-semibold text-slate-100">HR dapat mengambil alih</span>{" "}
          keputusan — nama pengambil alih tercatat pada pengajuan.
        </p>
      </GlassCard>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <nav aria-label="Filter status pengajuan" className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_OPTIONS.map((o) => {
            const isActive =
              (initialStatus === "semua" || !initialStatus) && o.key === "semua"
                ? true
                : initialStatus === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setStatus(o.key)}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 min-h-[44px] inline-flex items-center px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? "bg-teal-400/90 text-slate-950 border-teal-200/60"
                    : "glass text-slate-200 border-white/25 hover:bg-white/15"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
        <div className="flex-1" />
        <GlassButton onClick={() => setShowModal(true)}>
          + Ajukan
        </GlassButton>
      </div>

      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-300/30 rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}

      <div className="glass rounded-2xl">
        <div className="tbl-wrap">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-slate-300/80 border-b border-white/10">
                <th className="px-4 py-3 font-semibold">Karyawan</th>
                <th className="px-4 py-3 font-semibold">Jenis</th>
                <th className="px-4 py-3 font-semibold">Periode</th>
                <th className="px-4 py-3 font-semibold">Alasan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Diputuskan</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r: LeaveRequestRow) => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-100">
                      {r.employee_name}
                    </span>
                    <div className="text-xs text-slate-400">{r.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{r.leave_type_name}</td>
                  <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                    {formatTanggal(r.start_date)} — {formatTanggal(r.end_date)}
                    <div className="text-xs text-slate-400">
                      {r.total_days} hari
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs max-w-[220px]">
                    {r.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${LEAVE_STATUS_STYLE[r.status as LeaveRequestStatus]}`}
                    >
                      {LEAVE_STATUS_LABEL[r.status as LeaveRequestStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {r.approver_name ? (
                      <>
                        <span className="text-slate-200 font-medium">
                          {r.approver_name}
                        </span>
                        {r.decided_at && (
                          <div className="text-slate-400">
                            {formatTanggal(r.decided_at)}
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => decide(r.id, "approved")}
                          disabled={deciding}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-bold bg-teal-400/85 text-slate-950 hover:bg-teal-300 border border-teal-200/60 disabled:opacity-50 transition-all"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => decide(r.id, "rejected")}
                          disabled={deciding}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-bold bg-rose-500/85 text-white hover:bg-rose-400 border border-rose-300/50 disabled:opacity-50 transition-all"
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-300/80 text-sm">
              {pendingCount === 0 && initialStatus !== "semua"
                ? "Tidak ada pengajuan pada filter ini."
                : "Belum ada pengajuan. Klik “Ajukan” untuk membuat pengajuan baru."}
            </div>
          )}
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
