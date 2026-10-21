"use client";

/**
 * ============================================================================
 * KOMPONEN DAFTAR KARYAWAN (EMPLOYEE DIRECTORY CLIENT)
 * ============================================================================
 * 
 * Antarmuka pengelolaan data induk karyawan:
 * 1. Tabel Karyawan: Menampilkan foto/avatar inisial, nama, NIK (EMP-YYYY-NNNN), jabatan, departemen, dan status.
 * 2. Pencarian & Filter: Penyaringan teks nama/jabatan dengan debounce dan filter departemen.
 * 3. Modal Tambah Karyawan: Form pendaftaran staf baru, tanggal mulai kerja, atasan langsung, dan gaji pokok.
 * ============================================================================
 */

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { createEmployee } from "../actions";
import { formatIDR, formatTanggal } from "@/lib/format";
import { EMPLOYMENT_LABEL, type EmployeeRow } from "../_lib/hr";

function getInitials(name: string): string {
  if (!name) return "K";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_BADGE: Record<string, string> = {
  active: "b-green",
  resigned: "b-gray",
  terminated: "b-red",
};

function TambahKaryawanModal({
  supervisors,
  onClose,
}: {
  supervisors: EmployeeRow[];
  onClose: () => void;
  }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const canSave = fullName.trim().length > 0 && !pending;

  const submit = () => {
    setError(null);
    setSavedCode(null);
    startTransition(async () => {
      const res = await createEmployee({
        fullName,
        position,
        department,
        joinDate: joinDate || undefined,
        supervisorId: supervisorId || null,
        baseSalary: Number(baseSalary) || 0,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedCode(res.employeeCode ?? null);
      router.refresh();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Tambah Karyawan" subtitle="Karyawan baru langsung tampil di daftar dan payroll">
      {savedCode ? (
        <div className="text-center py-4">
          <p className="pos font-semibold mb-2">
            Karyawan berhasil ditambahkan.
          </p>
          <p className="text-sm">
            Nomor karyawan:{" "}
            <span className="mono font-bold">{savedCode}</span>
          </p>
          <div className="modal-foot" style={{ marginTop: 20 }}>
            <GlassButton onClick={onClose}>Tutup</GlassButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <GlassInput
            id="k-nama"
            label="Nama Lengkap *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="cth. Andi Pratama"
          />
          <div className="field-row">
            <GlassInput
              id="k-jabatan"
              label="Jabatan"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="cth. Staf Gudang"
            />
            <GlassInput
              id="k-departemen"
              label="Departemen"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="cth. Logistik"
            />
          </div>
          <div className="field-row">
            <GlassInput
              id="k-gabung"
              type="date"
              label="Tanggal Masuk"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
            <GlassInput
              id="k-gaji"
              type="number"
              label="Gaji Pokok (Rp)"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label htmlFor="k-atasan">Atasan Langsung (Approval Cuti / Izin)</label>
            <select
              id="k-atasan"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              <option value="">— Tanpa Atasan (Langsung ke Direksi) —</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.position ?? "Staf"})
                </option>
              ))}
            </select>
          </div>

          {error && <div className="err-msg" style={{ display: "block" }}>{error}</div>}

          <div className="modal-foot">
            <GlassButton variant="ghost" onClick={onClose} disabled={pending}>
              Batal
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={submit}
              disabled={!canSave}
            >
              {pending ? "Menyimpan…" : "Simpan Karyawan"}
            </GlassButton>
          </div>
        </div>
      )}
    </GlassModal>
  );
}

export function KaryawanClient({
  employees,
  supervisors,
  initialQ = "",
}: {
  employees: EmployeeRow[];
  supervisors: EmployeeRow[];
  initialQ?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [showModal, setShowModal] = useState(false);

  // Sync search filter ke URL
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page");
      const url = params.toString() ? `/sdm?${params.toString()}` : "/sdm";
      router.replace(url);
    }, 250);
    return () => clearTimeout(t);
  }, [q, router]);

  return (
    <div>
      <DataTable
        title="Daftar Karyawan"
        subtitle={`Menampilkan ${employees.length} karyawan aktif`}
        searchPlaceholder="Cari nama, NIK, jabatan, departemen…"
        searchValue={q}
        onSearchChange={setQ}
        actions={
          <GlassButton onClick={() => setShowModal(true)} variant="primary">
            + Tambah Karyawan
          </GlassButton>
        }
      >
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>NIK</th>
              <th>Nama Lengkap</th>
              <th>Jabatan</th>
              <th>Departemen</th>
              <th>Atasan</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.employee_code}</td>
                <td>
                  <div className="flex items-center">
                    <span className="avatar-sm">{getInitials(e.full_name)}</span>
                    <div>
                      <Link
                        href={`/sdm/karyawan/${e.id}`}
                        style={{ fontWeight: 600, color: "var(--accent-strong)" }}
                      >
                        {e.full_name}
                      </Link>
                      <div className="muted small">
                        Gaji {formatIDR(e.base_salary)}
                        {e.join_date ? ` · Masuk ${formatTanggal(e.join_date)}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{e.position ?? "—"}</td>
                <td>{e.department ?? "—"}</td>
                <td>{e.supervisor_name ?? "—"}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[e.employment_status] ?? "b-green"}`}>
                    <i />
                    {EMPLOYMENT_LABEL[e.employment_status] ?? e.employment_status}
                  </span>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-note">
                    Tidak ada karyawan yang sesuai kriteria pencarian.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DataTable>

      {showModal && (
        <TambahKaryawanModal
          supervisors={supervisors}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
