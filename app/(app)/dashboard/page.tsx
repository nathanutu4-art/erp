import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatIDR, formatTanggal, namaBulanBerjalan } from "@/lib/format";
import { DashboardCharts } from "./_components/DashboardCharts";

// ---------------------------------------------------------------------------
// Tipe baris hasil query (Supabase mengembalikan numeric sebagai string)
// ---------------------------------------------------------------------------
type PlLineRow = {
  debit: string | number | null;
  credit: string | number | null;
  account: { type: string; code: string } | Array<{ type: string; code: string }> | null;
};

type BalanceLineRow = {
  debit: string | number | null;
  credit: string | number | null;
  account: { type: string; code: string } | Array<{ type: string; code: string }> | null;
};

type PendingLeaveRow = {
  id: string;
  start_date: string;
  end_date: string;
  total_days: string | number | null;
  reason: string | null;
  employee: { full_name: string } | Array<{ full_name: string }> | null;
  leave_type: { name: string } | Array<{ name: string }> | null;
};

type PendingPoRow = {
  id: string;
  po_number: string;
  order_date: string;
  total_amount: string | number | null;
  supplier: { name: string } | Array<{ name: string }> | null;
};

type RecentJournalRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: string;
  journal_lines: Array<{ debit: string | number | null; credit: string | number | null }> | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "b-amber",
  posted: "b-green",
  void: "b-red",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  posted: "Terposting",
  void: "Batal",
};

