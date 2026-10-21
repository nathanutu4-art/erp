"use client";

/**
 * ============================================================================
 * KOMPONEN PAYROLL & PENGGAJIAN (PAYROLL CLIENT)
 * ============================================================================
 * 
 * Pengelolaan siklus penggajian bulanan perusahaan:
 * 1. Kartu Statistik Periode: Total Gaji Bruto, Gaji Bersih (Take Home Pay), Potongan PPh 21 TER, dan Beban BPJS Perusahaan.
 * 2. Tabel Slip Gaji: Rincian per karyawan (gaji pokok, tunjangan, potongan BPJS Kesehatan 1%, JHT 2%, JP 1%, PPh 21, dan total bersih).
 * 3. Modal Pratinjau Dokumen Cetak: Menampilkan slip gaji berformat kertas resmi lengkap dengan kop surat perusahaan.
 * 4. Workflow Periode: Pembentukan periode draf, finalisasi, pembayaran lunas, dan pembukuan beban ke akuntansi.
 * ============================================================================
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      <div>
        <div className="field">
          <label htmlFor="pp-nama">Nama Periode *</label>
          <input
            id="pp-nama"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth. Gaji Oktober 2026"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="pp-start">Tanggal Mulai *</label>
            <input
              id="pp-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pp-end">Tanggal Selesai *</label>
            <input
              id="pp-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
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
            disabled={pending || !name.trim()}
          >
            {pending ? "Menyimpan…" : "Buat Periode"}
          </button>
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
      <div>
        <div style={{ paddingBottom: "12px", marginBottom: "12px", borderBottom: "1px solid var(--line)" }}>
          <b style={{ display: "block", fontSize: "16px" }}>{slip.employee_name}</b>
          <span className="mono small muted">
            {slip.employee_code}
            {slip.position ? ` · ${slip.position}` : ""}
            {slip.department ? ` · ${slip.department}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {rows.map(([label, amount]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "13.5px" }}>
              <span className="muted">{label}</span>
              <span className={`mono ${amount < 0 ? "neg" : ""}`} style={{ fontWeight: 600 }}>
                {amount < 0 ? `− ${formatIDR(-amount)}` : formatIDR(amount)}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "10px",
              marginTop: "4px",
              borderTop: "1px solid var(--line)",
              fontWeight: 700,
            }}
          >
            <span>Penghasilan Bruto</span>
            <span className="mono">{formatIDR(slip.gross_pay)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "6px",
              paddingBottom: "10px",
              borderBottom: "1px solid var(--line)",
              fontWeight: 800,
              fontSize: "15px",
            }}
          >
            <span>Gaji Bersih (Take-Home)</span>
            <span className="mono pos">{formatIDR(slip.net_pay)}</span>
          </div>
        </div>
        <p className="fin-note" style={{ marginTop: "10px" }}>
          Iuran perusahaan (tidak memotong gaji): BPJS Kesehatan {formatIDR(slip.bpjs_health_employer)} + BPJS Ketenagakerjaan {formatIDR(slip.bpjs_employment_employer)}.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "9px", marginTop: "18px" }}>
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Cetak
          </button>
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
        return { employee: e, slip: c };
      }),
    [employees, inputs]
  );

  const totalNet = preview.reduce((s, p) => s + p.slip.net_pay, 0);

  const submit = () => {
    setError(null);
    const slips: SlipInputRow[] = preview.map((p) => {
      const g = get(p.employee.id);
      return {
        employeeId: p.employee.id,
        baseSalary: p.employee.base_salary,
        allowances: Number(g.allowances) || 0,
        overtimePay: Number(g.overtime) || 0,
        otherDeductions: Number(g.deductions) || 0,
        notes: `Gaji ${p.employee.position ?? "Staf"}`,
      };
    });

    startTransition(async () => {
      const res = await generatePayrollSlips({ periodId, rows: slips });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div>
      <div className="tbl-wrap" style={{ marginBottom: "14px" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th className="num">Gaji Pokok</th>
              <th style={{ width: "130px" }}>Tunjangan</th>
              <th style={{ width: "130px" }}>Lembur</th>
              <th style={{ width: "130px" }}>Potongan Lain</th>
              <th className="num">PPh 21 (TER)</th>
              <th className="num">Gaji Bersih</th>
            </tr>
          </thead>
          <tbody>
            {preview.map(({ employee: e, slip }) => (
              <tr key={e.id}>
                <td>
                  <b>{e.full_name}</b>
                  <span className="mono small muted" style={{ display: "block" }}>
                    {e.employee_code} · {e.position ?? "Staf"}
                  </span>
                </td>
                <td className="num">{formatIDR(e.base_salary)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={get(e.id).allowances}
                    onChange={(ev) => set(e.id, { allowances: ev.target.value })}
                    className="select"
                    style={{ height: "34px", width: "100%", padding: "0 8px" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={get(e.id).overtime}
                    onChange={(ev) => set(e.id, { overtime: ev.target.value })}
                    className="select"
                    style={{ height: "34px", width: "100%", padding: "0 8px" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={get(e.id).deductions}
                    onChange={(ev) => set(e.id, { deductions: ev.target.value })}
                    className="select"
                    style={{ height: "34px", width: "100%", padding: "0 8px" }}
                  />
                </td>
                <td className="num">{formatIDR(slip.pph21_ter)}</td>
                <td className="num pos" style={{ fontWeight: 700 }}>
                  {formatIDR(slip.net_pay)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            marginBottom: "12px",
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "13.5px" }}>
          Total Gaji Bersih: <b className="pos mono">{formatIDR(totalNet)}</b>
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Menghitung…" : `Generate ${preview.length} Slip`}
        </button>
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
    <div className="fin-view on">
      {/* Subtabs periode penggajian */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div className="subtabs" style={{ marginBottom: 0, flex: 1, minWidth: "260px" }}>
          {periods.map((p) => {
            const isActive = selectedPeriod?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectPeriod(p.id)}
                className={`subtab ${isActive ? "active" : ""}`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowBuat(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Buat Periode
        </button>
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

      {!selectedPeriod && (
        <div className="card">
          <div className="empty-note">
            Belum ada periode penggajian. Klik &quot;Buat Periode&quot; untuk memulai.
          </div>
        </div>
      )}

      {selectedPeriod && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h3>{selectedPeriod.name}</h3>
                <p>
                  Periode {formatTanggal(selectedPeriod.start_date)} s/d {formatTanggal(selectedPeriod.end_date)}
                </p>
              </div>
              <div className="spacer" />
              <span
                className={`badge ${
                  selectedPeriod.status === "paid"
                    ? "b-green"
                    : selectedPeriod.status === "finalized"
                    ? "b-blue"
                    : "b-amber"
                }`}
              >
                <i />
                {PAYROLL_STATUS_LABEL[selectedPeriod.status as PayrollPeriodStatus]}
              </span>
              {selectedPeriod.status === "draft" && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={working || slips.length === 0}
                  onClick={() =>
                    runAction(
                      finalizePayrollPeriod,
                      "Finalisasi periode? Slip tidak dapat diubah setelah final."
                    )
                  }
                >
                  {working ? "Memproses…" : "Finalisasi Periode"}
                </button>
              )}
              {selectedPeriod.status === "finalized" && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={working}
                  onClick={() =>
                    runAction(markPayrollPaid, "Tandai periode ini sudah dibayar?")
                  }
                >
                  {working ? "Memproses…" : "Tandai Dibayar"}
                </button>
              )}
            </div>
          </div>

          {selectedPeriod.status === "draft" && withoutSlips.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Generate Slip Gaji</h3>
                  <p>{withoutSlips.length} karyawan belum memiliki slip</p>
                </div>
              </div>
              <div className="card-pad">
                <GenerateSlipsForm periodId={selectedPeriod.id} employees={withoutSlips} />
              </div>
            </div>
          )}

          {slips.length > 0 && (
            <>
              <div className="stats-grid">
                <div className="card stat">
                  <div className="s-label">Total Gaji Bruto</div>
                  <div className="s-value">{formatIDR(totals.gross)}</div>
                  <div className="s-foot">{slips.length} slip gaji</div>
                </div>
                <div className="card stat">
                  <div className="s-label">Total Bersih (Take Home)</div>
                  <div className="s-value pos">{formatIDR(totals.net)}</div>
                  <div className="s-foot">Ditransfer ke karyawan</div>
                </div>
                <div className="card stat">
                  <div className="s-label">Total PPh 21 (TER)</div>
                  <div className="s-value">{formatIDR(totals.pph21)}</div>
                  <div className="s-foot">Disetor ke kas negara</div>
                </div>
                <div className="card stat">
                  <div className="s-label">Total BPJS Perusahaan</div>
                  <div className="s-value">{formatIDR(totals.bpjsEmployer)}</div>
                  <div className="s-foot">Beban operasional</div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div>
                    <h3>Rincian Slip Gaji Karyawan</h3>
                    <p>{slips.length} slip gaji terdaftar pada periode ini</p>
                  </div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Karyawan</th>
                        <th className="num">Gaji Pokok</th>
                        <th className="num">Tunjangan</th>
                        <th className="num">BPJS Kry.</th>
                        <th className="num">PPh 21</th>
                        <th className="num">THR Akrual</th>
                        <th className="num">Bersih</th>
                        <th style={{ width: "110px", textAlign: "right" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slips.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <b>{s.employee_name}</b>
                            <span className="mono small muted" style={{ display: "block" }}>
                              {s.employee_code}
                            </span>
                          </td>
                          <td className="num">{formatIDR(s.base_salary)}</td>
                          <td className="num">{formatIDR(s.allowances + s.overtime_pay)}</td>
                          <td className="num">
                            {formatIDR(s.bpjs_health_employee + s.bpjs_employment_employee)}
                          </td>
                          <td className="num">{formatIDR(s.pph21_ter)}</td>
                          <td className="num">{formatIDR(s.thr_accrual)}</td>
                          <td className="num pos" style={{ fontWeight: 700 }}>
                            {formatIDR(s.net_pay)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => setSlipModal(s)}
                              className="btn btn-sm"
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
            </>
          )}

          {slips.length === 0 && selectedPeriod.status !== "draft" && (
            <div className="card">
              <div className="empty-note">Periode ini belum memiliki slip gaji.</div>
            </div>
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
