"use client";

/**
 * ============================================================================
 * KOMPONEN DAFTAR PRODUK & OPERASI STOK (PRODUCT & STOCK CLIENT)
 * ============================================================================
 * 
 * Pengelolaan katalog produk barang dan aksi pergerakan stok:
 * 1. Tabel Produk: SKU, nama produk, kategori, stok fisik per gudang, HPP rata-rata, harga jual, dan status ketersediaan.
 * 2. Operasi Cepat:
 *    - Stok Masuk (Penerimaan/Pembelian).
 *    - Stok Keluar (Penjualan/Pemakaian Internal).
 *    - Opname Fisik (Stock Opname penyesuaian selisih fisik vs sistem).
 * 3. Modal Tambah Produk Baru: Penetapan master item, satuan, dan batas stok minimum (reorder point).
 * ============================================================================
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { formatIDR } from "@/lib/format";
import {
  createProduct,
  recordStockIn,
  recordStockOut,
  recordOpname,
} from "../actions";
import {
  formatIDR2,
  formatQty,
  todayISO,
  type ProductWithWarehouse,
} from "../_lib/inventory";

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: number;
  avg_cost: number;
};

/** "1.234,56" (id) atau "1234.56" (en) → number; NaN bila tak valid. */
function parseDecimal(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  return Number(normalized);
}

function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
    >
      {message}
    </p>
  );
}

