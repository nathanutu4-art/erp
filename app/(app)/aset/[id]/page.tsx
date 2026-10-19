import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  toNumber,
  one,
  DEPRECIATION_METHOD_LABEL,
  ASSET_STATUS_LABEL,
  ASSET_STATUS_STYLE,
  type AssetStatus,
  type DepreciationMethod,
} from "../_lib/aset";
import { JadwalClient, type ScheduleView } from "./_components/JadwalClient";

type AssetDetail = {
  id: string;
  asset_code: string;
  name: string;
  purchase_date: string;
  purchase_cost: string | number;
  useful_life_months: number;
  depreciation_method: string;
  salvage_value: string | number;
  accumulated_depreciation: string | number;
  book_value: string | number;
  location: string | null;
  status: string;
  notes: string | null;
  category: { code: string; name: string } | Array<{ code: string; name: string }> | null;
};

type RawSchedule = {
  id: string;
  period_date: string;
  depreciation_amount: string | number;
  accumulated_depreciation: string | number;
  book_value: string | number;
  is_posted: boolean;
  journal_entry_id: string | null;
  journal: { entry_number: string } | Array<{ entry_number: string }> | null;
};

type RawDisposal = {
  id: string;
  disposal_date: string;
  disposal_price: string | number;
  gain_loss: string | number;
  notes: string | null;
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: assetData } = await supabase
    .from("assets")
    .select(
      "id, asset_code, name, purchase_date, purchase_cost, useful_life_months, depreciation_method, salvage_value, accumulated_depreciation, book_value, location, status, notes, category:asset_categories(code, name)"
    )
    .eq("id", id)
    .maybeSingle();
  const asset = assetData as AssetDetail | null;
  if (!asset) notFound();

  let schedules: ScheduleView[] = [];
  let disposal: {
    disposalDate: string;
    disposalPrice: number;
    gainLoss: number;
    notes: string | null;
  } | null = null;
  try {
    const [{ data: schedData }, { data: dispData }] = await Promise.all([
      supabase
        .from("depreciation_schedules")
        .select(
          "id, period_date, depreciation_amount, accumulated_depreciation, book_value, is_posted, journal_entry_id, journal:journal_entries(entry_number)"
        )
        .eq("asset_id", id)
        .order("period_date", { ascending: true })
        .limit(1200),
      supabase
        .from("asset_disposals")
        .select("id, disposal_date, disposal_price, gain_loss, notes")
        .eq("asset_id", id)
        .order("disposal_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    schedules = ((schedData ?? []) as RawSchedule[]).map((s) => ({
      id: s.id,
      periodDate: s.period_date,
      depreciationAmount: toNumber(s.depreciation_amount),
      accumulatedDepreciation: toNumber(s.accumulated_depreciation),
      bookValue: toNumber(s.book_value),
      isPosted: s.is_posted,
      journalEntryId: s.journal_entry_id,
      journalEntryNumber: one(s.journal)?.entry_number ?? null,
    }));
    const d = dispData as RawDisposal | null;
    if (d) {
      disposal = {
        disposalDate: d.disposal_date,
        disposalPrice: toNumber(d.disposal_price),
        gainLoss: toNumber(d.gain_loss),
        notes: d.notes,
      };
    }
  } catch {
    schedules = [];
    disposal = null;
  }

  const category = one(asset.category);
  const purchaseCost = toNumber(asset.purchase_cost);
  const accum = toNumber(asset.accumulated_depreciation);
  const book = toNumber(asset.book_value);

  return (
    <div>
      <Link
        href="/aset"
        className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 mb-4 min-h-[44px]"
      >
        ← Kembali ke daftar aset
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-100">
            {asset.name}
          </h1>
          <span
            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
              ASSET_STATUS_STYLE[asset.status as AssetStatus] ??
              ASSET_STATUS_STYLE.active
            }`}
          >
            {ASSET_STATUS_LABEL[asset.status as AssetStatus] ?? asset.status}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {asset.asset_code} · {category?.name ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">
            Harga Perolehan
          </h2>
          <p className="text-xl font-extrabold text-slate-100">
            {formatIDR(purchaseCost)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {formatTanggal(asset.purchase_date)}
            {asset.location ? ` · ${asset.location}` : ""}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">
            Akumulasi Penyusutan
          </h2>
          <p className="text-xl font-extrabold text-slate-100">
            {formatIDR(accum)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {DEPRECIATION_METHOD_LABEL[
              asset.depreciation_method as DepreciationMethod
            ] ?? asset.depreciation_method}{" "}
            · {asset.useful_life_months} bulan
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">Nilai Buku</h2>
          <p className="text-xl font-extrabold text-teal-200">
            {formatIDR(book)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Nilai sisa {formatIDR(asset.salvage_value)}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">
            Periode Dibukukan
          </h2>
          <p className="text-xl font-extrabold text-slate-100">
            {schedules.filter((s) => s.isPosted).length}/{schedules.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">dari total jadwal</p>
        </GlassCard>
      </div>

      {disposal && (
        <GlassCard className="p-5 mb-6 border-rose-300/30">
          <h2 className="text-base font-bold text-slate-100 mb-3">
            Pelepasan Aset
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Tanggal</p>
              <p className="font-semibold text-slate-100">
                {formatTanggal(disposal.disposalDate)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Harga Jual</p>
              <p className="font-semibold text-slate-100">
                {formatIDR(disposal.disposalPrice)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">
                {disposal.gainLoss >= 0 ? "Keuntungan" : "Kerugian"}
              </p>
              <p
                className={`font-semibold ${
                  disposal.gainLoss >= 0 ? "text-teal-200" : "text-rose-200"
                }`}
              >
                {formatIDR(disposal.gainLoss)}
              </p>
            </div>
          </div>
          {disposal.notes && (
            <p className="text-sm text-slate-300 mt-3">{disposal.notes}</p>
          )}
        </GlassCard>
      )}

      {asset.notes && (
        <GlassCard className="p-5 mb-6">
          <h2 className="text-base font-bold text-slate-100 mb-2">Catatan</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {asset.notes}
          </p>
        </GlassCard>
      )}

      <JadwalClient
        assetId={asset.id}
        assetStatus={asset.status}
        schedules={schedules}
      />
    </div>
  );
}
