"use client";

/**
 * ============================================================================
 * KOMPONEN INVOICE PENJUALAN (SALES INVOICE CLIENT)
 * ============================================================================
 * 
 * Pengelolaan faktur penjualan, pelunasan pembayaran, dan kepatuhan pajak:
 * 1. Tabel Tagihan: Nomor invoice (INV-YYYY-NNNN), pelanggan, tanggal, jatuh tempo, total tagihan, jumlah terbayar, sisa piutang, dan status bayar.
 * 2. Pembuatan Invoice: Pemilihan barang dagang, harga jual satuan, kalkulasi otomatis DPP dan PPN 11%, serta penetapan nomor Faktur Pajak.
 * 3. Catat Pembayaran: Modal pelunasan piutang (penuh atau cicil) dengan integrasi pembukuan kas/bank.
 * 4. Ekspor e-Faktur: Ekspor file format CSV sesuai skema impor DJP e-Faktur.
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
  INVOICE_STATUS_LABEL,
  parseDecimal,
  todayISO,
  type CompanyLetterhead,
  type CustomerOption,
  type InvoiceDetail,
  type InvoiceRow,
  type ProductOption,
} from "../_lib/jualbeli";
import {
  ErrorAlert,
  ModalActions,
  StatusBadge,
  EmptyState,
  CustomerSelect,
  ProductLinesEditor,
  type LineDraft,
} from "./shared";
import { PrintPreview, type PrintLine } from "./PrintPreview";
import {
  createInvoice,
  sendInvoice,
  recordInvoicePayment,
  exportEfakturCsv,
  getInvoiceDetail,
} from "../actions";

// ---------------------------------------------------------------------------
// Modal: Buat Invoice
// ---------------------------------------------------------------------------

function BuatInvoiceModal({
  customers,
  products,
  onClose,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState(
    customers.find((c) => c.is_active)?.id ?? ""
  );
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [withPpn, setWithPpn] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([
    { key: 1, productId: "", qty: "", price: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const canSave = customerId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createInvoice({
        customerId,
        invoiceDate,
        dueDate: dueDate || undefined,
        withPpn,
        notes: notes.trim(),
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: parseDecimal(l.qty),
          unitPrice: parseDecimal(l.price),
        })),
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
    <GlassModal open onClose={onClose} title="Buat Invoice Penjualan">
      <form onSubmit={submit} className="space-y-4">
        <CustomerSelect
          id="inv-pelanggan"
          label="Pelanggan *"
          customers={customers}
          value={customerId}
          onChange={setCustomerId}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal Invoice *
            </span>
            <input
              type="date"
              aria-label="Tanggal invoice"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Jatuh Tempo
            </span>
            <input
              type="date"
              aria-label="Jatuh tempo"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
        </div>
        <ProductLinesEditor
          products={products}
          lines={lines}
          onChange={setLines}
          withPpn={withPpn}
          onPpnChange={setWithPpn}
        />
        <p className="text-xs text-slate-400/80">
          Nomor Faktur Pajak diambil otomatis dari rentang NSFP aktif (D11).
        </p>
        <GlassInput
          id="inv-catatan"
          label="Catatan (opsional)"
          placeholder="mis. Termin 30 hari"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan Invoice"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal: Catat Pembayaran
// ---------------------------------------------------------------------------

function BayarModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Transfer Bank");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.round((invoice.total_amount - invoice.paid_amount) * 100) / 100;
  const canSave = !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordInvoicePayment({
        invoiceId: invoice.id,
        paymentDate,
        amount: parseDecimal(amount),
        method: method.trim(),
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
    <GlassModal open onClose={onClose} title={`Catat Pembayaran — ${invoice.invoice_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Total invoice</span>
            <span className="font-semibold text-slate-100">
              {formatIDR(invoice.total_amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sudah dibayar</span>
            <span className="font-semibold text-slate-100">
              {formatIDR(invoice.paid_amount)}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1">
            <span className="text-slate-400">Sisa tagihan</span>
            <span className="font-extrabold text-teal-200">
              {formatIDR(remaining)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal Bayar *
            </span>
            <input
              type="date"
              aria-label="Tanggal pembayaran"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <GlassInput
            id="bayar-metode"
            label="Metode"
            placeholder="mis. Transfer Bank"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
        </div>
        <GlassInput
          id="bayar-nominal"
          label="Nominal (Rp) *"
          placeholder={String(Math.round(remaining))}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <GlassInput
          id="bayar-catatan"
          label="Catatan (opsional)"
          placeholder="mis. Pelunasan termin 1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan Pembayaran"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Pratinjau cetak Invoice
// ---------------------------------------------------------------------------

function InvoicePrintPreview({
  invoice,
  letterhead,
  onClose,
}: {
  invoice: InvoiceRow;
  letterhead: CompanyLetterhead;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getInvoiceDetail(invoice.id).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.invoice);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [invoice.id]);

  if (error) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau Invoice">
        <ErrorAlert message={error} />
      </GlassModal>
    );
  }
  if (!detail) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau Invoice">
        <p className="text-sm text-slate-300/70 text-center py-8">
          Memuat detail invoice…
        </p>
      </GlassModal>
    );
  }

  const lines: PrintLine[] = detail.lines.map((l, i) => ({
    no: i + 1,
    description: `${l.sku ?? ""} — ${l.product_name ?? "Produk"}`.trim(),
    qty: formatQty(l.quantity),
    unit: l.unit ?? "",
    unitPrice: formatIDR(l.unit_price),
    total: formatIDR(l.line_total),
  }));

  const remaining =
    Math.round((detail.total_amount - detail.paid_amount) * 100) / 100;

  return (
    <PrintPreview
      open
      onClose={onClose}
      title="Invoice Penjualan"
      letterhead={letterhead}
      meta={[
        ["Nomor Invoice", detail.invoice_number],
        ["Tanggal", formatTanggal(detail.invoice_date)],
        ["Pelanggan", detail.customer_name ?? "—"],
        ["Status", INVOICE_STATUS_LABEL[detail.status] ?? detail.status],
        [
          "Jatuh Tempo",
          detail.due_date ? formatTanggal(detail.due_date) : "—",
        ],
        ["No. Faktur Pajak", detail.faktur_pajak_number ?? "—"],
      ]}
      lines={lines}
      totals={[
        ["Subtotal", formatIDR(detail.subtotal)],
        ["PPN 11%", formatIDR(detail.tax_amount)],
        ["Total", formatIDR(detail.total_amount), true],
        ["Dibayar", formatIDR(detail.paid_amount)],
        ["Sisa", formatIDR(remaining)],
      ]}
      notes={detail.notes}
      extraBlock={
        detail.faktur_pajak_number ? (
          <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm mb-5">
            <p className="text-xs text-slate-400">Faktur Pajak (D11)</p>
            <p className="font-mono font-bold text-slate-100">
              {detail.faktur_pajak_number}
            </p>
          </div>
        ) : (
          <p className="text-xs text-amber-200/90 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 mb-5">
            Invoice ini belum memiliki Nomor Faktur Pajak — rentang NSFP
            belum diisi.
          </p>
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ["semua", "draft", "sent", "partial", "paid", "overdue"] as const;

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function InvoiceClient({
  invoices,
  customers,
  products,
  letterhead,
}: {
  invoices: InvoiceRow[];
  customers: CustomerOption[];
  products: ProductOption[];
  letterhead: CompanyLetterhead;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("semua");
  const [showBuat, setShowBuat] = useState(false);
  const [payTarget, setPayTarget] = useState<InvoiceRow | null>(null);
  const [previewTarget, setPreviewTarget] = useState<InvoiceRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "semua" && inv.status !== statusFilter) return false;
      if (!s) return true;
      return (
        inv.invoice_number.toLowerCase().includes(s) ||
        (inv.customer_name ?? "").toLowerCase().includes(s) ||
        (inv.faktur_pajak_number ?? "").toLowerCase().includes(s)
      );
    });
  }, [invoices, q, statusFilter]);

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

  const handleEfaktur = (inv: InvoiceRow) => {
    setActionError(null);
    startTransition(async () => {
      const res = await exportEfakturCsv({ invoiceId: inv.id });
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      if (!res.csv || !res.filename) {
        setActionError("Gagal mengekspor e-Faktur.");
        return;
      }
      downloadCsv(res.csv, res.filename);
    });
  };

  const canCreate =
    customers.some((c) => c.is_active) && products.some((p) => p.is_active);

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
            <h3>Faktur Penjualan (Sales Invoice)</h3>
            <p>
              Menampilkan {filtered.length} dari {invoices.length} faktur penjualan
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
              placeholder="Cari nomor invoice, pelanggan, atau NSFP…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter status invoice"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "semua"
                  ? "Semua Status"
                  : (INVOICE_STATUS_LABEL[s] ?? s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowBuat(true)}
            disabled={!canCreate}
            title={
              canCreate
                ? undefined
                : "Butuh minimal 1 pelanggan aktif dan 1 produk aktif"
            }
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
            Buat Invoice
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "150px" }}>Nomor</th>
                <th>Pelanggan</th>
                <th style={{ width: "120px" }}>Tanggal</th>
                <th>No. Faktur Pajak</th>
                <th className="num">Total</th>
                <th className="num">Sisa</th>
                <th style={{ width: "120px" }}>Status</th>
                <th style={{ width: "240px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-note">
                      {invoices.length === 0
                        ? "Belum ada invoice penjualan. Buat invoice pertama Anda."
                        : "Tidak ada invoice yang cocok dengan pencarian."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const remaining =
                    Math.round((inv.total_amount - inv.paid_amount) * 100) / 100;
                  const payable = ["sent", "partial"].includes(inv.status);
                  return (
                    <tr key={inv.id}>
                      <td className="font-mono font-semibold whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="!whitespace-normal min-w-[160px]">
                        {inv.customer_name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatTanggal(inv.invoice_date)}
                      </td>
                      <td className="font-mono text-xs whitespace-nowrap">
                        {inv.faktur_pajak_number ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="!text-right font-semibold whitespace-nowrap">
                        {formatIDR(inv.total_amount)}
                      </td>
                      <td className="!text-right whitespace-nowrap">
                        {formatIDR(remaining)}
                      </td>
                      <td>
                        <StatusBadge status={inv.status} map={INVOICE_STATUS_LABEL} />
                      </td>
                      <td className="!text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <GlassButton
                            variant="ghost"
                            onClick={() => setPreviewTarget(inv)}
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            Pratinjau
                          </GlassButton>
                          {inv.status === "draft" && (
                            <GlassButton
                              onClick={() =>
                                runAction(() => sendInvoice({ invoiceId: inv.id }))
                              }
                              disabled={pending}
                              className="!min-h-[40px] !px-3 !text-[13px]"
                            >
                              Kirim
                            </GlassButton>
                          )}
                          {payable && (
                            <GlassButton
                              onClick={() => setPayTarget(inv)}
                              disabled={pending}
                              className="!min-h-[40px] !px-3 !text-[13px]"
                            >
                              Bayar
                            </GlassButton>
                          )}
                          <GlassButton
                            variant="ghost"
                            onClick={() => handleEfaktur(inv)}
                            disabled={pending || !inv.faktur_pajak_number}
                            title={
                              inv.faktur_pajak_number
                                ? "Unduh CSV format impor e-Faktur DJP"
                                : "Belum ada Nomor Faktur Pajak"
                            }
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            e-Faktur
                          </GlassButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="fin-note">
        Nomor Faktur Pajak diambil otomatis dari rentang NSFP aktif. Tombol e-Faktur mengunduh CSV format impor aplikasi e-Faktur DJP.
      </p>

      {showBuat && (
        <BuatInvoiceModal
          customers={customers}
          products={products}
          onClose={() => setShowBuat(false)}
        />
      )}
      {payTarget && (
        <BayarModal invoice={payTarget} onClose={() => setPayTarget(null)} />
      )}
      {previewTarget && (
        <InvoicePrintPreview
          invoice={previewTarget}
          letterhead={letterhead}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}
