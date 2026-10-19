"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
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
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="gudang-kode"
            label="Kode Gudang *"
            placeholder="mis. GDG-01"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <GlassInput
            id="gudang-nama"
            label="Nama Gudang *"
            placeholder="mis. Gudang Utama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <GlassInput
          id="gudang-alamat"
          label="Alamat (opsional)"
          placeholder="Alamat lengkap gudang"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}
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
            {pending ? "Menyimpan…" : "Simpan Gudang"}
          </GlassButton>
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
    <div>
      <div className="flex justify-end mb-4">
        <GlassButton onClick={() => setShowModal(true)}>
          + Tambah Gudang
        </GlassButton>
      </div>

      <GlassCard className="p-2 sm:p-4">
        {warehouses.length === 0 ? (
          <p className="text-sm text-slate-300/70 text-center py-10 px-4">
            Belum ada gudang. Tambahkan gudang pertama Anda — setiap mutasi
            stok membutuhkan gudang.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="min-w-[640px]">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Gudang</th>
                  <th>Alamat</th>
                  <th className="!text-right">Estimasi Stok</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono font-semibold">{w.code}</td>
                    <td className="!whitespace-normal min-w-[160px]">
                      {w.name}
                      {w.is_default && (
                        <span className="ml-2 inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-teal-400/20 text-teal-200 border-teal-300/40">
                          Utama
                        </span>
                      )}
                    </td>
                    <td className="!whitespace-normal min-w-[180px] text-slate-300/80">
                      {w.address || "—"}
                    </td>
                    <td className="!text-right font-semibold">
                      {formatQty(w.estimatedStock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <p className="text-xs text-slate-400/70 mt-3">
        “Estimasi Stok” dihitung dari trail mutasi (total masuk − total keluar)
        per gudang; stok resmi produk tercatat pada level produk.
      </p>

      {showModal && (
        <TambahGudangModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
