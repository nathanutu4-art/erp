import { GlassCard } from "@/components/ui/GlassCard";
import { formatIDR } from "@/lib/format";

// ---------------------------------------------------------------------------
// Jenis data agregat yang dihitung di page.tsx (server)
// ---------------------------------------------------------------------------

export type ReportAccountLine = {
  code: string;
  name: string;
  debit: number;
  credit: number;
  saldo: number; // mengikuti saldo normal akun
};

// ---------------------------------------------------------------------------
// Laba Rugi
// ---------------------------------------------------------------------------

export function LaporanLabaRugi({
  revenues,
  expenses,
  totalRevenue,
  totalExpense,
  periodeLabel,
}: {
  revenues: ReportAccountLine[];
  expenses: ReportAccountLine[];
  totalRevenue: number;
  totalExpense: number;
  periodeLabel: string;
}) {
  const labaBersih = totalRevenue - totalExpense;
  const kosong = revenues.length === 0 && expenses.length === 0;

  return (
    <div>
      <p className="text-sm text-slate-300/80 mb-4">
        Periode: <span className="font-semibold text-slate-100">{periodeLabel}</span>
        {" "}· disusun dari jurnal berstatus Dibukukan.
      </p>

      {kosong ? (
        <GlassCard className="p-6">
          <p className="text-sm text-slate-300/70 text-center py-8">
            Belum ada transaksi pendapatan maupun beban pada periode ini.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <GlassCard className="p-4 sm:p-6">
            <h2 className="text-base font-bold text-slate-100 mb-3">Pendapatan</h2>
            {revenues.length === 0 ? (
              <p className="text-sm text-slate-300/70">Rp 0</p>
            ) : (
              <dl className="space-y-2">
                {revenues.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <dt className="text-slate-200 min-w-0">
                      <span className="font-mono text-slate-300/70 mr-2">
                        {r.code}
                      </span>
                      {r.name}
                    </dt>
                    <dd className="font-semibold text-slate-100 whitespace-nowrap">
                      {formatIDR(r.saldo)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15 text-sm font-bold">
              <span className="text-slate-100">Total Pendapatan</span>
              <span className="text-teal-200">{formatIDR(totalRevenue)}</span>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-6">
            <h2 className="text-base font-bold text-slate-100 mb-3">Beban</h2>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-300/70">Rp 0</p>
            ) : (
              <dl className="space-y-2">
                {expenses.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <dt className="text-slate-200 min-w-0">
                      <span className="font-mono text-slate-300/70 mr-2">
                        {r.code}
                      </span>
                      {r.name}
                    </dt>
                    <dd className="font-semibold text-slate-100 whitespace-nowrap">
                      {formatIDR(r.saldo)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15 text-sm font-bold">
              <span className="text-slate-100">Total Beban</span>
              <span className="text-rose-200">{formatIDR(totalExpense)}</span>
            </div>
          </GlassCard>

          <GlassCard strong className="p-4 sm:p-6">
            <div className="flex items-center justify-between text-base font-extrabold">
              <span className="text-slate-100">Laba Bersih</span>
              <span className={labaBersih < 0 ? "text-rose-200" : "text-teal-200"}>
                {formatIDR(labaBersih)}
              </span>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Neraca
// ---------------------------------------------------------------------------

export function LaporanNeraca({
  assets,
  liabilities,
  equities,
  totalAsset,
  totalLiability,
  totalEquity,
  tanggalLabel,
}: {
  assets: ReportAccountLine[];
  liabilities: ReportAccountLine[];
  equities: ReportAccountLine[];
  totalAsset: number;
  totalLiability: number;
  totalEquity: number;
  tanggalLabel: string;
}) {
  const sisiKanan = totalLiability + totalEquity;
  const selisih = Math.round((totalAsset - sisiKanan) * 100) / 100;
  const seimbang = Math.abs(selisih) < 0.01;
  const kosong =
    assets.length === 0 && liabilities.length === 0 && equities.length === 0;

  const Section = ({
    title,
    lines,
    total,
  }: {
    title: string;
    lines: ReportAccountLine[];
    total: number;
  }) => (
    <GlassCard className="p-4 sm:p-6">
      <h2 className="text-base font-bold text-slate-100 mb-3">{title}</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-slate-300/70">Rp 0</p>
      ) : (
        <dl className="space-y-2">
          {lines.map((r) => (
            <div
              key={r.code}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <dt className="text-slate-200 min-w-0">
                <span className="font-mono text-slate-300/70 mr-2">{r.code}</span>
                {r.name}
              </dt>
              <dd
                className={`font-semibold whitespace-nowrap ${
                  r.saldo < 0 ? "text-rose-200" : "text-slate-100"
                }`}
              >
                {formatIDR(r.saldo)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15 text-sm font-bold">
        <span className="text-slate-100">Total {title}</span>
        <span className="text-slate-100">{formatIDR(total)}</span>
      </div>
    </GlassCard>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-sm text-slate-300/80">
          Per tanggal:{" "}
          <span className="font-semibold text-slate-100">{tanggalLabel}</span>
        </p>
        <span
          className={`inline-flex items-center min-h-[44px] text-xs font-bold rounded-full px-4 border ${
            seimbang
              ? "bg-teal-400/20 text-teal-200 border-teal-300/40"
              : "bg-rose-500/20 text-rose-200 border-rose-300/40"
          }`}
          role="status"
        >
          {seimbang
            ? "✓ Neraca seimbang"
            : `⚠ Neraca TIDAK seimbang — selisih ${formatIDR(Math.abs(selisih))}`}
        </span>
      </div>

      {kosong ? (
        <GlassCard className="p-6">
          <p className="text-sm text-slate-300/70 text-center py-8">
            Belum ada saldo akun neraca hingga tanggal tersebut.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Section title="Aset" lines={assets} total={totalAsset} />
          <div className="space-y-4">
            <Section
              title="Liabilitas"
              lines={liabilities}
              total={totalLiability}
            />
            <Section title="Ekuitas" lines={equities} total={totalEquity} />
            <GlassCard strong className="p-4 sm:p-6">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-slate-100">
                  Total Liabilitas + Ekuitas
                </span>
                <span className="text-slate-100">{formatIDR(sisiKanan)}</span>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arus Kas (disederhanakan)
// ---------------------------------------------------------------------------

export type CashFlowItem = {
  entryNumber: string;
  entryDate: string;
  description: string;
  amount: number; // positif = kas masuk, negatif = kas keluar
};

export function LaporanArusKas({
  operasi,
  investasi,
  pendanaan,
  totalOperasi,
  totalInvestasi,
  totalPendanaan,
  saldoAwal,
  saldoAkhir,
  periodeLabel,
}: {
  operasi: CashFlowItem[];
  investasi: CashFlowItem[];
  pendanaan: CashFlowItem[];
  totalOperasi: number;
  totalInvestasi: number;
  totalPendanaan: number;
  saldoAwal: number;
  saldoAkhir: number;
  periodeLabel: string;
}) {
  const bersih = totalOperasi + totalInvestasi + totalPendanaan;
  const kosong =
    operasi.length === 0 && investasi.length === 0 && pendanaan.length === 0;

  const Section = ({
    title,
    items,
    total,
    hint,
  }: {
    title: string;
    items: CashFlowItem[];
    total: number;
    hint: string;
  }) => (
    <GlassCard className="p-4 sm:p-6">
      <h2 className="text-base font-bold text-slate-100">{title}</h2>
      <p className="text-xs text-slate-300/70 mt-0.5 mb-3">{hint}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-300/70">Rp 0</p>
      ) : (
        <dl className="space-y-2">
          {items.map((it) => (
            <div
              key={`${it.entryNumber}-${it.amount}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <dt className="text-slate-200 min-w-0 truncate">
                <span className="font-mono text-slate-300/70 mr-2">
                  {it.entryNumber}
                </span>
                {it.description}
              </dt>
              <dd
                className={`font-semibold whitespace-nowrap ${
                  it.amount < 0 ? "text-rose-200" : "text-teal-200"
                }`}
              >
                {it.amount < 0 ? "(" : ""}
                {formatIDR(Math.abs(it.amount))}
                {it.amount < 0 ? ")" : ""}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15 text-sm font-bold">
        <span className="text-slate-100">Kas bersih {title.toLowerCase()}</span>
        <span className={total < 0 ? "text-rose-200" : "text-teal-200"}>
          {formatIDR(total)}
        </span>
      </div>
    </GlassCard>
  );

  return (
    <div>
      <p className="text-sm text-slate-300/80 mb-4">
        Periode: <span className="font-semibold text-slate-100">{periodeLabel}</span>
        {" "}· disusun dari mutasi akun Kas & Bank pada jurnal berstatus
        Dibukukan.
      </p>

      {kosong ? (
        <GlassCard className="p-6">
          <p className="text-sm text-slate-300/70 text-center py-8">
            Belum ada mutasi kas pada periode ini.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <Section
            title="Aktivitas Operasi"
            items={operasi}
            total={totalOperasi}
            hint="Kas dari pendapatan, beban, dan modal kerja."
          />
          <Section
            title="Aktivitas Investasi"
            items={investasi}
            total={totalInvestasi}
            hint="Kas dari perolehan/pelepasan aset tetap."
          />
          <Section
            title="Aktivitas Pendanaan"
            items={pendanaan}
            total={totalPendanaan}
            hint="Kas dari pinjaman, modal, dan prive pemilik."
          />

          <GlassCard strong className="p-4 sm:p-6 space-y-2 text-sm font-bold">
            <div className="flex items-center justify-between">
              <span className="text-slate-200">Kenaikan (penurunan) kas bersih</span>
              <span className={bersih < 0 ? "text-rose-200" : "text-teal-200"}>
                {formatIDR(bersih)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-200">Saldo kas awal periode</span>
              <span className="text-slate-100">{formatIDR(saldoAwal)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/15 text-base">
              <span className="text-slate-100">Saldo kas akhir periode</span>
              <span className="text-slate-100">{formatIDR(saldoAkhir)}</span>
            </div>
          </GlassCard>
        </div>
      )}
      <p className="text-xs text-slate-400/70 mt-3">
        Klasifikasi aktivitas mengikuti akun lawan pada tiap jurnal: aset tetap
        → investasi; liabilitas/ekuitas → pendanaan; selebihnya → operasi.
      </p>
    </div>
  );
}
