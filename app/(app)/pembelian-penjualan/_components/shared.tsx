"use client";

import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { formatIDR, formatTanggal } from "@/lib/format";
import { formatQty } from "@/app/(app)/inventaris/_lib/inventory";
import {
  parseDecimal,
  statusBadgeClass,
  statusLabel,
  type CustomerOption,
  type ProductOption,
  type SupplierOption,
  type WarehouseOption,
} from "../_lib/jualbeli";

// ---------------------------------------------------------------------------
// Alert & aksi modal (mengikuti pola modul Inventaris)
// ---------------------------------------------------------------------------

export function ErrorAlert({ message }: { message: string | null }) {
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

export function ModalActions({
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

export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, string>;
}) {
  return (
    <span
      className={`inline-block text-[11px] font-semibold rounded-full px-2.5 py-1 border whitespace-nowrap ${statusBadgeClass(status)}`}
    >
      {statusLabel(status, map)}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-300/70 text-center py-10 px-4">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Pemilih (dropdown) bersama
// ---------------------------------------------------------------------------

function SelectShell({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
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
        {children}
      </select>
    </div>
  );
}

export function SupplierSelect({
  id,
  label,
  suppliers,
  value,
  onChange,
}: {
  id: string;
  label: string;
  suppliers: SupplierOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const active = suppliers.filter((s) => s.is_active);
  return (
    <SelectShell id={id} label={label} value={value} onChange={onChange}>
      {active.length === 0 && (
        <option value="" className="text-slate-900">
          — Belum ada pemasok aktif —
        </option>
      )}
      {active.map((s) => (
        <option key={s.id} value={s.id} className="text-slate-900">
          {s.code} — {s.name}
        </option>
      ))}
    </SelectShell>
  );
}

export function CustomerSelect({
  id,
  label,
  customers,
  value,
  onChange,
}: {
  id: string;
  label: string;
  customers: CustomerOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const active = customers.filter((c) => c.is_active);
  return (
    <SelectShell id={id} label={label} value={value} onChange={onChange}>
      {active.length === 0 && (
        <option value="" className="text-slate-900">
          — Belum ada pelanggan aktif —
        </option>
      )}
      {active.map((c) => (
        <option key={c.id} value={c.id} className="text-slate-900">
          {c.code} — {c.name}
        </option>
      ))}
    </SelectShell>
  );
}

export function WarehouseSelect({
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
    <SelectShell id={id} label={label} value={value} onChange={onChange}>
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
    </SelectShell>
  );
}

// ---------------------------------------------------------------------------
// Editor baris produk dinamis (dipakai PO & Invoice)
// ---------------------------------------------------------------------------

export type LineDraft = {
  key: number;
  productId: string;
  qty: string;
  price: string;
};

export function ProductLinesEditor({
  products,
  lines,
  onChange,
  withPpn,
  onPpnChange,
}: {
  products: ProductOption[];
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  withPpn: boolean;
  onPpnChange: (v: boolean) => void;
}) {
  const active = products.filter((p) => p.is_active);

  const setLine = (key: number, patch: Partial<LineDraft>) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const addLine = () =>
    onChange([
      ...lines,
      {
        key: Math.max(0, ...lines.map((l) => l.key)) + 1,
        productId: active[0]?.id ?? "",
        qty: "",
        price: "",
      },
    ]);
  const removeLine = (key: number) =>
    onChange(lines.filter((l) => l.key !== key));

  const subtotal = lines.reduce((acc, l) => {
    const q = parseDecimal(l.qty);
    const pr = parseDecimal(l.price);
    if (!Number.isFinite(q) || !Number.isFinite(pr) || q <= 0 || pr < 0)
      return acc;
    return acc + q * pr;
  }, 0);
  const tax = withPpn ? Math.round(subtotal * 0.11 * 100) / 100 : 0;

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">Baris Barang</p>
        <GlassButton
          type="button"
          variant="ghost"
          onClick={addLine}
          disabled={active.length === 0}
          className="!min-h-[40px] !px-3 !text-[13px]"
        >
          + Baris
        </GlassButton>
      </div>

      {active.length === 0 && (
        <p className="text-sm text-amber-200/90">
          Belum ada produk aktif. Tambahkan produk di modul Inventaris terlebih
          dahulu.
        </p>
      )}

      {lines.map((l, idx) => {
        const q = parseDecimal(l.qty);
        const pr = parseDecimal(l.price);
        const lineTotal =
          Number.isFinite(q) && Number.isFinite(pr) && q > 0 && pr >= 0
            ? q * pr
            : 0;
        const prod = active.find((p) => p.id === l.productId);
        return (
          <div
            key={l.key}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-300">
                Baris {idx + 1}
                {prod && (
                  <span className="font-normal text-slate-400">
                    {" "}
                    · {prod.unit}
                  </span>
                )}
              </p>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  aria-label={`Hapus baris ${idx + 1}`}
                  className="min-w-[40px] min-h-[40px] rounded-lg text-rose-200 hover:bg-rose-500/20 border border-rose-300/30 text-sm font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <SelectShell
              id={`line-${l.key}-produk`}
              label="Produk *"
              value={l.productId}
              onChange={(v) => setLine(l.key, { productId: v })}
            >
              {active.map((p) => (
                <option key={p.id} value={p.id} className="text-slate-900">
                  {p.sku} — {p.name}
                </option>
              ))}
            </SelectShell>
            <div className="grid grid-cols-2 gap-3">
              <GlassInput
                id={`line-${l.key}-qty`}
                label="Jumlah *"
                placeholder="mis. 10"
                inputMode="decimal"
                value={l.qty}
                onChange={(e) => setLine(l.key, { qty: e.target.value })}
              />
              <GlassInput
                id={`line-${l.key}-harga`}
                label="Harga Satuan (Rp) *"
                placeholder="mis. 25000"
                inputMode="decimal"
                value={l.price}
                onChange={(e) => setLine(l.key, { price: e.target.value })}
              />
            </div>
            <p className="text-sm text-slate-300/80 text-right">
              Subtotal baris:{" "}
              <span className="font-semibold text-slate-100">
                {formatIDR(lineTotal)}
              </span>
            </p>
          </div>
        );
      })}

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={withPpn}
          onChange={(e) => onPpnChange(e.target.checked)}
          className="w-5 h-5 accent-teal-400"
        />
        <span className="text-sm text-slate-200">
          Tambah PPN 11%{" "}
          <span className="text-slate-400">
            ({formatIDR(tax)})
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <p className="text-sm text-slate-300">Total dokumen</p>
        <p className="text-lg font-extrabold text-slate-100">
          {formatIDR(subtotal + tax)}
        </p>
      </div>
      <p className="text-xs text-slate-400/80">
        Subtotal {formatIDR(subtotal)} · PPN {formatIDR(tax)}
      </p>
    </div>
  );
}

/** Ringkasan meta dokumen untuk pratinjau cetak. */
export function MetaGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-slate-400 text-xs">{k}</dt>
          <dd className="text-slate-100 font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export { formatTanggal, formatIDR, formatQty };
