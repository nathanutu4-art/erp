/**
 * ============================================================================
 * KOMPONEN FORMAT LAPORAN KEUANGAN RESMI (FINANCIAL REPORTS)
 * ============================================================================
 * 
 * Kumpulan 3 komponen cetak dan tampilan laporan keuangan baku:
 * 1. LaporanLabaRugi: Pendapatan operasional dikurangi HPP & beban operasional untuk menghasilkan laba/rugi bersih.
 * 2. LaporanNeraca: Menyajikan Aset Lancar, Aset Tetap, Liabilitas, dan Ekuitas dengan baris verifikasi keseimbangan.
 * 3. LaporanArusKas: Arus kas bersih dari aktivitas Operasi, Investasi, dan Pendanaan serta rekonsiliasi kas akhir.
 * ============================================================================
 */

import { formatIDR, formatTanggal } from "@/lib/format";

// ---------------------------------------------------------------------------
// Jenis data agregat yang dihitung di page.tsx (server)
// ---------------------------------------------------------------------------

export type ReportAccountLine = {
  code: string;
  name: string;
  debit: number;
  credit: number;
  saldo: number;
};

export type CashFlowItem = {
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  amount: number;
  label?: string;
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

  return (
    <div className="card report">
      <div className="report-head">
        <div className="r-co">PT MAJU BERSAMA</div>
        <div className="r-title">LAPORAN LABA RUGI</div>
        <div className="r-per">
          Periode: {periodeLabel} · Jurnal Terposting · dalam Rupiah
        </div>
      </div>

      <table>
        <tbody>
          {/* PENDAPATAN */}
          <tr className="r-sec">
            <td colSpan={2}>PENDAPATAN USAHA</td>
          </tr>
          {revenues.length === 0 ? (
            <tr className="r-sub">
              <td>Tidak ada akun pendapatan</td>
              <td className="r-num">Rp 0</td>
            </tr>
          ) : (
            revenues.map((r) => (
              <tr key={r.code} className="r-sub">
                <td>
                  <span className="mono mr-2 text-slate-400">{r.code}</span>
                  {r.name}
                </td>
                <td className="r-num">{formatIDR(r.saldo)}</td>
              </tr>
            ))
          )}
          <tr className="r-total">
            <td>Total Pendapatan Usaha</td>
            <td className="r-num">{formatIDR(totalRevenue)}</td>
          </tr>

          {/* BEBAN */}
          <tr className="r-sec">
            <td colSpan={2}>BEBAN OPERASIONAL</td>
          </tr>
          {expenses.length === 0 ? (
            <tr className="r-sub">
              <td>Tidak ada akun beban</td>
              <td className="r-num">Rp 0</td>
            </tr>
          ) : (
            expenses.map((r) => (
              <tr key={r.code} className="r-sub">
                <td>
                  <span className="mono mr-2 text-slate-400">{r.code}</span>
                  {r.name}
                </td>
                <td className="r-num">{formatIDR(r.saldo)}</td>
              </tr>
            ))
          )}
          <tr className="r-total">
            <td>Total Beban Operasional</td>
            <td className="r-num">{formatIDR(totalExpense)}</td>
          </tr>

          {/* LABA BERSIH */}
          <tr className="r-grand">
            <td>LABA BERSIH BERJALAN</td>
            <td className="r-num">{formatIDR(labaBersih)}</td>
          </tr>
        </tbody>
      </table>
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
  const totalLiabEquity = totalLiability + totalEquity;

  return (
    <div className="card report">
      <div className="report-head">
        <div className="r-co">PT MAJU BERSAMA</div>
        <div className="r-title">NERACA (LAPORAN POSISI KEUANGAN)</div>
        <div className="r-per">Per {tanggalLabel} · dalam Rupiah</div>
      </div>

      <table>
        <tbody>
          {/* ASET */}
          <tr className="r-sec">
            <td colSpan={2}>ASET</td>
          </tr>
          {assets.map((a) => (
            <tr key={a.code} className="r-sub">
              <td>
                <span className="mono mr-2 text-slate-400">{a.code}</span>
                {a.name}
              </td>
              <td className="r-num">{formatIDR(a.saldo)}</td>
            </tr>
          ))}
          <tr className="r-grand">
            <td>TOTAL ASET</td>
            <td className="r-num">{formatIDR(totalAsset)}</td>
          </tr>

          {/* LIABILITAS */}
          <tr className="r-sec">
            <td colSpan={2}>LIABILITAS</td>
          </tr>
          {liabilities.map((l) => (
            <tr key={l.code} className="r-sub">
              <td>
                <span className="mono mr-2 text-slate-400">{l.code}</span>
                {l.name}
              </td>
              <td className="r-num">{formatIDR(l.saldo)}</td>
            </tr>
          ))}
          <tr className="r-total">
            <td>Total Liabilitas</td>
            <td className="r-num">{formatIDR(totalLiability)}</td>
          </tr>

          {/* EKUITAS */}
          <tr className="r-sec">
            <td colSpan={2}>EKUITAS</td>
          </tr>
          {equities.map((e) => (
            <tr key={e.code} className="r-sub">
              <td>
                <span className="mono mr-2 text-slate-400">{e.code}</span>
                {e.name}
              </td>
              <td className="r-num">{formatIDR(e.saldo)}</td>
            </tr>
          ))}
          <tr className="r-total">
            <td>Total Ekuitas</td>
            <td className="r-num">{formatIDR(totalEquity)}</td>
          </tr>

          {/* TOTAL LIABILITAS & EKUITAS */}
          <tr className="r-grand">
            <td>TOTAL LIABILITAS &amp; EKUITAS</td>
            <td className="r-num">{formatIDR(totalLiabEquity)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arus Kas
// ---------------------------------------------------------------------------

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
  const kenaikanBersih = totalOperasi + totalInvestasi + totalPendanaan;

  return (
    <div className="card report">
      <div className="report-head">
        <div className="r-co">PT MAJU BERSAMA</div>
        <div className="r-title">LAPORAN ARUS KAS</div>
        <div className="r-per">
          Periode: {periodeLabel} · Metode Langsung · dalam Rupiah
        </div>
      </div>

      <table>
        <tbody>
          {/* OPERASI */}
          <tr className="r-sec">
            <td colSpan={2}>Arus Kas dari Aktivitas Operasi</td>
          </tr>
          {operasi.length === 0 ? (
            <tr className="r-sub">
              <td>Tidak ada arus kas operasi pada periode ini</td>
              <td className="r-num">Rp 0</td>
            </tr>
          ) : (
            operasi.map((item, idx) => (
              <tr key={idx} className="r-sub">
                <td>
                  {item.entryDate ? (
                    <span className="mono mr-2 text-slate-400">
                      {formatTanggal(item.entryDate)}
                    </span>
                  ) : null}
                  {item.description || item.label || item.entryNumber}
                </td>
                <td className="r-num">{formatIDR(item.amount)}</td>
              </tr>
            ))
          )}
          <tr className="r-total">
            <td>Arus Kas Bersih dari Aktivitas Operasi</td>
            <td className="r-num">{formatIDR(totalOperasi)}</td>
          </tr>

          {/* INVESTASI */}
          <tr className="r-sec">
            <td colSpan={2}>Arus Kas dari Aktivitas Investasi</td>
          </tr>
          {investasi.length === 0 ? (
            <tr className="r-sub">
              <td>Tidak ada arus kas investasi pada periode ini</td>
              <td className="r-num">Rp 0</td>
            </tr>
          ) : (
            investasi.map((item, idx) => (
              <tr key={idx} className="r-sub">
                <td>
                  {item.entryDate ? (
                    <span className="mono mr-2 text-slate-400">
                      {formatTanggal(item.entryDate)}
                    </span>
                  ) : null}
                  {item.description || item.label || item.entryNumber}
                </td>
                <td className="r-num">{formatIDR(item.amount)}</td>
              </tr>
            ))
          )}
          <tr className="r-total">
            <td>Arus Kas Bersih dari Aktivitas Investasi</td>
            <td className="r-num">{formatIDR(totalInvestasi)}</td>
          </tr>

          {/* PENDANAAN */}
          <tr className="r-sec">
            <td colSpan={2}>Arus Kas dari Aktivitas Pendanaan</td>
          </tr>
          {pendanaan.length === 0 ? (
            <tr className="r-sub">
              <td>Tidak ada arus kas pendanaan pada periode ini</td>
              <td className="r-num">Rp 0</td>
            </tr>
          ) : (
            pendanaan.map((item, idx) => (
              <tr key={idx} className="r-sub">
                <td>
                  {item.entryDate ? (
                    <span className="mono mr-2 text-slate-400">
                      {formatTanggal(item.entryDate)}
                    </span>
                  ) : null}
                  {item.description || item.label || item.entryNumber}
                </td>
                <td className="r-num">{formatIDR(item.amount)}</td>
              </tr>
            ))
          )}
          <tr className="r-total">
            <td>Arus Kas Bersih dari Aktivitas Pendanaan</td>
            <td className="r-num">{formatIDR(totalPendanaan)}</td>
          </tr>

          {/* PERUBAHAN BERSIH */}
          <tr className="r-grand">
            <td>Kenaikan / (Penurunan) Bersih Kas &amp; Setara Kas</td>
            <td className="r-num">{formatIDR(kenaikanBersih)}</td>
          </tr>
          <tr className="r-line">
            <td>Saldo Kas &amp; Setara Kas — Awal Periode</td>
            <td className="r-num">{formatIDR(saldoAwal)}</td>
          </tr>
          <tr className="r-grand">
            <td>Saldo Kas &amp; Setara Kas — Akhir Periode</td>
            <td className="r-num">{formatIDR(saldoAkhir)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
