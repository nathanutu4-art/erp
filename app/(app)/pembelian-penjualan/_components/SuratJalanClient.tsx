"use client";

/**
 * ============================================================================
 * KOMPONEN SURAT JALAN (DELIVERY NOTE CLIENT)
 * ============================================================================
 * 
 * Pengelolaan dokumen pengiriman barang ke pelanggan:
 * 1. Tabel Surat Jalan: Nomor dokumen (SJ-YYYY-NNNN), referensi invoice, pelanggan, tanggal kirim, nomor polisi kendaraan, pengemudi, dan status.
 * 2. Pembuatan Surat Jalan: Mengaitkan surat jalan ke invoice penjualan dan mengurangi stok barang secara resmi dari gudang.
 * 3. Pratinjau Dokumen Cetak: Menampilkan format Surat Jalan cetak dengan kop surat perusahaan dan kolom tanda tangan pengirim/penerima.
 * ============================================================================
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { formatIDR, formatTanggal } from "@/lib/format";
import { formatQty } from "@/app/(app)/inventaris/_lib/inventory";
import {
  SJ_STATUS_LABEL,
  todayISO,
  type CompanyLetterhead,
  type DeliveryNoteRow,
} from "../_lib/jualbeli";
import {
  ErrorAlert,
  ModalActions,
  StatusBadge,
  EmptyState,
} from "./shared";
import { PrintPreview, type PrintLine } from "./PrintPreview";
import {
  createDeliveryNote,
  shipDeliveryNote,
  deliverDeliveryNote,
  getInvoiceDetail,
} from "../actions";

type InvoiceOption = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  status: string;
};

// ---------------------------------------------------------------------------
// Modal: Buat Surat Jalan
// ---------------------------------------------------------------------------

function BuatSjModal({
  invoices,
  onClose,
}: {
  invoices: InvoiceOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [useInvoice, setUseInvoice] = useState(invoices.length > 0);
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = !pending && (!useInvoice || invoiceId !== "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createDeliveryNote({
        invoiceId: useInvoice ? invoiceId : undefined,
        deliveryDate,
        recipientName: recipientName.trim(),
        notes: notes.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Buat Surat Jalan">
      <form onSubmit={submit} className="space-y-4">
        {invoices.length > 0 && (
          <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={useInvoice}
              onChange={(e) => setUseInvoice(e.target.checked)}
              className="w-5 h-5 accent-teal-400"
            />
            <span className="text-sm text-slate-200">
              Tautkan ke invoice penjualan
            </span>
          </label>
        )}
        {useInvoice && invoices.length > 0 && (
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Invoice *
            </span>
            <select
              aria-label="Invoice"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id} className="text-slate-900">
                  {inv.invoice_number} — {inv.customer_name ?? "—"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal Pengiriman *
            </span>
            <input
              type="date"
              aria-label="Tanggal pengiriman"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <GlassInput
            id="sj-penerima"
            label="Nama Penerima"
            placeholder="mis. Budi Santoso"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        </div>
        <GlassInput
          id="sj-catatan"
          label="Catatan (opsional)"
          placeholder="mis. Diantar via ekspedisi"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan Surat Jalan"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Pratinjau cetak Surat Jalan (barang diambil dari invoice tertaut)
// ---------------------------------------------------------------------------

function SjPrintPreview({
  dn,
  letterhead,
  onClose,
}: {
  dn: DeliveryNoteRow;
  letterhead: CompanyLetterhead;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<PrintLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!dn.invoice_id) {
      setLines([]);
      return;
    }
    getInvoiceDetail(dn.invoice_id).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setLines(
          res.invoice.lines.map((l, i) => ({
            no: i + 1,
            description: `${l.sku ?? ""} — ${l.product_name ?? "Produk"}`.trim(),
            qty: formatQty(l.quantity),
            unit: l.unit ?? "",
            unitPrice: formatIDR(l.unit_price),
            total: formatIDR(l.line_total),
          }))
        );
      } else {
        setError(res.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [dn.invoice_id]);

  if (error) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau Surat Jalan">
        <ErrorAlert message={error} />
      </GlassModal>
    );
  }
  if (lines === null) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau Surat Jalan">
        <p className="text-sm text-slate-300/70 text-center py-8">
          Memuat rincian barang…
        </p>
      </GlassModal>
    );
  }

  return (
    <PrintPreview
      open
      onClose={onClose}
      title="Surat Jalan"
      letterhead={letterhead}
      meta={[
        ["Nomor SJ", dn.delivery_number],
        ["Tanggal", formatTanggal(dn.delivery_date)],
        ["Invoice", dn.invoice_number ?? "—"],
        ["Pelanggan", dn.customer_name ?? "—"],
        ["Penerima", dn.recipient_name ?? "—"],
        ["Status", SJ_STATUS_LABEL[dn.status] ?? dn.status],
      ]}
      lines={lines}
      totals={[]}
      notes={dn.notes}
      extraBlock={
        lines.length === 0 ? (
          <p className="text-sm text-slate-300/80 rounded-xl border border-white/15 bg-white/5 px-4 py-3 mb-5">
            Surat jalan ini tidak ditautkan ke invoice — rincian barang diisi
            manual pada dokumen cetak.
          </p>
        ) : undefined
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

export function SuratJalanClient({
  deliveryNotes,
  invoices,
  letterhead,
}: {
  deliveryNotes: DeliveryNoteRow[];
  invoices: InvoiceOption[];
  letterhead: CompanyLetterhead;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [showBuat, setShowBuat] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<DeliveryNoteRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return deliveryNotes;
    return deliveryNotes.filter(
      (d) =>
        d.delivery_number.toLowerCase().includes(s) ||
        (d.invoice_number ?? "").toLowerCase().includes(s) ||
        (d.recipient_name ?? "").toLowerCase().includes(s)
    );
  }, [deliveryNotes, q]);

  const runAction = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setActionError(res.error ?? "Aksi gagal. Silakan coba lagi.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="fin-view on">
      {actionError && (
        <div style={{ marginBottom: "14px" }}>
          <ErrorAlert message={actionError} />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Surat Jalan Pengiriman</h3>
            <p>
              Menampilkan {filtered.length} dari {deliveryNotes.length} dokumen pengiriman
            </p>
          </div>
          <div className="spacer" />
          <div className="search-box">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Cari nomor SJ, invoice, penerima…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowBuat(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Surat Jalan
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Nomor SJ</th>
                <th>Invoice</th>
                <th style={{ width: "130px" }}>Tanggal</th>
                <th>Penerima</th>
                <th style={{ width: "130px" }}>Status</th>
                <th style={{ width: "200px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-note">
                      {deliveryNotes.length === 0
                        ? "Belum ada surat jalan. Buat surat jalan pertama Anda."
                        : "Tidak ada surat jalan yang cocok dengan pencarian."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono font-semibold whitespace-nowrap">
                      {d.delivery_number}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {d.invoice_number ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatTanggal(d.delivery_date)}
                    </td>
                    <td className="!whitespace-normal min-w-[140px]">
                      {d.recipient_name ?? "—"}
                    </td>
                    <td>
                      <StatusBadge status={d.status} map={SJ_STATUS_LABEL} />
                    </td>
                    <td className="!text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <GlassButton
                          variant="ghost"
                          onClick={() => setPreviewTarget(d)}
                          className="!min-h-[40px] !px-3 !text-[13px]"
                        >
                          Pratinjau
                        </GlassButton>
                        {d.status === "draft" && (
                          <GlassButton
                            onClick={() =>
                              runAction(() => shipDeliveryNote({ id: d.id }))
                            }
                            disabled={pending}
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            Kirim
                          </GlassButton>
                        )}
                        {d.status === "shipped" && (
                          <GlassButton
                            onClick={() =>
                              runAction(() => deliverDeliveryNote({ id: d.id }))
                            }
                            disabled={pending}
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            Tandai Diterima
                          </GlassButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="fin-note">
        Alur: Draf → Dikirim → Diterima. Rincian barang diambil dari invoice yang ditautkan.
      </p>

      {showBuat && (
        <BuatSjModal invoices={invoices} onClose={() => setShowBuat(false)} />
      )}
      {previewTarget && (
        <SjPrintPreview
          dn={previewTarget}
          letterhead={letterhead}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}
