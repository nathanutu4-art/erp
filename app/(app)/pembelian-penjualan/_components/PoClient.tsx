"use client";

/**
 * ============================================================================
 * KOMPONEN PURCHASE ORDER (PURCHASE ORDER CLIENT)
 * ============================================================================
 * 
 * Pengelolaan siklus pesanan pembelian ke supplier:
 * 1. Tabel PO: Nomor PO (PO-YYYY-NNNN), supplier, tanggal order, total nilai, status approval, dan status penerimaan barang.
 * 2. Form Pembuatan PO: Baris item barang dinamis, kuantitas, harga beli, dan pemilihan gudang tujuan.
 * 3. Penerimaan Barang (Goods Receipt): Pencatatan barang yang telah tiba di gudang dan otomatis mengupdate stok fisik.
 * 4. Pratinjau Dokumen Cetak: Menampilkan PO format cetak resmi dengan kop surat perusahaan.
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
  PO_STATUS_LABEL,
  parseDecimal,
  todayISO,
  type CompanyLetterhead,
  type PoDetail,
  type PoRow,
  type ProductOption,
  type SupplierOption,
  type WarehouseOption,
} from "../_lib/jualbeli";
import {
  ErrorAlert,
  ModalActions,
  StatusBadge,
  EmptyState,
  SupplierSelect,
  WarehouseSelect,
  ProductLinesEditor,
  type LineDraft,
} from "./shared";
import { PrintPreview, type PrintLine } from "./PrintPreview";
import {
  createPO,
  submitPO,
  decidePO,
  receivePO,
  getPoDetail,
} from "../actions";

// ---------------------------------------------------------------------------
// Modal: Buat PO
// ---------------------------------------------------------------------------

function BuatPoModal({
  suppliers,
  products,
  onClose,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState(
    suppliers.find((s) => s.is_active)?.id ?? ""
  );
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [withPpn, setWithPpn] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([
    { key: 1, productId: "", qty: "", price: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const canSave = supplierId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPO({
        supplierId,
        orderDate,
        expectedDate: expectedDate || undefined,
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
    <GlassModal open onClose={onClose} title="Buat Purchase Order">
      <form onSubmit={submit} className="space-y-4">
        <SupplierSelect
          id="po-pemasok"
          label="Pemasok *"
          suppliers={suppliers}
          value={supplierId}
          onChange={setSupplierId}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal PO *
            </span>
            <input
              type="date"
              aria-label="Tanggal PO"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Estimasi Datang
            </span>
            <input
              type="date"
              aria-label="Estimasi datang"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
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
        <GlassInput
          id="po-catatan"
          label="Catatan (opsional)"
          placeholder="mis. Untuk restock bulanan"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan PO"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal: Terima Barang
// ---------------------------------------------------------------------------

function TerimaBarangModal({
  po,
  warehouses,
  onClose,
}: {
  po: PoRow;
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const canSave = warehouseId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await receivePO({
        poId: po.id,
        warehouseId,
        receivedDate,
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
    <GlassModal open onClose={onClose} title={`Terima Barang — ${po.po_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-300/85 leading-relaxed">
          Seluruh baris PO akan dibukukan sebagai{" "}
          <span className="font-semibold text-slate-100">stok masuk</span>{" "}
          dengan HPP average yang dihitung ulang otomatis. Ini adalah alur
          lintas-modul: Pembelian menggerakkan Inventaris.
        </p>
        <WarehouseSelect
          id="terima-gudang"
          label="Gudang Penerima *"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <div>
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Tanggal Penerimaan *
          </span>
          <input
            type="date"
            aria-label="Tanggal penerimaan"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
          />
        </div>
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Terima & Bukukan Stok"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Pratinjau cetak PO
// ---------------------------------------------------------------------------

function PoPrintPreview({
  po,
  letterhead,
  onClose,
}: {
  po: PoRow;
  letterhead: CompanyLetterhead;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPoDetail(po.id).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.po);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [po.id]);

  if (error) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau PO">
        <ErrorAlert message={error} />
      </GlassModal>
    );
  }
  if (!detail) {
    return (
      <GlassModal open onClose={onClose} title="Pratinjau PO">
        <p className="text-sm text-slate-300/70 text-center py-8">
          Memuat detail PO…
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

  return (
    <PrintPreview
      open
      onClose={onClose}
      title="Purchase Order"
      letterhead={letterhead}
      meta={[
        ["Nomor PO", detail.po_number],
        ["Tanggal", formatTanggal(detail.order_date)],
        ["Pemasok", detail.supplier_name ?? "—"],
        ["Status", PO_STATUS_LABEL[detail.status] ?? detail.status],
        [
          "Estimasi Datang",
          detail.expected_date ? formatTanggal(detail.expected_date) : "—",
        ],
      ]}
      lines={lines}
      totals={[
        ["Subtotal", formatIDR(detail.subtotal)],
        ["PPN 11%", formatIDR(detail.tax_amount)],
        ["Total", formatIDR(detail.total_amount), true],
      ]}
      notes={detail.notes}
    />
  );
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ["semua", "draft", "pending", "approved", "rejected", "done"] as const;

export function PoClient({
  pos,
  suppliers,
  products,
  warehouses,
  letterhead,
}: {
  pos: PoRow[];
  suppliers: SupplierOption[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  letterhead: CompanyLetterhead;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("semua");
  const [showBuat, setShowBuat] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PoRow | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PoRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pos.filter((p) => {
      if (statusFilter !== "semua" && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        p.po_number.toLowerCase().includes(s) ||
        (p.supplier_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [pos, q, statusFilter]);

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

  const canCreate =
    suppliers.some((s) => s.is_active) && products.some((p) => p.is_active);

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
            <h3>Pesanan Pembelian (Purchase Order)</h3>
            <p>
              Menampilkan {filtered.length} dari {pos.length} pesanan pembelian
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
              placeholder="Cari nomor PO atau pemasok…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter status PO"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "semua" ? "Semua Status" : (PO_STATUS_LABEL[s] ?? s)}
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
                : "Butuh minimal 1 pemasok aktif dan 1 produk aktif"
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
            Buat PO
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Nomor PO</th>
                <th>Pemasok</th>
                <th style={{ width: "130px" }}>Tanggal</th>
                <th className="num" style={{ width: "160px" }}>
                  Total
                </th>
                <th style={{ width: "130px" }}>Status</th>
                <th style={{ width: "180px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-note">
                      {pos.length === 0
                        ? "Belum ada purchase order. Buat PO pertama Anda."
                        : "Tidak ada PO yang cocok dengan pencarian."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono font-semibold whitespace-nowrap">
                      {p.po_number}
                    </td>
                    <td className="!whitespace-normal min-w-[160px]">
                      {p.supplier_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatTanggal(p.order_date)}
                    </td>
                    <td className="!text-right font-semibold whitespace-nowrap">
                      {formatIDR(p.total_amount)}
                    </td>
                    <td>
                      <StatusBadge status={p.status} map={PO_STATUS_LABEL} />
                    </td>
                    <td className="!text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <GlassButton
                          variant="ghost"
                          onClick={() => setPreviewTarget(p)}
                          className="!min-h-[40px] !px-3 !text-[13px]"
                        >
                          Pratinjau
                        </GlassButton>
                        {p.status === "draft" && (
                          <GlassButton
                            onClick={() => runAction(() => submitPO({ poId: p.id }))}
                            disabled={pending}
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            Ajukan
                          </GlassButton>
                        )}
                        {p.status === "pending" && (
                          <>
                            <GlassButton
                              onClick={() =>
                                runAction(() =>
                                  decidePO({ poId: p.id, decision: "approved" })
                                )
                              }
                              disabled={pending}
                              className="!min-h-[40px] !px-3 !text-[13px]"
                            >
                              Setujui
                            </GlassButton>
                            <GlassButton
                              variant="danger"
                              onClick={() =>
                                runAction(() =>
                                  decidePO({ poId: p.id, decision: "rejected" })
                                )
                              }
                              disabled={pending}
                              className="!min-h-[40px] !px-3 !text-[13px]"
                            >
                              Tolak
                            </GlassButton>
                          </>
                        )}
                        {p.status === "approved" && (
                          <GlassButton
                            onClick={() => setReceiveTarget(p)}
                            disabled={pending || warehouses.length === 0}
                            title={
                              warehouses.length === 0
                                ? "Buat gudang terlebih dahulu di modul Inventaris"
                                : undefined
                            }
                            className="!min-h-[40px] !px-3 !text-[13px]"
                          >
                            Terima Barang
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
        Alur: Draf → Menunggu Persetujuan → Disetujui → Selesai (barang diterima). Persetujuan oleh atasan langsung; HR dapat mengambil alih. Penerimaan barang membukukan stok masuk otomatis (HPP average).
      </p>

      {showBuat && (
        <BuatPoModal
          suppliers={suppliers}
          products={products}
          onClose={() => setShowBuat(false)}
        />
      )}
      {receiveTarget && (
        <TerimaBarangModal
          po={receiveTarget}
          warehouses={warehouses}
          onClose={() => setReceiveTarget(null)}
        />
      )}
      {previewTarget && (
        <PoPrintPreview
          po={previewTarget}
          letterhead={letterhead}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}
