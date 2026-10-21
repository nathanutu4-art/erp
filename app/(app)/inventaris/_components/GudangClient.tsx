"use client";

/**
 * ============================================================================
 * KOMPONEN MANAJEMEN GUDANG (WAREHOUSE CLIENT)
 * ============================================================================
 * 
 * Pengelolaan master lokasi penyimpanan fisik barang:
 * 1. Daftar Gudang: Kode gudang unik, nama lokasi, alamat fisik, total varian SKU yang tersimpan, dan total kuantitas stok.
 * 2. Modal Tambah Gudang: Form pendaftaran lokasi baru (gudang utama, cabang, atau transit).
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { createWarehouse, type WarehouseSummary } from "../actions";
import { formatQty } from "../_lib/inventory";

function TambahGudangModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave =
    code.trim().length > 0 && name.trim().length > 0 && !pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createWarehouse({
        code: code.trim(),
        name: name.trim(),
        address: address.trim(),
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
    <GlassModal open onClose={onClose} title="Tambah Gudang">
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="gudang-kode">Kode Gudang *</label>
            <input
              id="gudang-kode"
              type="text"
              placeholder="mis. GDG-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gudang-nama">Nama Gudang *</label>
            <input
              id="gudang-nama"
              type="text"
              placeholder="mis. Gudang Utama"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gudang-alamat">Alamat (opsional)</label>
          <input
            id="gudang-alamat"
            type="text"
            placeholder="Alamat lengkap lokasi gudang"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "var(--danger)",
              background: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              borderRadius: "9px",
              padding: "10px 14px",
              marginBottom: "14px",
            }}
          >
            {error}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "9px", marginTop: "18px" }}>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="btn btn-primary"
          >
            {pending ? "Menyimpan…" : "Simpan Gudang"}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

export function GudangClient({
  warehouses,
}: {
  warehouses: WarehouseSummary[];
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Daftar Gudang</h3>
            <p>{warehouses.length} lokasi gudang terdaftar</p>
          </div>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
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
            Tambah Gudang
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Kode</th>
                <th>Nama Gudang</th>
                <th>Alamat</th>
                <th className="num" style={{ width: "180px" }}>
                  Estimasi Stok
                </th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-note">
                      Belum ada gudang. Tambahkan gudang pertama Anda — setiap mutasi stok membutuhkan gudang.
                    </div>
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {w.code}
                    </td>
                    <td>
                      {w.name}
                      {w.is_default && (
                        <span
                          className="badge b-green"
                          style={{ marginLeft: "8px", fontSize: "10.5px", padding: "1px 7px" }}
                        >
                          Utama
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{w.address || "—"}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatQty(w.estimatedStock)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="fin-note">
        Estimasi stok dihitung dari trail mutasi (total masuk − total keluar) per gudang; stok resmi produk tercatat pada level produk.
      </p>

      {showModal && (
        <TambahGudangModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
