"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL ASET TETAP
 * ============================================================================
 * 
 * Mengendalikan mutasi nilai aset tetap dan kalkulasi akuntansi depresiasi:
 * 1. createAsset(): Mendaftarkan aset baru, membuat nomor AST-YYYY-NNNN, dan menghasilkan baris jadwal penyusutan.
 * 2. postDepreciationEntry(): Membukukan beban depresiasi bulan berjalan ke jurnal umum akuntansi (Debit Beban Penyusutan, Kredit Akumulasi Penyusutan).
 * 3. disposeAsset(): Menghentikan aset (karena dijual, rusak, atau dihibahkan), menghitung laba/rugi pelepasan, dan membentuk jurnal disposal.
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSchedule,
  toNumber,
  isDateValid,
  DEPRECIATION_METHOD_ORDER,
  type DepreciationMethod,
} from "./_lib/aset";

export type ActionResult = { ok: true } | { ok: false; error: string };

const toCents = (n: number): number => Math.round(n * 100);

async function requireAuth(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const current = await getCurrentUser();
  if (!current?.user) return { ok: false, error: "Anda harus masuk." };
  return { ok: true, userId: current.user.id };
}

/**
 * Nomor jurnal berformat JU-YYYY-NNNN.
 * Pola bersama modul Keuangan & Akuntansi (lihat app/(app)/keuangan/actions.ts):
 * nomor dihitung dari jumlah jurnal pada tahun tersebut (+1), coba ulang
 * bila bentrok (kode 23505).
 */
async function generateEntryNumber(
  supabase: SupabaseClient,
  year: string,
  extraBump = 0
): Promise<string> {
  const { count } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .gte("entry_date", `${year}-01-01`)
    .lte("entry_date", `${year}-12-31`);
  const seq = (count ?? 0) + 1 + extraBump;
  return `JU-${year}-${String(seq).padStart(4, "0")}`;
}

/** Periode akuntansi untuk tanggal tsb. sudah ditutup? (pola bersama Keuangan) */
async function isPeriodClosed(
  supabase: SupabaseClient,
  entryDate: string
): Promise<boolean> {
  const { data } = await supabase
    .from("fiscal_periods")
    .select("id")
    .lte("start_date", entryDate)
    .gte("end_date", entryDate)
    .eq("is_closed", true)
    .maybeSingle();
  return !!data;
}

type AssetRef = {
  id: string;
  asset_code: string;
  name: string;
  category_id: string;
  purchase_date: string;
  purchase_cost: string | number;
  useful_life_months: number;
  depreciation_method: string;
  salvage_value: string | number;
  accumulated_depreciation: string | number;
  status: string;
  category: { code: string; name: string } | Array<{ code: string; name: string }> | null;
};

/**
 * Membuat jadwal penyusutan bulanan untuk satu aset ke tabel
 * depreciation_schedules. Idempoten: baris periode yang sudah ada
 * dilewati (upsert on conflict).
 */
