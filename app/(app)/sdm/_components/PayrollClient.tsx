"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import {
  createPayrollPeriod,
  generatePayrollSlips,
  finalizePayrollPeriod,
  markPayrollPaid,
  type SlipInputRow,
} from "../actions";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  computeSlip,
  PAYROLL_STATUS_LABEL,
  PAYROLL_STATUS_STYLE,
  type EmployeeRow,
  type PayrollPeriodRow,
  type PayrollPeriodStatus,
  type PayrollSlipRow,
} from "../_lib/hr";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Modal buat periode
// ---------------------------------------------------------------------------

function BuatPeriodeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayISO().slice(0, 7) + "-01");
  const [endDate, setEndDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createPayrollPeriod({ name, startDate, endDate });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Buat Periode Penggajian">
      <div className="space-y-4">
        <GlassInput
          id="pp-nama"
          label="Nama Periode *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="cth. Gaji Oktober 2026"
        />
        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            id="pp-start"
            label="Tanggal Mulai *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <GlassInput
            id="pp-end"
            label="Tanggal Selesai *"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-300/30 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <GlassButton variant="ghost" onClick={onClose} disabled={pending}>
            Batal
          </GlassButton>
          <GlassButton onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Menyimpan…" : "Buat Periode"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal slip gaji (siap cetak)
// ---------------------------------------------------------------------------

function SlipModal({
  slip,
  periodName,
  onClose,
}: {
  slip: PayrollSlipRow;
  periodName: string;
  onClose: () => void;
}) {
  const rows: Array<[string, number, boolean?]> = [
    ["Gaji Pokok", slip.base_salary],
    ["Tunjangan", slip.allowances],
    ["Lembur", slip.overtime_pay],
    ["Akrual THR (1/12 gaji pokok)", slip.thr_accrual],
    ["BPJS Kesehatan (karyawan 1%)", -slip.bpjs_health_employee],
    ["BPJS Ketenagakerjaan (karyawan 3%)", -slip.bpjs_employment_employee],
    ["PPh 21 (TER)", -slip.pph21_ter],
    ["Potongan Lainnya", -slip.other_deductions],
  ];
  return (
    <GlassModal open onClose={onClose} title={`Slip Gaji — ${periodName}`}>
      <div className="space-y-1 text-sm">
        <div className="pb-3 mb-3 border-b border-white/10">
          <p className="font-bold text-slate-100 text-base">{slip.employee_name}</p>
          <p className="text-xs text-slate-400">
            {slip.employee_code}
            {slip.position ? ` • ${slip.position}` : ""}
            {slip.department ? ` • ${slip.department}` : ""}
          </p>
        </div>
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between py-1.5">
            <span className="text-slate-300">{label}</span>
            <span
              className={`font-mono font-semibold ${amount < 0 ? "text-rose-300" : "text-slate-100"}`}
            >
              {amount < 0 ? `− ${formatIDR(-amount)}` : formatIDR(amount)}
            </span>
          </div>
        ))}
        <div className="flex justify-between py-2 border-t border-white/10 mt-2">
          <span className="text-slate-200 font-semibold">Penghasilan Bruto</span>
          <span className="font-mono font-bold text-slate-100">
            {formatIDR(slip.gross_pay)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-white/10">
          <span className="text-slate-200 font-semibold">Gaji Bersih (Take-Home)</span>
          <span className="font-mono font-bold text-teal-200 text-base">
            {formatIDR(slip.net_pay)}
          </span>
        </div>
        <p className="text-xs text-slate-400 pt-3 leading-relaxed">
          Iuran perusahaan (tidak memotong gaji): BPJS Kesehatan{" "}
          {formatIDR(slip.bpjs_health_employer)} + BPJS Ketenagakerjaan{" "}
          {formatIDR(slip.bpjs_employment_employer)}.
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <GlassButton variant="ghost" onClick={onClose}>
            Tutup
          </GlassButton>
          <GlassButton onClick={() => window.print()}>Cetak</GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Form generate slip (periode draf, karyawan yang belum punya slip)
// ---------------------------------------------------------------------------

type GenRow = { allowances: string; overtime: string; deductions: string };

function GenerateSlipsForm({
  periodId,
  employees,
}: {
  periodId: string;
  employees: EmployeeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inputs, setInputs] = useState<Record<string, GenRow>>({});
  const [error, setError] = useState<string | null>(null);

  const get = (id: string): GenRow =>
    inputs[id] ?? { allowances: "", overtime: "", deductions: "" };
  const set = (id: string, patch: Partial<GenRow>) =>
    setInputs((prev) => ({ ...prev, [id]: { ...get(id), ...patch } }));

  const preview = useMemo(
    () =>
      employees.map((e) => {
        const g = get(e.id);
        const c = computeSlip({
          baseSalary: e.base_salary,
          allowances: Number(g.allowances) || 0,
          overtimePay: Number(g.overtime) || 0,
          otherDeductions: Number(g.deductions) || 0,
        });
        return { employee: e, calc: c };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, inputs]
  );

  const totalNet = preview.reduce((s, p) => s + p.calc.net_pay, 0);

  const submit = () => {
    setError(null);
    const rows: SlipInputRow[] = employees.map((e) => {
      const g = get(e.id);
      return {
        employeeId: e.id,
        allowances: Number(g.allowances) || 0,
        overtimePay: Number(g.overtime) || 0,
        otherDeductions: Number(g.deductions) || 0,
      };
    });
    startTransition(async () => {
      const res = await generatePayrollSlips({ periodId, rows });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  if (employees.length === 0) {
    return (
      <p className="text-sm text-slate-300/80 px-1 py-4">
        Semua karyawan aktif sudah memiliki slip pada periode ini, atau belum ada
        karyawan aktif.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-300/90 mb-4">
        Isi tunjangan, lembur, dan potongan lainnya per karyawan, lalu generate
        slip. BPJS, PPh 21 TER, dan akrual THR dihitung otomatis dari gaji pokok.
      </p>
      <div className="glass rounded-2xl mb-4">
        <div className="tbl-wrap">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-slate-300/80 border-b border-white/10">
                <th className="px-4 py-3 font-semibold">Karyawan</th>
                <th className="px-4 py-3 font-semibold">Tunjangan (Rp)</th>
                <th className="px-4 py-3 font-semibold">Lembur (Rp)</th>
                <th className="px-4 py-3 font-semibold">Pot. Lain (Rp)</th>
                <th className="px-4 py-3 font-semibold text-right">Pratinjau Bersih</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(({ employee: e, calc }) => (
                <tr
                  key={e.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-100">{e.full_name}</span>
                    <div className="text-xs text-slate-400">
                      Pokok {formatIDR(e.base_salary)}
                    </div>
                  </td>
                  {(["allowances", "overtime", "deductions"] as const).map((k) => (
                    <td key={k} className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={get(e.id)[k]}
                        onChange={(ev) => set(e.id, { [k]: ev.target.value })}
                        placeholder="0"
                        aria-label={`${k} untuk ${e.full_name}`}
                        className="glass-input w-full min-h-[44px] px-3 rounded-xl text-sm font-mono"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono font-bold text-teal-200">
                    {formatIDR(calc.net_pay)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-300/30 rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-slate-300">
          Total gaji bersih:{" "}
          <span className="font-bold text-slate-100 font-mono">
            {formatIDR(totalNet)}
          </span>
        </p>
        <div className="flex-1" />
        <GlassButton onClick={submit} disabled={pending}>
          {pending ? "Menghitung…" : `Generate ${preview.length} Slip`}
        </GlassButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Halaman utama tab payroll
// ---------------------------------------------------------------------------

export function PayrollClient({
  periods,
  selectedPeriod,
  slips,
  employees,
}: {
  periods: PayrollPeriodRow[];
  selectedPeriod: PayrollPeriodRow | null;
  slips: PayrollSlipRow[];
  employees: EmployeeRow[];
}) {
  const router = useRouter();
  const [working, startWorking] = useTransition();
  const [showBuat, setShowBuat] = useState(false);
  const [slipModal, setSlipModal] = useState<PayrollSlipRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectPeriod = (id: string) => {
    const params = new URLSearchParams();
    params.set("tab", "payroll");
    params.set("periode_id", id);
    router.replace(`/sdm?${params.toString()}`);
  };

  const runAction = async (
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
    confirmMsg: string
  ) => {
    if (!selectedPeriod || !window.confirm(confirmMsg)) return;
    setError(null);
    startWorking(async () => {
      const res = await fn(selectedPeriod.id);
      if (!res.ok) {
        setError(res.error ?? "Gagal memproses periode.");
        return;
      }
      router.refresh();
    });
  };

  const slippedIds = new Set(slips.map((s) => s.employee_id));
  const withoutSlips = employees.filter((e) => !slippedIds.has(e.id));

  const totals = useMemo(() => {
    const t = {
      gross: 0,
      net: 0,
      pph21: 0,
      bpjsKesEmp: 0,
      bpjsKerEmp: 0,
      bpjsEmployer: 0,
      thr: 0,
    };
    for (const s of slips) {
      t.gross += s.gross_pay;
      t.net += s.net_pay;
      t.pph21 += s.pph21_ter;
      t.bpjsKesEmp += s.bpjs_health_employee;
      t.bpjsKerEmp += s.bpjs_employment_employee;
      t.bpjsEmployer += s.bpjs_health_employer + s.bpjs_employment_employer;
      t.thr += s.thr_accrual;
    }
    return t;
  }, [slips]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <nav aria-label="Pilih periode" className="flex gap-2 overflow-x-auto pb-1">
          {periods.map((p) => {
            const isActive = selectedPeriod?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectPeriod(p.id)}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 min-h-[44px] inline-flex items-center px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? "bg-teal-400/90 text-slate-950 border-teal-200/60"
                    : "glass text-slate-200 border-white/25 hover:bg-white/15"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </nav>
        <div className="flex-1" />
        <GlassButton onClick={() => setShowBuat(true)}>
          + Buat Periode
        </GlassButton>
      </div>

      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-300/30 rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}

      {!selectedPeriod && (
        <GlassCard className="p-10 text-center text-slate-300/80 text-sm">
          Belum ada periode penggajian. Klik “Buat Periode” untuk memulai.
        </GlassCard>
      )}

      {selectedPeriod && (
        <div>
          <GlassCard className="p-5 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {selectedPeriod.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatTanggal(selectedPeriod.start_date)} —{" "}
                {formatTanggal(selectedPeriod.end_date)}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border self-start sm:self-center ${PAYROLL_STATUS_STYLE[selectedPeriod.status as PayrollPeriodStatus]}`}
            >
              {PAYROLL_STATUS_LABEL[selectedPeriod.status as PayrollPeriodStatus]}
            </span>
            <div className="flex-1" />
            {selectedPeriod.status === "draft" && (
              <GlassButton
                variant="ghost"
                disabled={working || slips.length === 0}
                onClick={() =>
                  runAction(
                    finalizePayrollPeriod,
                    "Finalisasi periode? Slip tidak dapat diubah setelah final."
                  )
                }
              >
                {working ? "Memproses…" : "Finalisasi Periode"}
              </GlassButton>
            )}
            {selectedPeriod.status === "finalized" && (
              <GlassButton
                disabled={working}
                onClick={() =>
                  runAction(markPayrollPaid, "Tandai periode ini sudah dibayar?")
                }
              >
                {working ? "Memproses…" : "Tandai Dibayar"}
              </GlassButton>
            )}
          </GlassCard>

          {selectedPeriod.status === "draft" && withoutSlips.length > 0 && (
            <GlassCard className="p-5 mb-4">
              <h3 className="font-bold text-slate-100 mb-3">Generate Slip Gaji</h3>
              <GenerateSlipsForm periodId={selectedPeriod.id} employees={withoutSlips} />
            </GlassCard>
          )}

          {slips.length > 0 && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  ["Total Bruto", totals.gross],
                  ["Total Bersih", totals.net],
                  ["Total PPh 21", totals.pph21],
                  ["Total BPJS Perusahaan", totals.bpjsEmployer],
                ].map(([label, val]) => (
                  <GlassCard key={label as string} className="p-4">
                    <p className="text-xs text-slate-400">{label as string}</p>
                    <p className="font-mono font-bold text-slate-100 mt-1">
                      {formatIDR(val as number)}
                    </p>
                  </GlassCard>
                ))}
              </div>

              <div className="glass rounded-2xl">
                <div className="tbl-wrap">
                  <table className="w-full text-sm min-w-[880px]">
                    <thead>
                      <tr className="text-left text-slate-300/80 border-b border-white/10">
                        <th className="px-4 py-3 font-semibold">Karyawan</th>
                        <th className="px-4 py-3 font-semibold text-right">Gaji Pokok</th>
                        <th className="px-4 py-3 font-semibold text-right">Tunjangan</th>
                        <th className="px-4 py-3 font-semibold text-right">BPJS Kry.</th>
                        <th className="px-4 py-3 font-semibold text-right">PPh 21</th>
                        <th className="px-4 py-3 font-semibold text-right">THR Akrual</th>
                        <th className="px-4 py-3 font-semibold text-right">Bersih</th>
                        <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slips.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-100">
                              {s.employee_name}
                            </span>
                            <div className="text-xs text-slate-400">
                              {s.employee_code}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatIDR(s.base_salary)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatIDR(s.allowances + s.overtime_pay)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatIDR(
                              s.bpjs_health_employee + s.bpjs_employment_employee
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatIDR(s.pph21_ter)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200">
                            {formatIDR(s.thr_accrual)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-teal-200">
                            {formatIDR(s.net_pay)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSlipModal(s)}
                              className="min-h-[44px] px-3 rounded-xl text-xs font-bold glass text-slate-100 hover:bg-white/15 border border-white/25 transition-all"
                            >
                              Lihat Slip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {slips.length === 0 && selectedPeriod.status !== "draft" && (
            <GlassCard className="p-10 text-center text-slate-300/80 text-sm">
              Periode ini belum memiliki slip gaji.
            </GlassCard>
          )}
        </div>
      )}

      {showBuat && <BuatPeriodeModal onClose={() => setShowBuat(false)} />}
      {slipModal && selectedPeriod && (
        <SlipModal
          slip={slipModal}
          periodName={selectedPeriod.name}
          onClose={() => setSlipModal(null)}
        />
      )}
    </div>
  );
}