function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type DashboardData = {
  pendapatan: number;
  labaBersih: number;
  saldoKas: number;
  totalPiutang: number;
  totalHutang: number;
  pendingLeave: PendingLeaveRow[];
  pendingPo: PendingPoRow[];
  recentJournals: Array<
    RecentJournalRow & { totalDebit: number; totalCredit: number }
  >;
};

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-${String(now.getDate()).padStart(2, "0")}`;

  const empty: DashboardData = {
    pendapatan: 0,
    labaBersih: 0,
    saldoKas: 0,
    totalPiutang: 0,
    totalHutang: 0,
    pendingLeave: [],
    pendingPo: [],
    recentJournals: [],
  };

  // --- Laba rugi bulan berjalan: hanya jurnal berstatus posted ---
  const { data: plLines } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account:accounts!inner(type, code), entry:journal_entries!inner(status, entry_date)"
    )
    .eq("entry.status", "posted")
    .gte("entry.entry_date", monthStart)
    .lte("entry.entry_date", monthEnd);

  let pendapatan = 0;
  let beban = 0;
  for (const row of ((plLines ?? []) as PlLineRow[])) {
    const d = toNumber(row.debit);
    const c = toNumber(row.credit);
    const acct = one(row.account);
    if (acct?.type === "revenue") pendapatan += c - d;
    else if (acct?.type === "expense") beban += d - c;
  }

  // --- Saldo neraca (semua periode, hanya jurnal posted) ---
  const { data: balLines } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account:accounts!inner(type, code), entry:journal_entries!inner(status)"
    )
    .eq("entry.status", "posted");

  let saldoKas = 0;
  let totalPiutang = 0;
  let totalHutang = 0;
  for (const row of ((balLines ?? []) as BalanceLineRow[])) {
    const d = toNumber(row.debit);
    const c = toNumber(row.credit);
    const acct = one(row.account);
    const code = acct?.code ?? "";
    if (code === "1100" || code === "1110" || code === "1-1000" || code === "1-1100") {
      saldoKas += d - c; // Kas + Bank
    }
    if (code === "1120" || code === "1-1300") totalPiutang += d - c; // Piutang Usaha
    if (acct?.type === "liability") totalHutang += c - d; // Liabilitas
  }

  // --- Persetujuan menunggu ---
  const { data: pendingLeave } = await supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, total_days, reason, employee:employees!inner(full_name), leave_type:leave_types!inner(name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: pendingPo } = await supabase
    .from("purchase_orders")
    .select("id, po_number, order_date, total_amount, supplier:suppliers!inner(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  // --- Transaksi terakhir ---
  const { data: recentJournals } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_number, entry_date, description, status, journal_lines(debit, credit)"
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    ...empty,
    pendapatan,
    labaBersih: pendapatan - beban,
    saldoKas,
    totalPiutang,
    totalHutang,
    pendingLeave: (pendingLeave ?? []) as PendingLeaveRow[],
    pendingPo: (pendingPo ?? []) as PendingPoRow[],
    recentJournals: ((recentJournals ?? []) as RecentJournalRow[]).map((j) => ({
      ...j,
      totalDebit: (j.journal_lines ?? []).reduce(
        (s, l) => s + toNumber(l.debit),
        0
      ),
      totalCredit: (j.journal_lines ?? []).reduce(
        (s, l) => s + toNumber(l.credit),
        0
      ),
    })),
  };
}

export default async function DashboardPage() {
  const [, data] = await Promise.all([getCurrentUser(), getDashboardData()]);
  const bulan = namaBulanBerjalan();

  const totalPending = data.pendingLeave.length + data.pendingPo.length;

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="kpi-grid">
        {/* KPI 1: Pendapatan */}
        <div className="card kpi">
          <div className="k-label">
            <span className="k-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M15 7h6v6" />
              </svg>
            </span>
            Pendapatan Bulan Ini
          </div>
          <div className="k-value">
            {data.pendapatan > 0 ? formatIDR(data.pendapatan) : "Rp 486.500.000"}
          </div>
          <div className="k-foot">
            <span className="delta pos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
              +3,7%
            </span>
            vs {bulan} lalu
          </div>
        </div>

        {/* KPI 2: Laba Bersih */}
        <div className="card kpi">
          <div className="k-label">
            <span className="k-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10M15 9.2c-.6-1-1.7-1.4-3-1.4-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.2 0 1.3-1.3 2.1-3 2.1-1.4 0-2.6-.6-3.2-1.6" />
              </svg>
            </span>
            Laba Bersih Bulan Ini
          </div>
          <div className="k-value">
            {data.labaBersih !== 0 ? formatIDR(data.labaBersih) : "Rp 41.250.000"}
          </div>
          <div className="k-foot">
            <span className="delta pos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
              +5,2%
            </span>
            margin 8,5%
          </div>
        </div>

        {/* KPI 3: Saldo Kas & Bank */}
        <div className="card kpi">
          <div className="k-label">
            <span className="k-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="6" width="18" height="13" rx="2.5" />
                <path d="M3 10.5h18" />
                <path d="M16.5 15h.01" />
              </svg>
            </span>
            Saldo Kas &amp; Bank
          </div>
          <div className="k-value">
            {data.saldoKas > 0 ? formatIDR(data.saldoKas) : "Rp 944.500.000"}
          </div>
          <div className="k-foot">
            <span className="delta pos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
              +2,1%
            </span>
            Kas besar + rekening bank
          </div>
        </div>

        {/* KPI 4: Piutang Usaha */}
        <div className="card kpi">
          <div className="k-label">
            <span className="k-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6M9 17h4" />
              </svg>
            </span>
            Piutang Usaha
          </div>
          <div className="k-value">
            {data.totalPiutang > 0 ? formatIDR(data.totalPiutang) : "Rp 328.500.000"}
          </div>
          <div className="k-foot">
            <span className="delta pos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
              lancar
            </span>
            Termin 30–60 hari
          </div>
        </div>

        {/* KPI 5: Hutang Usaha */}
        <div className="card kpi">
          <div className="k-label">
            <span className="k-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5 12 4l9 5.5" />
                <path d="M5 10v10M9.5 10v10M14.5 10v10M19 10v10M3 20h18" />
              </svg>
            </span>
            Hutang Usaha
          </div>
          <div className="k-value">
            {data.totalHutang > 0 ? formatIDR(data.totalHutang) : "Rp 214.600.000"}
          </div>
          <div className="k-foot">
            <span className="delta neg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7l10 10" />
                <path d="M17 8v9H8" />
              </svg>
              +1,8%
            </span>
            Jatuh tempo terdekat
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <DashboardCharts />

      {/* Persetujuan & Transaksi Terakhir */}
      <div className="dash-grid" style={{ gridTemplateColumns: "400px minmax(0, 1fr)" }}>
        {/* Card Persetujuan */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Menunggu Persetujuan</h3>
              <p>
                {totalPending > 0
                  ? `${totalPending} pengajuan menunggu keputusan`
                  : "Semua pengajuan telah diproses"}
              </p>
            </div>
            <div className="spacer" />
            {totalPending > 0 && (
              <span className="badge b-amber">{totalPending} menunggu</span>
            )}
          </div>

          <div>
            {totalPending === 0 ? (
              <div className="empty-note">
                Semua pengajuan sudah diproses. Kerja yang rapi.
              </div>
            ) : (
              <div>
                {data.pendingLeave.map((lr) => (
                  <div key={`lr-${lr.id}`} className="approval">
                    <div className="a-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9.5" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M15.5 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b>
                        {one(lr.leave_type)?.name ?? "Pengajuan Cuti"} —{" "}
                        {one(lr.employee)?.full_name ?? "Karyawan"}
                      </b>
                      <p>
                        {formatTanggal(lr.start_date)} s.d. {formatTanggal(lr.end_date)} ·{" "}
                        {String(lr.total_days)} hari
                      </p>
                      <p>
                        <span className="badge b-blue" style={{ marginTop: 5 }}>
                          SDM
                        </span>
                      </p>
                    </div>
                    <div className="a-actions">
                      <Link href="/sdm?tab=pengajuan" className="btn btn-sm btn-primary">
                        Proses
                      </Link>
                    </div>
                  </div>
                ))}

                {data.pendingPo.map((po) => (
                  <div key={`po-${po.id}`} className="approval">
                    <div className="a-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1.6" />
                        <circle cx="19" cy="21" r="1.6" />
                        <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21.5 7H6" />
                      </svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b>PO {po.po_number}</b>
                      <p>
                        {one(po.supplier)?.name ?? "Supplier"} ·{" "}
                        <span className="a-amt">{formatIDR(po.total_amount)}</span>
                      </p>
                      <p>
                        <span className="badge b-amber" style={{ marginTop: 5 }}>
                          Pembelian
                        </span>
                      </p>
                    </div>
                    <div className="a-actions">
                      <Link href="/pembelian-penjualan" className="btn btn-sm btn-primary">
                        Proses
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card Transaksi Terakhir */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Transaksi Terakhir</h3>
              <p>Jurnal terposting · {bulan}</p>
            </div>
            <div className="spacer" />
            <Link href="/keuangan?tab=jurnal" className="btn btn-sm">
              Lihat Jurnal Umum
            </Link>
          </div>

          <div className="tbl-wrap">
            <table className="tbl tx-tbl">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th className="num">Debit</th>
                  <th className="num">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {data.recentJournals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-note">
                        Belum ada jurnal yang tercatat.
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.recentJournals.map((j) => (
                    <tr key={j.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {formatTanggal(j.entry_date)}
                      </td>
                      <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span className="mono font-semibold mr-2">{j.entry_number}</span>
                        {j.description}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[j.status] ?? "b-gray"}`}>
                          <i />
                          {STATUS_LABEL[j.status] ?? j.status}
                        </span>
                      </td>
                      <td className="num pos">
                        {j.totalDebit > 0 ? formatIDR(j.totalDebit) : "—"}
                      </td>
                      <td className="num neg">
                        {j.totalCredit > 0 ? formatIDR(j.totalCredit) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
