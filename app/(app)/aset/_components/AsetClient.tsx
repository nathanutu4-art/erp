"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { formatIDR, formatTanggal } from "@/lib/format";
import { createAsset, disposeAsset } from "../actions";
import {
  DEPRECIATION_METHOD_LABEL,
  DEPRECIATION_METHOD_ORDER,
  ASSET_STATUS_LABEL,
  ASSET_STATUS_STYLE,
  todayISO,
  type AssetStatus,
  type DepreciationMethod,
} from "../_lib/aset";

export type AssetRow = {
  id: string;
  assetCode: string;
  name: string;
  categoryId: string;
  categoryCode: string | null;
  categoryName: string;
  purchaseDate: string;
  purchaseCost: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  salvageValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  location: string | null;
  status: string;
};

export type CategoryOption = {
  id: string;
  code: string;
  name: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: string;
};

function TambahAsetModal({
  categories,
  onClose,
}: {
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assetCode, setAssetCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseCost, setPurchaseCost] = useState("");
  const [usefulLife, setUsefulLife] = useState(
    String(categories[0]?.defaultUsefulLifeMonths ?? 48)
  );
  const [method, setMethod] = useState<DepreciationMethod>("straight_line");
  const [salvage, setSalvage] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onCategoryChange = (id: string) => {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setUsefulLife(String(cat.defaultUsefulLifeMonths));
      setMethod(
        (DEPRECIATION_METHOD_ORDER as readonly string[]).includes(
          cat.defaultDepreciationMethod
        )
          ? (cat.defaultDepreciationMethod as DepreciationMethod)
          : "straight_line"
      );
    }
  };

  const canSave =
    assetCode.trim().length > 0 &&
    name.trim().length > 0 &&
    categoryId.length > 0 &&
    purchaseCost.trim().length > 0 &&
    !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAsset({
        assetCode: assetCode.trim(),
        name: name.trim(),
        categoryId,
        purchaseDate,
        purchaseCost: Number(purchaseCost),
        usefulLifeMonths: usefulLife.trim() ? Number(usefulLife) : null,
        depreciationMethod: method,
        salvageValue: salvage.trim() ? Number(salvage) : 0,
        location: location.trim(),
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
    <GlassModal open onClose={onClose} title="Tambah Aset">
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="aset-kode"
            label="Kode Aset *"
            placeholder="mis. AST-0001"
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
          />
          <GlassInput
            id="aset-nama"
            label="Nama Aset *"
            placeholder="mis. Toyota Avanza"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Kategori *
            </span>
            <select
              aria-label="Kategori aset"
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="text-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <GlassInput
            id="aset-tgl"
            label="Tanggal Perolehan *"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="aset-harga"
            label="Harga Perolehan (Rp) *"
            type="number"
            min="0"
            placeholder="0"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
          <GlassInput
            id="aset-umur"
            label="Umur Ekonomis (bulan)"
            type="number"
            min="1"
            placeholder="Default kategori"
            value={usefulLife}
            onChange={(e) => setUsefulLife(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Metode Penyusutan
            </span>
            <select
              aria-label="Metode penyusutan"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as DepreciationMethod)
              }
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {DEPRECIATION_METHOD_ORDER.map((m) => (
                <option key={m} value={m} className="text-slate-900">
                  {DEPRECIATION_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <GlassInput
            id="aset-sisa"
            label="Nilai Sisa (Rp)"
            type="number"
            min="0"
            placeholder="0"
            value={salvage}
            onChange={(e) => setSalvage(e.target.value)}
          />
        </div>
        <GlassInput
          id="aset-lokasi"
          label="Lokasi"
          placeholder="mis. Kantor Pusat"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div>
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Catatan
          </span>
          <textarea
            aria-label="Catatan aset"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="glass-input w-full px-4 py-3 rounded-xl text-sm min-h-[80px]"
          />
        </div>
        <p className="text-xs text-slate-400">
          Jadwal penyusutan bulanan dibuat otomatis setelah aset disimpan.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <GlassButton
            variant="ghost"
            onClick={onClose}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Batal
          </GlassButton>
          <GlassButton
            onClick={submit}
            disabled={!canSave}
            className="w-full sm:w-auto"
          >
            {pending ? "Menyimpan…" : "Simpan Aset"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

function DisposalModal({
  asset,
  onClose,
}: {
  asset: AssetRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const priceNum = price.trim() ? Number(price) : NaN;
  const gainLoss =
    Number.isFinite(priceNum) && priceNum >= 0
      ? Math.round((priceNum - asset.bookValue) * 100) / 100
      : null;

  const canSave = date.trim().length > 0 && gainLoss !== null && !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await disposeAsset({
        assetId: asset.id,
        disposalDate: date,
        disposalPrice: Number(price),
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
    <GlassModal open onClose={onClose} title={`Disposal — ${asset.name}`}>
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Nilai buku saat ini</span>
            <span className="font-semibold text-slate-100">
              {formatIDR(asset.bookValue)}
            </span>
          </div>
          {gainLoss !== null && (
            <div className="flex justify-between gap-4 mt-2">
              <span className="text-slate-400">
                {gainLoss >= 0 ? "Keuntungan" : "Kerugian"} pelepasan
              </span>
              <span
                className={`font-semibold ${
                  gainLoss >= 0 ? "text-teal-200" : "text-rose-200"
                }`}
              >
                {formatIDR(gainLoss)}
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="dsp-tgl"
            label="Tanggal Pelepasan *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <GlassInput
            id="dsp-harga"
            label="Harga Jual (Rp) *"
            type="number"
            min="0"
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Catatan
          </span>
          <textarea
            aria-label="Catatan disposal"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="glass-input w-full px-4 py-3 rounded-xl text-sm min-h-[80px]"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <GlassButton
            variant="ghost"
            onClick={onClose}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Batal
          </GlassButton>
          <GlassButton
            variant="danger"
            onClick={submit}
            disabled={!canSave}
            className="w-full sm:w-auto"
          >
            {pending ? "Memproses…" : "Lepas Aset"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export function AsetClient({
  assets,
  categories,
}: {
  assets: AssetRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showTambah, setShowTambah] = useState(false);
  const [disposalTarget, setDisposalTarget] = useState<AssetRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.assetCode, a.name, a.categoryName, a.location ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [assets, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (s, a) => ({
        cost: s.cost + a.purchaseCost,
        accum: s.accum + a.accumulatedDepreciation,
        book: s.book + a.bookValue,
      }),
      { cost: 0, accum: 0, book: 0 }
    );
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="stats-grid">
        <div className="card stat">
          <div className="s-label">Total Nilai Perolehan</div>
          <div className="s-value">{formatIDR(totals.cost)}</div>
          <div className="s-foot">Biaya perolehan historis</div>
        </div>
        <div className="card stat">
          <div className="s-label">Akumulasi Penyusutan</div>
          <div className="s-value neg">{formatIDR(totals.accum)}</div>
          <div className="s-foot">Penyusutan s.d. periode berjalan</div>
        </div>
        <div className="card stat">
          <div className="s-label">Nilai Buku Bersih</div>
          <div className="s-value pos">{formatIDR(totals.book)}</div>
          <div className="s-foot">Nilai buku di Neraca</div>
        </div>
        <div className="card stat">
          <div className="s-label">Unit Aset Terdata</div>
          <div className="s-value">{assets.length} Unit</div>
          <div className="s-foot">{assets.filter((a) => a.status === "active").length} aktif beroperasi</div>
        </div>
      </div>
      <DataTable
        title="Daftar Aset Tetap"
        searchPlaceholder="Cari kode, nama, kategori…"
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <GlassButton onClick={() => setShowTambah(true)}>
            + Tambah Aset
          </GlassButton>
        }
      >
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-slate-300/90">
              <th className="px-4 py-3 font-semibold">Aset</th>
              <th className="px-4 py-3 font-semibold">Perolehan</th>
              <th className="px-4 py-3 font-semibold text-right">Harga</th>
              <th className="px-4 py-3 font-semibold">Umur / Metode</th>
              <th className="px-4 py-3 font-semibold text-right">Akumulasi</th>
              <th className="px-4 py-3 font-semibold text-right">Nilai Buku</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/aset/${a.id}`)}
                className="border-t border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-100">{a.name}</div>
                  <div className="text-xs text-slate-400">
                    {a.assetCode} · {a.categoryName}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                  {formatTanggal(a.purchaseDate)}
                </td>
                <td className="px-4 py-3 text-right text-slate-100 whitespace-nowrap">
                  {formatIDR(a.purchaseCost)}
                </td>
                <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                  {a.usefulLifeMonths} bln
                  <div className="text-xs text-slate-400">
                    {DEPRECIATION_METHOD_LABEL[
                      a.depreciationMethod as DepreciationMethod
                    ] ?? a.depreciationMethod}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-200 whitespace-nowrap">
                  {formatIDR(a.accumulatedDepreciation)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-100 whitespace-nowrap">
                  {formatIDR(a.bookValue)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                      ASSET_STATUS_STYLE[a.status as AssetStatus] ??
                      ASSET_STATUS_STYLE.active
                    }`}
                  >
                    {ASSET_STATUS_LABEL[a.status as AssetStatus] ?? a.status}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {a.status !== "disposed" ? (
                    <button
                      onClick={() => setDisposalTarget(a)}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-200 border border-rose-300/40 hover:bg-rose-500/30 transition-colors"
                    >
                      Disposal
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  {assets.length === 0
                    ? "Belum ada aset tetap. Tambahkan aset pertama Anda."
                    : "Tidak ada aset yang cocok dengan pencarian."}
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/15">
                <td
                  colSpan={2}
                  className="px-4 py-3 text-right font-semibold text-slate-200"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-100">
                  {formatIDR(totals.cost)}
                </td>
                <td />
                <td className="px-4 py-3 text-right font-bold text-slate-100">
                  {formatIDR(totals.accum)}
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-slate-100">
                  {formatIDR(totals.book)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </DataTable>
      {showTambah && (
        <TambahAsetModal
          categories={categories}
          onClose={() => setShowTambah(false)}
        />
      )}
      {disposalTarget && (
        <DisposalModal
          asset={disposalTarget}
          onClose={() => setDisposalTarget(null)}
        />
      )}
    </div>
  );
}
