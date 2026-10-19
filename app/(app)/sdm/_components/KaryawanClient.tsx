"use client";

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

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${tone}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  resigned: "bg-slate-400/20 text-slate-300 border-slate-300/40",
  terminated: "bg-rose-400/20 text-rose-200 border-rose-300/40",
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
    <GlassModal open onClose={onClose} title="Tambah Karyawan">
      {savedCode ? (
        <div className="text-center py-4">
          <p className="text-teal-200 font-semibold mb-2">
            Karyawan berhasil ditambahkan.
          </p>
          <p className="text-sm text-slate-300">
            Nomor karyawan:{" "}
            <span className="font-mono font-bold text-slate-100">{savedCode}</span>
          </p>
          <div className="mt-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              id="k-jabatan"
              label="Jabatan"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="cth. Staff Keuangan"
            />
            <GlassInput
              id="k-departemen"
              label="Departemen"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="cth. Keuangan"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              id="k-join"
              label="Tanggal Bergabung"
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
            <GlassInput
              id="k-gaji"
              label="Gaji Pokok (Rp)"
              type="number"
              min={0}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="cth. 6500000"
            />
          </div>
          <label className="block" htmlFor="k-atasan">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Atasan Langsung
            </span>
            <select
              id="k-atasan"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm bg-transparent"
            >
              <option value="" className="bg-slate-900">
                — Tanpa atasan —
              </option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">
                  {s.full_name} ({s.employee_code})
                </option>
              ))}
            </select>
          </label>
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
              {pending ? "Menyimpan…" : "Simpan"}
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
  initialQ,
}: {
  employees: EmployeeRow[];
  supervisors: EmployeeRow[];
  initialQ: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      router.replace(`/sdm${params.toString() ? `?${params}` : ""}`);
    }, 400);
    return () => clearTimeout(t);
  }, [q, router]);

  return (
    <div>
      <DataTable
        title="Daftar karyawan"
        searchPlaceholder="Cari nama, NIK, jabatan, departemen…"
        searchValue={q}
        onSearchChange={setQ}
        actions={
          <GlassButton onClick={() => setShowModal(true)}>
            + Tambah Karyawan
          </GlassButton>
        }
      >
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-slate-300/80 border-b border-white/10">
              <th className="px-4 py-3 font-semibold">NIK</th>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Jabatan</th>
              <th className="px-4 py-3 font-semibold">Departemen</th>
              <th className="px-4 py-3 font-semibold">Atasan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr
                key={e.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300">
                  {e.employee_code}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sdm/karyawan/${e.id}`}
                    className="font-semibold text-teal-200 hover:text-teal-100 hover:underline"
                  >
                    {e.full_name}
                  </Link>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Gaji pokok {formatIDR(e.base_salary)}
                    {e.join_date ? ` • Bergabung ${formatTanggal(e.join_date)}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-200">{e.position ?? "—"}</td>
                <td className="px-4 py-3 text-slate-200">{e.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate-200">
                  {e.supervisor_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[e.employment_status] ?? STATUS_TONE.active}>
                    {EMPLOYMENT_LABEL[e.employment_status] ?? e.employment_status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="px-4 py-10 text-center text-slate-300/80 text-sm">
            {initialQ
              ? "Tidak ada karyawan yang cocok dengan pencarian."
              : "Belum ada data karyawan. Klik “Tambah Karyawan” untuk mulai."}
          </div>
        )}
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
