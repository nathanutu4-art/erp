"use client";

/**
 * ============================================================================
 * MODAL PRATINJAU DOKUMEN CETAK (PRINT PREVIEW COMPONENT)
 * ============================================================================
 * 
 * Dialog pratinjau dokumen cetak A4 fisik berstandar Indonesia:
 * 1. Kop Surat Resmi: Menampilkan logo inisial, nama perusahaan, alamat, telepon, dan NPWP dari `company_settings`.
 * 2. Lembar Kertas `.paper`: Format bersih putih dengan tabel item barang, subtotal, ringkasan pajak, dan kolom tanda tangan.
 * 3. Aksi Cetak PDF: Mendukung perintah cetak langsung browser (`window.print()`).
 * ============================================================================
 */

import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import type { CompanyLetterhead } from "../_lib/jualbeli";

export type PrintLine = {
  no: number;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string;
};

export function PrintPreview({
  open,
  onClose,
  title,
  letterhead,
  meta,
  lines,
  totals,
  notes,
  extraBlock,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  letterhead: CompanyLetterhead;
  meta: Array<[string, string]>;
  lines: PrintLine[];
  totals: Array<[string, string, boolean?]>;
  notes?: string | null;
  extraBlock?: React.ReactNode;
}) {
  const logoInitial = letterhead.companyName.trim().slice(0, 2).toUpperCase() || "MB";

  return (
    <GlassModal open={open} onClose={onClose} title={title} subtitle="Pratinjau cetak dengan kop perusahaan" wide>
      <div className="paper">
        {/* Kop perusahaan */}
        <div className="p-head">
          <div className="p-logo" aria-hidden="true">
            {logoInitial}
          </div>
          <div>
            <div className="p-co">{letterhead.companyName}</div>
            <div className="p-addr">{letterhead.address}</div>
            <div className="p-addr">
              Telp. {letterhead.phone}
              {letterhead.npwp ? ` · NPWP ${letterhead.npwp}` : ""}
            </div>
          </div>
        </div>

        {/* Judul Dokumen */}
        <h4 className="p-title">{title}</h4>

        {/* Meta Dokumen */}
        <div className="p-meta">
          <table>
            <tbody>
              {meta.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>: <b>{v}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {extraBlock}

        {/* Tabel Rincian */}
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>No</th>
              <th>Uraian</th>
              <th className="num">Jumlah</th>
              <th className="num">Harga Satuan</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.no}>
                <td>{l.no}</td>
                <td>
                  {l.description}
                  {l.unit ? <span className="text-slate-500"> ({l.unit})</span> : null}
                </td>
                <td className="num">{l.qty}</td>
                <td className="num">{l.unitPrice}</td>
                <td className="num" style={{ fontWeight: 600 }}>{l.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total Ringkasan */}
        <div className="p-tot">
          <table>
            <tbody>
              {totals.map(([k, v, strong]) => (
                <tr key={k} className={strong ? "grand" : ""}>
                  <td>{k}</td>
                  <td className="num">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {notes && <div className="p-note">Catatan: {notes}</div>}

        {/* Area Tanda Tangan */}
        <div className="p-sign">
          <div className="sg">
            <div>Hormat kami,</div>
            <div className="nm">{letterhead.companyName}</div>
          </div>
          <div className="sg">
            <div>Penerima,</div>
            <div className="nm">( Nama &amp; Tanda Tangan )</div>
          </div>
        </div>
      </div>

      <div className="no-print modal-foot" style={{ marginTop: 16 }}>
        <GlassButton type="button" variant="ghost" onClick={onClose}>
          Tutup
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={() => window.print()}>
          🖨 Cetak Dokumen
        </GlassButton>
      </div>
    </GlassModal>
  );
}