async function generateScheduleForAsset(
  supabase: SupabaseClient,
  asset: {
    id: string;
    purchase_date: string;
    purchase_cost: number;
    salvage_value: number;
    useful_life_months: number;
    depreciation_method: DepreciationMethod;
  }
): Promise<ActionResult> {
  const purchaseYear = Number(asset.purchase_date.slice(0, 4));
  const purchaseMonth = Number(asset.purchase_date.slice(5, 7));
  if (!Number.isFinite(purchaseYear) || !Number.isFinite(purchaseMonth)) {
    return { ok: false, error: "Tanggal perolehan aset tidak valid." };
  }

  const rows = buildSchedule({
    purchaseCostCents: toCents(asset.purchase_cost),
    salvageCents: toCents(asset.salvage_value),
    usefulLifeMonths: asset.useful_life_months,
    purchaseYear,
    purchaseMonth1to12: purchaseMonth,
    method: asset.depreciation_method,
  });

  if (rows.length === 0) {
    return { ok: false, error: "Jadwal penyusutan tidak dapat dibuat." };
  }

  const payload = rows.map((r) => ({
    asset_id: asset.id,
    period_date: r.periodDate,
    depreciation_amount: r.amountCents / 100,
    accumulated_depreciation: r.accumulatedCents / 100,
    book_value: r.bookValueCents / 100,
  }));

  const { error } = await supabase
    .from("depreciation_schedules")
    .upsert(payload, {
      onConflict: "asset_id,period_date",
      ignoreDuplicates: true,
    });
  if (error) {
    return {
      ok: false,
      error: "Gagal membuat jadwal penyusutan. Silakan coba lagi.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aset Tetap
// ---------------------------------------------------------------------------

export async function createAsset(input: {
  assetCode: string;
  name: string;
  categoryId: string;
  purchaseDate: string;
  purchaseCost: number;
  usefulLifeMonths?: number | null;
  depreciationMethod?: string;
  salvageValue?: number;
  location?: string;
  notes?: string;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const assetCode = input.assetCode.trim().toUpperCase();
  const name = input.name.trim();
  if (!assetCode) return { ok: false, error: "Kode aset wajib diisi." };
  if (!name) return { ok: false, error: "Nama aset wajib diisi." };
  if (!input.categoryId) return { ok: false, error: "Pilih kategori aset." };
  if (!isDateValid(input.purchaseDate)) {
    return { ok: false, error: "Tanggal perolehan tidak valid." };
  }

  const purchaseCost = toCents(Number(input.purchaseCost)) / 100;
  if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
    return { ok: false, error: "Harga perolehan tidak valid." };
  }
  const salvageValue =
    toCents(Number(input.salvageValue ?? 0)) / 100;
  if (!Number.isFinite(salvageValue) || salvageValue < 0) {
    return { ok: false, error: "Nilai sisa tidak valid." };
  }
  if (salvageValue > purchaseCost) {
    return {
      ok: false,
      error: "Nilai sisa tidak boleh melebihi harga perolehan.",
    };
  }
  const method = (input.depreciationMethod || "straight_line") as string;
  if (!(DEPRECIATION_METHOD_ORDER as readonly string[]).includes(method)) {
    return { ok: false, error: "Metode penyusutan tidak valid." };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("asset_categories")
    .select("id, default_useful_life_months")
    .eq("id", input.categoryId)
    .maybeSingle();
  const cat = category as {
    id: string;
    default_useful_life_months: number;
  } | null;
  if (!cat) return { ok: false, error: "Kategori aset tidak ditemukan." };

  const usefulLifeMonths =
    input.usefulLifeMonths && Number(input.usefulLifeMonths) > 0
      ? Math.floor(Number(input.usefulLifeMonths))
      : Number(cat.default_useful_life_months);
  if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0) {
    return { ok: false, error: "Umur ekonomis tidak valid." };
  }

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("asset_code", assetCode)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Kode aset "${assetCode}" sudah digunakan.` };
  }

  const { data: inserted, error } = await supabase
    .from("assets")
    .insert({
      asset_code: assetCode,
      name,
      category_id: input.categoryId,
      purchase_date: input.purchaseDate,
      purchase_cost: purchaseCost,
      useful_life_months: usefulLifeMonths,
      depreciation_method: method,
      salvage_value: salvageValue,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) {
    if ((error as { code?: string } | null)?.code === "23505") {
      return { ok: false, error: `Kode aset "${assetCode}" sudah digunakan.` };
    }
    return { ok: false, error: "Gagal menyimpan aset. Silakan coba lagi." };
  }
  const assetId = (inserted as { id: string }).id;

  const sched = await generateScheduleForAsset(supabase, {
    id: assetId,
    purchase_date: input.purchaseDate,
    purchase_cost: purchaseCost,
    salvage_value: salvageValue,
    useful_life_months: usefulLifeMonths,
    depreciation_method: method as DepreciationMethod,
  });
  if (!sched.ok) {
    // Aset tetap tersimpan; jadwal bisa dibuat ulang dari halaman detail.
    return {
      ok: false,
      error: `Aset tersimpan, tetapi ${sched.ok === false ? (sched as { error: string }).error : ""}`,
    };
  }

  revalidatePath("/aset");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pembukuan penyusutan → jurnal otomatis
// ---------------------------------------------------------------------------

const EXPENSE_ACCOUNT_CODE = "6140"; // Beban Penyusutan (seed 09)

/** Kode akun akumulasi penyusutan per kategori; sisanya pakai yang pertama. */
const ACCUM_ACCOUNT_BY_CATEGORY: Record<string, string> = {
  kendaraan: "1211",
  peralatan: "1221",
  bangunan: "1231",
};

/**
 * Membukukan satu periode penyusutan sebagai jurnal seimbang:
 *   Dr Beban Penyusutan (6140)
 *   Cr Akumulasi Penyusutan (kontra aset per kategori)
 * Validasi mengikuti pola bersama modul Keuangan: minimal 2 baris,
 * Σdebit = Σkredit (dihitung dalam sen), akun harus ada & aktif.
 */
export async function postDepreciation(
  scheduleId: string
): Promise<ActionResult & { entryNumber?: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data: schedData } = await supabase
    .from("depreciation_schedules")
    .select(
      "id, asset_id, period_date, depreciation_amount, is_posted, journal_entry_id, asset:assets(id, asset_code, name, status, category:asset_categories(code, name))"
    )
    .eq("id", scheduleId)
    .maybeSingle();
  const sched = schedData as {
    id: string;
    asset_id: string;
    period_date: string;
    depreciation_amount: string | number;
    is_posted: boolean;
    journal_entry_id: string | null;
    asset: {
      id: string;
      asset_code: string;
      name: string;
      status: string;
      category: { code: string; name: string } | Array<{ code: string; name: string }> | null;
    } | Array<{
      id: string;
      asset_code: string;
      name: string;
      status: string;
      category: { code: string; name: string } | Array<{ code: string; name: string }> | null;
    }> | null;
  } | null;
  if (!sched) {
    return { ok: false, error: "Jadwal penyusutan tidak ditemukan." };
  }
  if (sched.is_posted) {
    return { ok: false, error: "Periode ini sudah dibukukan." };
  }
  const asset = Array.isArray(sched.asset) ? (sched.asset[0] ?? null) : sched.asset;
  if (!asset) return { ok: false, error: "Data aset tidak ditemukan." };
  if (asset.status === "disposed") {
    return {
      ok: false,
      error: `Aset "${asset.name}" sudah dilepas — penyusutan tidak dapat dibukukan.`,
    };
  }

  const amountCents = toCents(toNumber(sched.depreciation_amount));
  if (amountCents <= 0) {
    return {
      ok: false,
      error: "Nominal penyusutan periode ini nol — tidak ada yang dibukukan.",
    };
  }

  const entryDate = sched.period_date.slice(0, 10);
  if (await isPeriodClosed(supabase, entryDate)) {
    return {
      ok: false,
      error: "Periode akuntansi untuk tanggal tersebut sudah ditutup.",
    };
  }

  const category = asset.category
    ? Array.isArray(asset.category)
      ? (asset.category[0] ?? null)
      : asset.category
    : null;
  const accumCode =
    (category && ACCUM_ACCOUNT_BY_CATEGORY[category.code]) || null;

  // Akun beban selalu 6140; akun akumulasi mengikuti kategori (fallback: akun
  // "Akumulasi Penyusutan" pertama yang tersedia di bagan akun).
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, is_header, is_active")
    .or(
      `code.eq.${EXPENSE_ACCOUNT_CODE}${
        accumCode ? `,code.eq.${accumCode}` : ""
      },name.ilike.Akumulasi Penyusutan%`
    );
  const accts = ((accounts ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    is_header: boolean;
    is_active: boolean;
  }>);
  const expense = accts.find((a) => a.code === EXPENSE_ACCOUNT_CODE) ?? null;
  const accum =
    (accumCode ? accts.find((a) => a.code === accumCode) : null) ??
    accts.find((a) => a.name.toLowerCase().startsWith("akumulasi penyusutan")) ??
    null;

  if (!expense || !expense.is_active || expense.is_header) {
    return {
      ok: false,
      error:
        "Akun Beban Penyusutan (6140) belum tersedia/aktif di bagan akun.",
    };
  }
  if (!accum || !accum.is_active || accum.is_header) {
    return {
      ok: false,
      error:
        "Akun Akumulasi Penyusutan belum tersedia/aktif di bagan akun.",
    };
  }

  // --- Bangun jurnal 2 baris yang seimbang (pola bersama Keuangan) ---
  const lines = [
    { accountId: expense.id, debit: amountCents / 100, credit: 0 },
    { accountId: accum.id, debit: 0, credit: amountCents / 100 },
  ];
  const totalDebit = lines.reduce((s, l) => s + toCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toCents(l.credit), 0);
  if (lines.length < 2 || totalDebit === 0 || totalDebit !== totalCredit) {
    return {
      ok: false,
      error: `Jurnal penyusutan tidak seimbang: debit ${formatIDR(totalDebit / 100)} ≠ kredit ${formatIDR(totalCredit / 100)}.`,
    };
  }

  const description = `Penyusutan ${asset.asset_code} — ${asset.name} periode ${entryDate.slice(0, 7)}`;
  const year = entryDate.slice(0, 4);

  let entryNumber = await generateEntryNumber(supabase, year);
  let headerId: string | null = null;
  for (let attempt = 0; attempt < 3 && !headerId; attempt++) {
    if (attempt > 0) {
      entryNumber = await generateEntryNumber(supabase, year, attempt);
    }
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        entry_number: entryNumber,
        entry_date: entryDate,
        description,
        reference_type: "depreciation",
        reference_id: sched.id,
        status: "posted",
        created_by: auth.userId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (!error && data) {
      headerId = (data as { id: string }).id;
    } else if (!error || (error as { code?: string }).code !== "23505") {
      return { ok: false, error: "Gagal menyimpan jurnal. Silakan coba lagi." };
    }
  }
  if (!headerId) {
    return { ok: false, error: "Gagal menyimpan jurnal. Silakan coba lagi." };
  }

  const { error: lineError } = await supabase.from("journal_lines").insert([
    {
      journal_entry_id: headerId,
      account_id: expense.id,
      debit: amountCents / 100,
      credit: 0,
      description: `Beban penyusutan ${asset.asset_code}`,
      line_order: 0,
    },
    {
      journal_entry_id: headerId,
      account_id: accum.id,
      debit: 0,
      credit: amountCents / 100,
      description: `Akumulasi penyusutan ${asset.asset_code}`,
      line_order: 1,
    },
  ]);
  if (lineError) {
    await supabase.from("journal_entries").delete().eq("id", headerId);
    return {
      ok: false,
      error: "Gagal menyimpan baris jurnal. Silakan coba lagi.",
    };
  }

  // Tandai periode dibukukan + tautkan jurnal.
  const { error: schedErr } = await supabase
    .from("depreciation_schedules")
    .update({ is_posted: true, journal_entry_id: headerId })
    .eq("id", sched.id);
  if (schedErr) {
    await supabase.from("journal_lines").delete().eq("journal_entry_id", headerId);
    await supabase.from("journal_entries").delete().eq("id", headerId);
    return {
      ok: false,
      error: "Gagal menandai periode dibukukan — jurnal dibatalkan.",
    };
  }

  // Sinkronkan akumulasi aset dari seluruh periode yang sudah dibukukan
  // (idempoten; tidak bergantung pada nilai sebelumnya).
  const { data: posted } = await supabase
    .from("depreciation_schedules")
    .select("depreciation_amount")
    .eq("asset_id", asset.id)
    .eq("is_posted", true);
  const accumTotal = ((posted ?? []) as Array<{ depreciation_amount: string | number }>)
    .reduce((s, r) => s + toCents(toNumber(r.depreciation_amount)), 0);
  await supabase
    .from("assets")
    .update({ accumulated_depreciation: accumTotal / 100 })
    .eq("id", asset.id);

  revalidatePath("/aset");
  revalidatePath(`/aset/${asset.id}`);
  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true, entryNumber };
}

// ---------------------------------------------------------------------------
// Disposal (pelepasan aset)
// ---------------------------------------------------------------------------

export async function disposeAsset(input: {
  assetId: string;
  disposalDate: string;
  disposalPrice: number;
  notes?: string;
}): Promise<ActionResult & { gainLoss?: number }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!input.assetId) return { ok: false, error: "Aset tidak valid." };
  if (!isDateValid(input.disposalDate)) {
    return { ok: false, error: "Tanggal pelepasan tidak valid." };
  }
  const disposalPrice = toCents(Number(input.disposalPrice)) / 100;
  if (!Number.isFinite(disposalPrice) || disposalPrice < 0) {
    return { ok: false, error: "Harga jual tidak valid." };
  }

  const supabase = await createClient();

  const { data: assetData } = await supabase
    .from("assets")
    .select(
      "id, asset_code, name, purchase_cost, accumulated_depreciation, status"
    )
    .eq("id", input.assetId)
    .maybeSingle();
  const asset = assetData as {
    id: string;
    asset_code: string;
    name: string;
    purchase_cost: string | number;
    accumulated_depreciation: string | number;
    status: string;
  } | null;
  if (!asset) return { ok: false, error: "Aset tidak ditemukan." };
  if (asset.status === "disposed") {
    return { ok: false, error: `Aset "${asset.name}" sudah dilepas.` };
  }

  const bookValue =
    toCents(toNumber(asset.purchase_cost)) / 100 -
    toCents(toNumber(asset.accumulated_depreciation)) / 100;
  const gainLoss = Math.round((disposalPrice - bookValue) * 100) / 100;

  const { error: dispErr } = await supabase.from("asset_disposals").insert({
    asset_id: asset.id,
    disposal_date: input.disposalDate,
    disposal_price: disposalPrice,
    gain_loss: gainLoss,
    notes: input.notes?.trim() || null,
  });
  if (dispErr) {
    return { ok: false, error: "Gagal mencatat pelepasan aset." };
  }

  const { error: updErr } = await supabase
    .from("assets")
    .update({ status: "disposed" })
    .eq("id", asset.id);
  if (updErr) {
    return {
      ok: false,
      error: "Pelepasan tercatat tetapi gagal memperbarui status aset.",
    };
  }

  revalidatePath("/aset");
  revalidatePath(`/aset/${asset.id}`);
  return { ok: true, gainLoss };
}
