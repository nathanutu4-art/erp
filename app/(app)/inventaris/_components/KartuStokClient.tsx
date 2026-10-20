"use client";

import { useState, useTransition } from "react";
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
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Kartu Stok (Stock Ledger)</h3>
            <p>Riwayat pergerakan stok dan HPP average per mutasi</p>
          </div>
          <div className="spacer" />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <select
              aria-label="Pilih produk"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="select"
              style={{ minWidth: "220px" }}
            >
              {products.length === 0 && (
                <option value="">— Belum ada produk —</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Pilih gudang"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="select"
            >
              <option value="">Semua Gudang</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Dari tanggal"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="select"
              style={{ height: "37px", padding: "0 10px" }}
            />
            <span style={{ color: "var(--muted)", fontSize: "12.5px" }}>s/d</span>
            <input
              type="date"
              aria-label="Sampai tanggal"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="select"
              style={{ height: "37px", padding: "0 10px" }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={load}
              disabled={pending || !productId}
            >
              {pending ? "Memuat…" : "Tampilkan"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 22px 0" }}>
            <p
              role="alert"
              style={{
                fontSize: "13px",
                color: "var(--danger)",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger)",
                borderRadius: "9px",
                padding: "10px 14px",
              }}
            >
              {error}
            </p>
          </div>
        )}

        {!result && !error && (
          <div className="empty-note">
            Pilih produk dan klik &quot;Tampilkan&quot; untuk melihat riwayat mutasi stok.
          </div>
        )}

        {result?.ok && (
          <>
            <div style={{ padding: "16px 22px 0", display: "flex", gap: "26px", flexWrap: "wrap" }}>
              <div className="small">
                <span className="muted">Produk</span>
                <br />
                <b>{result.product.sku} — {result.product.name}</b>
              </div>
              <div className="small">
                <span className="muted">Satuan</span>
                <br />
                <b>{result.product.unit}</b>
              </div>
              <div className="small">
                <span className="muted">Saldo Awal</span>
                <br />
                <b>{formatQty(result.openingStock)} {result.product.unit}</b>
              </div>
              <div className="small">
                <span className="muted">HPP Average Awal</span>
                <br />
                <b className="pos">{formatIDR2(result.openingAvg)}</b>
              </div>
            </div>

            <div className="tbl-wrap" style={{ marginTop: "12px" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Gudang</th>
                    <th className="num">Masuk</th>
                    <th className="num">Keluar</th>
                    <th className="num">HPP Average</th>
                    <th className="num">Stok Berjalan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ color: "var(--muted)" }}>
                    <td>—</td>
                    <td>Saldo Awal</td>
                    <td>—</td>
                    <td className="num">—</td>
                    <td className="num">—</td>
                    <td className="num">{formatIDR2(result.openingAvg)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatQty(result.openingStock)} {result.product.unit}
                    </td>
                  </tr>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-note">
                          Belum ada mutasi stok{hasFilter ? " pada filter yang dipilih" : " untuk produk ini"}.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{formatTanggal(r.mutationDate)}</td>
                        <td>
                          <span
                            className={`badge ${r.direction === "in" ? "b-green" : "b-amber"}`}
                            style={{ marginRight: "8px" }}
                          >
                            <i />
                            {DIRECTION_LABEL[r.direction]}
                          </span>
                          {referenceLabel(r.referenceType)}
                          {r.notes && (
                            <span style={{ display: "block", fontSize: "12px", color: "var(--muted)" }}>
                              {r.notes}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.warehouseCode ? `${r.warehouseCode} — ${r.warehouseName ?? ""}` : "—"}
                        </td>
                        <td className="num pos">
                          {r.direction === "in" ? `+${formatQty(r.quantity)}` : "—"}
                        </td>
                        <td className="num neg">
                          {r.direction === "out" ? `-${formatQty(r.quantity)}` : "—"}
                        </td>
                        <td className="num">{r.resultingAvg != null ? formatIDR2(r.resultingAvg) : "—"}</td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {formatQty(r.runningStock)} {result.product.unit}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="fin-note">
        Kartu stok menampilkan seluruh jejak pergerakan barang beserta perhitungan HPP Average otomatis per mutasi.
      </p>
    </div>
  );
}
