"use client";

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

/**
 * Pratinjau cetak dokumen dengan kop perusahaan (D10).
 * Kop: logo placeholder + nama/alamat/telepon/NPWP dari company_settings.
 * Tombol "Cetak" memakai window.print(); gaya cetak diatur di globals.css
 * (.print-document) agar hanya dokumen yang tercetak.
 */
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
  return (
    <GlassModal open={open} onClose={onClose} title={`Pratinjau — ${title}`}>
      <div className="print-document rounded-2xl bg-white/[0.04] border border-white/15 p-5 sm:p-7 text-slate-100">
        {/* Kop perusahaan */}
        <div className="flex items-start gap-4 pb-4 border-b-2 border-white/25">
          <div
            aria-hidden
            className="shrink-0 w-14 h-14 rounded-2xl bg-teal-400/25 border border-teal-300/50 flex items-center justify-center text-teal-200 font-extrabold text-lg"
          >
            {letterhead.companyName.trim().charAt(0).toUpperCase() || "E"}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">
              {letterhead.companyName}
            </p>
            <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
              {letterhead.address}
              <br />
              {letterhead.phone}
              {letterhead.npwp ? ` · NPWP ${letterhead.npwp}` : ""}
            </p>
          </div>
        </div>

        {/* Judul dokumen */}
        <h3 className="text-center text-xl font-extrabold tracking-wide mt-5 mb-4 uppercase">
          {title}
        </h3>

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-5">
          {meta.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-slate-400 shrink-0 w-28">{k}</dt>
              <dd className="font-medium">: {v}</dd>
            </div>
          ))}
        </dl>

        {extraBlock}

        {/* Tabel baris */}
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-y border-white/25 text-left">
                <th className="py-2 pr-2 w-10">No</th>
                <th className="py-2 pr-2">Uraian</th>
                <th className="py-2 pr-2 text-right">Jumlah</th>
                <th className="py-2 pr-2 text-right">Harga Satuan</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.no} className="border-b border-white/10">
                  <td className="py-2 pr-2">{l.no}</td>
                  <td className="py-2 pr-2">
                    {l.description}
                    {l.unit ? (
                      <span className="text-slate-400"> ({l.unit})</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-right">{l.qty}</td>
                  <td className="py-2 pr-2 text-right">{l.unitPrice}</td>
                  <td className="py-2 text-right font-medium">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex justify-end mt-4">
          <dl className="w-full sm:w-64 space-y-1.5 text-sm">
            {totals.map(([k, v, strong]) => (
              <div
                key={k}
                className={`flex justify-between gap-4 ${
                  strong ? "font-extrabold text-base" : ""
                }`}
              >
                <dt className="text-slate-400">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {notes && (
          <p className="text-xs text-slate-300/90 mt-5 whitespace-pre-line">
            Catatan: {notes}
          </p>
        )}

        {/* Tanda tangan */}
        <div className="grid grid-cols-2 gap-4 mt-8 text-sm text-center">
          <div>
            <p className="text-slate-400">Hormat kami,</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-white/25 pt-1 inline-block px-6">
              {letterhead.companyName}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Penerima,</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-white/25 pt-1 inline-block px-6">
              ( Nama &amp; Tanda Tangan )
            </p>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-col sm:flex-row gap-3 sm:justify-end mt-4">
        <GlassButton
          type="button"
          variant="ghost"
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          Tutup
        </GlassButton>
        <GlassButton
          type="button"
          onClick={() => window.print()}
          className="w-full sm:w-auto"
        >
          🖨 Cetak
        </GlassButton>
      </div>
    </GlassModal>
  );
}
