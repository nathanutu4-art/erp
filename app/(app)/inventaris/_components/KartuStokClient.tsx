"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { formatTanggal } from "@/lib/format";
import {
  getKartuStok,
  type KartuStokResult,
} from "../actions";
import {
  DIRECTION_LABEL,
  formatIDR2,
  formatQty,
  referenceLabel,
  type ProductWithWarehouse,
} from "../_lib/inventory";
import type { WarehouseOption } from "./ProdukClient";

export function KartuStokClient({
  products,
  warehouses,
}: {
  products: ProductWithWarehouse[];
  warehouses: WarehouseOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [result, setResult] = useState<KartuStokResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    if (!productId) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      const res = await getKartuStok({
        productId,
        warehouseId: warehouseId || null,
        fromDate: fromDate || null,
        toDate: toDate || null,
      });
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res);
    });
  };

  const hasFilter = fromDate !== "" || toDate !== "" || warehouseId !== "";

  return (
    <div>
      <GlassCard className="p-4 sm:p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Produk *
            </span>
            <select
              aria-label="Pilih produk"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
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
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Gudang
            </span>
            <select
              aria-label="Filter gudang"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              <option value="" className="text-slate-900">
                Semua gudang
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id} className="text-slate-900">
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Dari Tanggal
            </span>
            <input
              type="date"
              aria-label="Dari tanggal"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Sampai Tanggal
            </span>
            <input
              type="date"
              aria-label="Sampai tanggal"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <GlassButton
            onClick={load}
            disabled={pending || !productId}
            className="w-full sm:w-auto"
          >
            {pending ? "Memuat…" : "Tampilkan Kartu Stok"}
          </GlassButton>
          {result?.ok && (
            <p className="text-sm text-slate-300/80">
              {result.product.sku} — {result.product.name}
            </p>
          )}
        </div>
      </GlassCard>

      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3 mb-4"
        >
          {error}
        </p>
      )}

      {!result && !error && (
        <GlassCard className="p-10 text-center">
          <p className="text-sm text-slate-300/70">
            Pilih produk lalu tekan “Tampilkan Kartu Stok” untuk melihat
            riwayat mutasi.
          </p>
        </GlassCard>
      )}

      {result?.ok && (
        <GlassCard className="p-2 sm:p-4">
          {result.rows.length === 0 ? (
            <p className="text-sm text-slate-300/70 text-center py-10 px-4">
              Belum ada mutasi stok
              {hasFilter ? " pada filter yang dipilih" : " untuk produk ini"}.
            </p>
          ) : (
            <div className="tbl-wrap">
              <table className="min-w-[880px]">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Gudang</th>
                    <th className="!text-right">Masuk</th>
                    <th className="!text-right">Keluar</th>
                    <th className="!text-right">HPP Average</th>
                    <th className="!text-right">Stok Berjalan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white/5">
                    <td className="text-slate-300/70">—</td>
                    <td className="font-semibold">Saldo Awal</td>
                    <td className="text-slate-300/70">—</td>
                    <td className="!text-right text-slate-300/70">—</td>
                    <td className="!text-right text-slate-300/70">—</td>
                    <td className="!text-right">
                      {formatIDR2(result.openingAvg)}
                    </td>
                    <td className="!text-right font-semibold">
                      {formatQty(result.openingStock)} {result.product.unit}
                    </td>
                  </tr>
                  {result.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        {formatTanggal(r.mutationDate)}
                      </td>
                      <td className="!whitespace-normal min-w-[160px]">
                        <span
                          className={`inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 border mr-2 ${
                            r.direction === "in"
                              ? "bg-teal-400/20 text-teal-200 border-teal-300/40"
                              : "bg-amber-400/20 text-amber-200 border-amber-300/40"
                          }`}
                        >
                          {DIRECTION_LABEL[r.direction]}
                        </span>
                        {referenceLabel(r.referenceType)}
                        {r.notes && (
                          <span className="block text-xs text-slate-300/70 mt-0.5">
                            {r.notes}
                          </span>
                        )}
                      </td>
                      <td className="text-slate-300/80">
                        {r.warehouseCode ?? "—"}
                      </td>
                      <td className="!text-right text-teal-200 font-medium">
                        {r.direction === "in"
                          ? `${formatQty(r.quantity)}`
                          : "—"}
                      </td>
                      <td className="!text-right text-amber-200 font-medium">
                        {r.direction === "out"
                          ? `${formatQty(r.quantity)}`
                          : "—"}
                      </td>
                      <td className="!text-right">
                        {r.resultingAvg != null
                          ? formatIDR2(r.resultingAvg)
                          : "—"}
                      </td>
                      <td className="!text-right font-semibold">
                        {formatQty(r.runningStock)} {result.product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {result?.ok && result.rows.length > 0 && (
        <p className="text-xs text-slate-400/70 mt-3">
          HPP average bersifat global per produk (bukan per gudang). Kolom
          “Stok Berjalan” mengikuti filter gudang bila dipilih.
        </p>
      )}
    </div>
  );
}
