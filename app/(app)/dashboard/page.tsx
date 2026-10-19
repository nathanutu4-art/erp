import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatIDR, formatTanggal, namaBulanBerjalan } from "@/lib/format";

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
  journal_lines: Array<{ debit: string | number | null }> | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  posted: "Dibukukan",
  void: "Dibatalkan",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  posted: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  void: "bg-rose-400/20 text-rose-200 border-rose-300/40",
};

function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalisasi relasi hasil join: di runtime berupa objek tunggal,
 * tetapi tipe inferensi Supabase menyatakannya sebagai array.
 */
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
  recentJournals: Array<RecentJournalRow & { total: number }>;
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
    .select("debit, credit, account:accounts!inner(type, code), entry:journal_entries!inner(status, entry_date)")
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
    .select("debit, credit, account:accounts!inner(type, code), entry:journal_entries!inner(status)")
    .eq("entry.status", "posted");

  let saldoKas = 0;
  let totalPiutang = 0;
  let totalHutang = 0;
  for (const row of ((balLines ?? []) as BalanceLineRow[])) {
    const d = toNumber(row.debit);
    const c = toNumber(row.credit);
    const acct = one(row.account);
    const code = acct?.code ?? "";
    if (code === "1100" || code === "1110") saldoKas += d - c; // Kas + Bank
    if (code === "1120") totalPiutang += d - c; // Piutang Usaha
    if (acct?.type === "liability") totalHutang += c - d; // seluruh liabilitas
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
    .select("id, entry_number, entry_date, description, status, journal_lines(debit)")
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
    pendingLeave: ((pendingLeave ?? []) as PendingLeaveRow[]),
    pendingPo: ((pendingPo ?? []) as PendingPoRow[]),
    recentJournals: ((recentJournals ?? []) as RecentJournalRow[]).map((j) => ({
      ...j,
      total: (j.journal_lines ?? []).reduce((s, l) => s + toNumber(l.debit), 0),
    })),
  };
}

export default async function DashboardPage() {
  const [current, data] = await Promise.all([getCurrentUser(), getDashboardData()]);
  const userName = current?.profile?.full_name ?? "Pengguna";
  const bulan = namaBulanBerjalan();

  const kpis = [
    { label: "Pendapatan Bulan Ini", value: formatIDR(data.pendapatan), hint: bulan },
    { label: "Laba Bersih Bulan Ini", value: formatIDR(data.labaBersih), hint: bulan },
    { label: "Saldo Kas", value: formatIDR(data.saldoKas), hint: "Kas + Bank" },
    { label: "Total Piutang", value: formatIDR(data.totalPiutang), hint: "Piutang usaha" },
    { label: "Total Hutang", value: formatIDR(data.totalHutang), hint: "Seluruh liabilitas" },
  ];

  const totalPending = data.pendingLeave.length + data.pendingPo.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Selamat datang, {userName} — ringkasan kinerja perusahaan
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <GlassCard key={kpi.label} className="p-5">
            <p className="text-sm font-medium text-slate-300/80">{kpi.label}</p>
            <p className="text-2xl font-extrabold text-slate-100 mt-2 break-words">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-400/70 mt-1">{kpi.hint}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Menunggu persetujuan */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-100">
              Menunggu Persetujuan
            </h2>
            {totalPending > 0 && (
              <span className="text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-300/40 rounded-full px-3 py-1">
                {totalPending} menunggu
              </span>
            )}
          </div>

          {totalPending === 0 ? (
            <p className="text-sm text-slate-300/70">
              Tidak ada persetujuan yang menunggu saat ini.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.pendingLeave.map((lr) => (
                <li key={`lr-${lr.id}`}>
                  {/* TODO: arahkan ke halaman detail modul SDM setelah modul dibangun */}
                  <Link
                    href="#"
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {one(lr.leave_type)?.name ?? "Pengajuan"} —{" "}
                        {one(lr.employee)?.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-300/70 mt-0.5">
                        {formatTanggal(lr.start_date)} s.d.{" "}
                        {formatTanggal(lr.end_date)} · {String(lr.total_days)} hari
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-300/40 rounded-full px-3 py-1">
                      Cuti
                    </span>
                  </Link>
                </li>
              ))}
              {data.pendingPo.map((po) => (
                <li key={`po-${po.id}`}>
                  {/* TODO: arahkan ke halaman detail modul Pembelian setelah modul dibangun */}
                  <Link
                    href="#"
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {po.po_number} — {one(po.supplier)?.name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-300/70 mt-0.5">
                        {formatTanggal(po.order_date)} · {formatIDR(po.total_amount)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold bg-sky-400/20 text-sky-200 border border-sky-300/40 rounded-full px-3 py-1">
                      PO
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Transaksi terakhir */}
        <GlassCard className="p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">
            Transaksi Terakhir
          </h2>
          {data.recentJournals.length === 0 ? (
            <p className="text-sm text-slate-300/70">
              Belum ada jurnal yang tercatat.
            </p>
          ) : (
            <div className="tbl-wrap -mx-1">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-300/70">
                    <th className="py-2 pr-3 font-semibold">Nomor</th>
                    <th className="py-2 pr-3 font-semibold">Tanggal</th>
                    <th className="py-2 pr-3 font-semibold">Keterangan</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.recentJournals.map((j) => (
                    <tr key={j.id} className="text-slate-200">
                      <td className="py-2.5 pr-3 font-medium text-slate-100 whitespace-nowrap">
                        {j.entry_number}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {formatTanggal(j.entry_date)}
                      </td>
                      <td className="py-2.5 pr-3 max-w-[180px] truncate">
                        {j.description}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 border whitespace-nowrap ${STATUS_STYLE[j.status] ?? STATUS_STYLE.draft}`}
                        >
                          {STATUS_LABEL[j.status] ?? j.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-100 whitespace-nowrap">
                        {formatIDR(j.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