function ModalActions({
  onClose,
  pending,
  submitLabel,
  canSave,
}: {
  onClose: () => void;
  pending: boolean;
  submitLabel: string;
  canSave: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
      <GlassButton
        type="button"
        variant="ghost"
        onClick={onClose}
        disabled={pending}
        className="w-full sm:w-auto"
      >
        Batal
      </GlassButton>
      <GlassButton
        type="submit"
        disabled={!canSave}
        className="w-full sm:w-auto"
      >
        {pending ? "Menyimpan…" : submitLabel}
      </GlassButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Tambah Produk
// ---------------------------------------------------------------------------

function TambahProdukModal({
  warehouses,
  onClose,
}: {
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState("0");
  const [initialStock, setInitialStock] = useState("0");
  const [initialCost, setInitialCost] = useState("0");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const needsWarehouse = parseDecimal(initialStock) > 0;
  const canSave =
    sku.trim().length > 0 && name.trim().length > 0 && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        minStock: parseDecimal(minStock),
        initialStock: parseDecimal(initialStock),
        initialUnitCost: parseDecimal(initialCost),
        warehouseId: needsWarehouse ? warehouseId : undefined,
        mutationDate: todayISO(),
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
    <GlassModal open onClose={onClose} title="Tambah Produk">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="produk-sku"
            label="SKU / Kode *"
            placeholder="mis. BRG-001"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
          <GlassInput
            id="produk-nama"
            label="Nama Produk *"
            placeholder="mis. Kopi Arabika 250g"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassInput
            id="produk-kategori"
            label="Kategori"
            placeholder="mis. Bahan Baku"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <GlassInput
            id="produk-satuan"
            label="Satuan"
            placeholder="pcs"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <GlassInput
            id="produk-minstok"
            label="Stok Minimum"
            placeholder="0"
            inputMode="decimal"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-200">
            Stok Awal (opsional)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              id="produk-stokawal"
              label="Jumlah Stok Awal"
              placeholder="0"
              inputMode="decimal"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
            />
            <GlassInput
              id="produk-hppawal"
              label="HPP per Unit (Rp)"
              placeholder="0"
              inputMode="decimal"
              value={initialCost}
              onChange={(e) => setInitialCost(e.target.value)}
            />
          </div>
          {needsWarehouse && (
            <div>
              <span className="block text-sm font-medium text-slate-200 mb-1.5">
                Gudang Stok Awal *
              </span>
              <select
                aria-label="Gudang stok awal"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
              >
                {warehouses.length === 0 && (
                  <option value="" className="text-slate-900">
                    — Belum ada gudang —
                  </option>
                )}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="text-slate-900">
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-slate-400/80">
            Stok awal dibukukan sebagai mutasi “Saldo Awal” dan membentuk HPP
            average pertama produk.
          </p>
        </div>

        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan Produk"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal: Stok Masuk
// ---------------------------------------------------------------------------

function StokMasukModal({
  products,
  warehouses,
  onClose,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = productId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordStockIn({
        productId,
        warehouseId,
        quantity: parseDecimal(qty),
        unitCost: parseDecimal(unitCost),
        mutationDate: date,
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
    <GlassModal open onClose={onClose} title="Stok Masuk">
      <form onSubmit={submit} className="space-y-4">
        <ProductSelect
          id="masuk-produk"
          label="Produk *"
          products={products}
          value={productId}
          onChange={setProductId}
        />
        <WarehouseSelect
          id="masuk-gudang"
          label="Gudang *"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="masuk-qty"
            label="Jumlah Masuk *"
            placeholder="mis. 100"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <GlassInput
            id="masuk-hpp"
            label="HPP per Unit (Rp) *"
            placeholder="mis. 25000"
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal *
            </span>
            <input
              type="date"
              aria-label="Tanggal mutasi"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <GlassInput
            id="masuk-catatan"
            label="Catatan (opsional)"
            placeholder="mis. PO-2026-0001"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-400/80">
          HPP average dihitung ulang otomatis: (stok lama × HPP lama + jumlah ×
          HPP baru) ÷ stok baru.
        </p>
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Catat Stok Masuk"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal: Stok Keluar
// ---------------------------------------------------------------------------

function StokKeluarModal({
  products,
  warehouses,
  onClose,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId);
  const canSave = productId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordStockOut({
        productId,
        warehouseId,
        quantity: parseDecimal(qty),
        mutationDate: date,
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
    <GlassModal open onClose={onClose} title="Stok Keluar">
      <form onSubmit={submit} className="space-y-4">
        <ProductSelect
          id="keluar-produk"
          label="Produk *"
          products={products}
          value={productId}
          onChange={setProductId}
        />
        {selected && (
          <p className="text-sm text-slate-300/80 -mt-2">
            Stok tersedia:{" "}
            <span className="font-semibold text-slate-100">
              {formatQty(selected.current_stock)} {selected.unit}
            </span>{" "}
            · HPP {formatIDR2(selected.avg_cost)}
          </p>
        )}
        <WarehouseSelect
          id="keluar-gudang"
          label="Gudang *"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="keluar-qty"
            label="Jumlah Keluar *"
            placeholder="mis. 10"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal *
            </span>
            <input
              type="date"
              aria-label="Tanggal mutasi"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
        </div>
        <GlassInput
          id="keluar-catatan"
          label="Catatan (opsional)"
          placeholder="mis. INV-2026-0001"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="text-xs text-slate-400/80">
          Stok keluar dinilai pada HPP average berjalan; HPP average tidak
          berubah.
        </p>
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Catat Stok Keluar"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Modal: Stok Opname
// ---------------------------------------------------------------------------

function OpnameModal({
  products,
  warehouses,
  onClose,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [physical, setPhysical] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId);
  const physicalNum = parseDecimal(physical);
  const diff =
    selected && Number.isFinite(physicalNum)
      ? Math.round((physicalNum - selected.current_stock) * 1000) / 1000
      : null;
  const canSave = productId !== "" && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await recordOpname({
        productId,
        warehouseId,
        physicalCount: parseDecimal(physical),
        mutationDate: date,
        notes: notes.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.noDiff) {
        setInfo("Tidak ada selisih — hitungan fisik sama dengan stok sistem.");
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Stok Opname">
      <form onSubmit={submit} className="space-y-4">
        <ProductSelect
          id="opname-produk"
          label="Produk *"
          products={products}
          value={productId}
          onChange={setProductId}
        />
        {selected && (
          <p className="text-sm text-slate-300/80 -mt-2">
            Stok sistem:{" "}
            <span className="font-semibold text-slate-100">
              {formatQty(selected.current_stock)} {selected.unit}
            </span>
          </p>
        )}
        <WarehouseSelect
          id="opname-gudang"
          label="Gudang *"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="opname-fisik"
            label="Hasil Hitung Fisik *"
            placeholder="mis. 98"
            inputMode="decimal"
            value={physical}
            onChange={(e) => setPhysical(e.target.value)}
          />
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal *
            </span>
            <input
              type="date"
              aria-label="Tanggal opname"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
        </div>
        {diff !== null && (
          <p
            className={`text-sm font-semibold rounded-xl px-4 py-3 border ${
              diff > 0
                ? "text-teal-200 bg-teal-400/10 border-teal-300/40"
                : diff < 0
                  ? "text-amber-200 bg-amber-400/10 border-amber-300/40"
                  : "text-slate-200 bg-white/5 border-white/20"
            }`}
          >
            Selisih:{" "}
            {diff > 0
              ? `+${formatQty(diff)} (kelebihan — stok masuk penyesuaian)`
              : diff < 0
                ? `${formatQty(diff)} (kekurangan — stok keluar penyesuaian)`
                : "0 (tidak ada selisih)"}
          </p>
        )}
        <GlassInput
          id="opname-catatan"
          label="Catatan (opsional)"
          placeholder="mis. Opname bulanan Oktober"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {info && (
          <p className="text-sm font-medium text-teal-200 bg-teal-400/10 border border-teal-300/40 rounded-xl px-4 py-3">
            {info}
          </p>
        )}
        <ErrorAlert message={error} />
        <ModalActions
          onClose={onClose}
          pending={pending}
          submitLabel="Simpan Hasil Opname"
          canSave={canSave}
        />
      </form>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Pemilih (dropdown) bersama
// ---------------------------------------------------------------------------

function ProductSelect({
  id,
  label,
  products,
  value,
  onChange,
}: {
  id: string;
  label: string;
  products: ProductOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-slate-200 mb-1.5">
        {label}
      </span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
      >
        {products.length === 0 && (
          <option value="" className="text-slate-900">
            — Belum ada produk —
          </option>
        )}
        {products.map((p) => (
          <option key={p.id} value={p.id} className="text-slate-900">
            {p.sku} — {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function WarehouseSelect({
  id,
  label,
  warehouses,
  value,
  onChange,
}: {
  id: string;
  label: string;
  warehouses: WarehouseOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-slate-200 mb-1.5">
        {label}
      </span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
      >
        {warehouses.length === 0 && (
          <option value="" className="text-slate-900">
            — Belum ada gudang —
          </option>
        )}
        {warehouses.map((w) => (
          <option key={w.id} value={w.id} className="text-slate-900">
            {w.code} — {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen utama: tabel produk
// ---------------------------------------------------------------------------

export function ProdukClient({
  products,
  warehouses,
}: {
  products: ProductWithWarehouse[];
  warehouses: WarehouseOption[];
}) {
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("semua");
  const [showTambah, setShowTambah] = useState(false);
  const [showMasuk, setShowMasuk] = useState(false);
  const [showKeluar, setShowKeluar] = useState(false);
  const [showOpname, setShowOpname] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "id"));
  }, [products]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "semua" && (p.category ?? "") !== categoryFilter)
        return false;
      if (!s) return true;
      return (
        p.sku.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s)
      );
    });
  }, [products, q, categoryFilter]);

  const productOptions: ProductOption[] = useMemo(
    () =>
      products
        .filter((p) => p.is_active)
        .map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          current_stock: p.current_stock,
          avg_cost: p.avg_cost,
        })),
    [products]
  );

  const canMoveStock = productOptions.length > 0 && warehouses.length > 0;

  return (
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Master Produk &amp; Stok</h3>
            <p>
              Menampilkan {filtered.length} dari {products.length} produk terdaftar
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
              placeholder="Cari SKU atau nama produk…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter kategori"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select"
          >
            <option value="semua">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowTambah(true)}
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
            Tambah Produk
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowMasuk(true)}
            disabled={!canMoveStock}
          >
            Stok Masuk
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowKeluar(true)}
            disabled={!canMoveStock}
          >
            Stok Keluar
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowOpname(true)}
            disabled={!canMoveStock}
          >
            Opname
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>SKU</th>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Gudang</th>
                <th className="num">Stok</th>
                <th className="num">Stok Min</th>
                <th className="num">HPP Average</th>
                <th className="num">Nilai Persediaan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-note">
                      {products.length === 0
                        ? "Belum ada produk. Tambahkan produk pertama Anda."
                        : "Tidak ada produk yang cocok dengan pencarian."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const lowStock =
                    p.min_stock > 0 && p.current_stock <= p.min_stock;
                  return (
                    <tr key={p.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {p.sku}
                      </td>
                      <td>
                        {p.name}
                        {!p.is_active && (
                          <span
                            className="badge b-gray"
                            style={{ marginLeft: "8px", fontSize: "10.5px", padding: "1px 7px" }}
                          >
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--ink-2)" }}>
                        {p.category || "—"}
                      </td>
                      <td style={{ color: "var(--ink-2)" }}>
                        {p.latestWarehouseCode
                          ? `${p.latestWarehouseCode} — ${p.latestWarehouseName ?? ""}`
                          : "—"}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatQty(p.current_stock)}{" "}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          {p.unit}
                        </span>
                        {lowStock && (
                          <span
                            className="badge b-amber"
                            style={{ marginLeft: "8px", fontSize: "10.5px", padding: "1px 7px" }}
                          >
                            Stok Menipis
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {formatQty(p.min_stock)} {p.unit}
                      </td>
                      <td className="num">{formatIDR2(p.avg_cost)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatIDR(p.current_stock * p.avg_cost)}
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
        Kolom &quot;Gudang&quot; menunjukkan gudang mutasi terakhir tiap produk. Stok adalah total seluruh gudang; HPP memakai metode Average.
      </p>

      {showTambah && (
        <TambahProdukModal
          warehouses={warehouses}
          onClose={() => setShowTambah(false)}
        />
      )}
      {showMasuk && (
        <StokMasukModal
          products={productOptions}
          warehouses={warehouses}
          onClose={() => setShowMasuk(false)}
        />
      )}
      {showKeluar && (
        <StokKeluarModal
          products={productOptions}
          warehouses={warehouses}
          onClose={() => setShowKeluar(false)}
        />
      )}
      {showOpname && (
        <OpnameModal
          products={productOptions}
          warehouses={warehouses}
          onClose={() => setShowOpname(false)}
        />
      )}
    </div>
  );
}
