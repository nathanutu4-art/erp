"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL INVENTARIS & GUDANG
 * ============================================================================
 * 
 * Mengatur seluruh mutasi fisik dan penilaian nilai persediaan barang:
 * 1. createProduct(): Menambahkan item barang baru dengan penetapan SKU dan satuan stok.
 * 2. recordStockMovement(): Mencatat pergerakan barang (Stok Masuk, Stok Keluar, Opname Fisik, Transfer Antar Gudang).
 * 3. updateMovingAverage(): Memperbarui Harga Pokok Penjualan (HPP) berdasarkan formula rata-rata tertimbang.
 * 4. createWarehouse(): Menambahkan lokasi gudang penyimpanan baru.
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toNumber,
  one,
  isDateValid,
  todayISO,
  formatQty,
  type MutationDirection,
} from "./_lib/inventory";

export type ActionResult = { ok: true } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type ProductRef = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: string | number;
  avg_cost: string | number;
  is_active: boolean;
};

async function getProduct(
  supabase: SupabaseClient,
  productId: string
): Promise<
  | { ok: true; stock: number; avg: number; unit: string; name: string }
  | { ok: false; error: string }
> {
  const { data } = await supabase
    .from("products")
    .select("id, sku, name, unit, current_stock, avg_cost, is_active")
    .eq("id", productId)
    .maybeSingle();
  const p = data as ProductRef | null;
  if (!p) return { ok: false, error: "Produk tidak ditemukan." };
  if (!p.is_active)
    return { ok: false, error: `Produk "${p.name}" sudah tidak aktif.` };
  return {
    ok: true,
    stock: toNumber(p.current_stock),
    avg: toNumber(p.avg_cost),
    unit: p.unit || "pcs",
    name: p.name,
  };
}

async function getWarehouse(
  supabase: SupabaseClient,
  warehouseId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Gudang tidak ditemukan." };
  return { ok: true };
}

/**
 * Inti pembukuan stok MASUK dengan metode Average (D6):
 *   new_avg = (old_stock × old_avg + qty × unit_cost) / (old_stock + qty)
 * Mencatat baris mutasi (dengan snapshot resulting_avg_cost) lalu
 * memperbarui products.current_stock & products.avg_cost.
 * Bila pembaruan produk gagal, mutasi dibatalkan (rollback) agar
 * trail dan saldo tidak pernah berpisah.
 */
async function applyStockIn(
  supabase: SupabaseClient,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
    mutationDate: string;
    referenceType: string;
    notes?: string | null;
  }
): Promise<ActionResult> {
  const prod = await getProduct(supabase, args.productId);
  if (!prod.ok) return prod;
  const wh = await getWarehouse(supabase, args.warehouseId);
  if (!wh.ok) return wh;

  const newStock = round3(prod.stock + args.quantity);
  const newAvg =
    newStock > 0
      ? round2(
          (prod.stock * prod.avg + args.quantity * args.unitCost) / newStock
        )
      : 0;

  const { data: mutation, error: mutErr } = await supabase
    .from("stock_mutations")
    .insert({
      product_id: args.productId,
      warehouse_id: args.warehouseId,
      mutation_date: args.mutationDate,
      direction: "in",
      quantity: args.quantity,
      unit_cost: args.unitCost,
      resulting_avg_cost: newAvg,
      reference_type: args.referenceType,
      notes: args.notes?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (mutErr || !mutation) {
    return { ok: false, error: "Gagal mencatat mutasi stok masuk." };
  }

  const { error: updErr } = await supabase
    .from("products")
    .update({ current_stock: newStock, avg_cost: newAvg })
    .eq("id", args.productId);

  if (updErr) {
    // Rollback: hapus mutasi agar trail dan saldo tetap konsisten.
    await supabase
      .from("stock_mutations")
      .delete()
      .eq("id", (mutation as { id: string }).id);
    return {
      ok: false,
      error:
        "Mutasi tercatat tetapi gagal memperbarui stok produk — dibatalkan. Silakan coba lagi.",
    };
  }

  return { ok: true };
}

/**
 * Inti pembukuan stok KELUAR: HPP diambil pada average saat ini
 * (average tidak berubah oleh mutasi keluar).
 */
async function applyStockOut(
  supabase: SupabaseClient,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    mutationDate: string;
    referenceType: string;
    notes?: string | null;
  }
): Promise<ActionResult> {
  const prod = await getProduct(supabase, args.productId);
  if (!prod.ok) return prod;
  const wh = await getWarehouse(supabase, args.warehouseId);
  if (!wh.ok) return wh;

  if (args.quantity > round3(prod.stock) + 1e-9) {
    return {
      ok: false,
      error: `Stok tidak mencukupi. Stok "${prod.name}" saat ini ${formatQty(prod.stock)} ${prod.unit}.`,
    };
  }

  const newStock = round3(prod.stock - args.quantity);

  const { data: mutation, error: mutErr } = await supabase
    .from("stock_mutations")
    .insert({
      product_id: args.productId,
      warehouse_id: args.warehouseId,
      mutation_date: args.mutationDate,
      direction: "out",
      quantity: args.quantity,
      unit_cost: null,
      resulting_avg_cost: round2(prod.avg),
      reference_type: args.referenceType,
      notes: args.notes?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (mutErr || !mutation) {
    return { ok: false, error: "Gagal mencatat mutasi stok keluar." };
  }

  const { error: updErr } = await supabase
    .from("products")
    .update({ current_stock: newStock })
    .eq("id", args.productId);

  if (updErr) {
    await supabase
      .from("stock_mutations")
      .delete()
      .eq("id", (mutation as { id: string }).id);
    return {
      ok: false,
      error:
        "Mutasi tercatat tetapi gagal memperbarui stok produk — dibatalkan. Silakan coba lagi.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Produk
// ---------------------------------------------------------------------------

export async function createProduct(input: {
  sku: string;
  name: string;
  category?: string;
  unit?: string;
  minStock?: number;
  initialStock?: number;
  initialUnitCost?: number;
  warehouseId?: string;
  mutationDate?: string;
}): Promise<ActionResult> {
  const sku = input.sku.trim();
  const name = input.name.trim();
  if (!sku) return { ok: false, error: "SKU / kode produk wajib diisi." };
  if (!name) return { ok: false, error: "Nama produk wajib diisi." };

  const unit = input.unit?.trim() || "pcs";
  const minStock = round3(Number(input.minStock ?? 0));
  const initialStock = round3(Number(input.initialStock ?? 0));
  const initialUnitCost = round2(Number(input.initialUnitCost ?? 0));
  if (!Number.isFinite(minStock) || minStock < 0)
    return { ok: false, error: "Stok minimum tidak valid." };
  if (!Number.isFinite(initialStock) || initialStock < 0)
    return { ok: false, error: "Stok awal tidak valid." };
  if (!Number.isFinite(initialUnitCost) || initialUnitCost < 0)
    return { ok: false, error: "HPP awal tidak valid." };

  const mutationDate = isDateValid(input.mutationDate)
    ? input.mutationDate!
    : todayISO();

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("sku", sku)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `SKU "${sku}" sudah digunakan.` };
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      sku,
      name,
      category: input.category?.trim() || null,
      unit,
      min_stock: minStock,
      current_stock: 0,
      avg_cost: 0,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    if ((error as { code?: string } | null)?.code === "23505") {
      return { ok: false, error: `SKU "${sku}" sudah digunakan.` };
    }
    return { ok: false, error: "Gagal menyimpan produk. Silakan coba lagi." };
  }
  const productId = (inserted as { id: string }).id;

  // Stok awal dibukukan sebagai mutasi "Saldo Awal" agar trail lengkap.
  if (initialStock > 0) {
    let warehouseId = input.warehouseId?.trim() || "";
    if (!warehouseId) {
      const { data: wh } = await supabase
        .from("warehouses")
        .select("id")
        .order("is_default", { ascending: false })
        .order("code")
        .limit(1)
        .maybeSingle();
      warehouseId = (wh as { id: string } | null)?.id ?? "";
    }
    if (!warehouseId) {
      await supabase.from("products").delete().eq("id", productId);
      return {
        ok: false,
        error:
          "Buat gudang terlebih dahulu sebelum memberi stok awal pada produk.",
      };
    }
    const res = await applyStockIn(supabase, {
      productId,
      warehouseId,
      quantity: initialStock,
      unitCost: initialUnitCost,
      mutationDate,
      referenceType: "saldo_awal",
      notes: "Stok awal produk",
    });
    if (!res.ok) {
      await supabase.from("products").delete().eq("id", productId);
      return res;
    }
  }

  revalidatePath("/inventaris");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Gudang
// ---------------------------------------------------------------------------

export async function createWarehouse(input: {
  code: string;
  name: string;
  address?: string;
}): Promise<ActionResult> {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { ok: false, error: "Kode gudang wajib diisi." };
  if (!name) return { ok: false, error: "Nama gudang wajib diisi." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Kode gudang "${code}" sudah digunakan.` };
  }

  const { error } = await supabase.from("warehouses").insert({
    code,
    name,
    address: input.address?.trim() || null,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: `Kode gudang "${code}" sudah digunakan.` };
    }
    return { ok: false, error: "Gagal menyimpan gudang. Silakan coba lagi." };
  }

  revalidatePath("/inventaris");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mutasi stok: Masuk / Keluar / Opname
// ---------------------------------------------------------------------------

export async function recordStockIn(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  mutationDate: string;
  notes?: string;
}): Promise<ActionResult> {
  const quantity = round3(Number(input.quantity));
  const unitCost = round2(Number(input.unitCost));
  if (!input.productId) return { ok: false, error: "Pilih produk." };
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang." };
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { ok: false, error: "Jumlah masuk harus lebih dari 0." };
  if (!Number.isFinite(unitCost) || unitCost < 0)
    return { ok: false, error: "HPP per unit tidak boleh negatif." };
  if (!isDateValid(input.mutationDate))
    return { ok: false, error: "Tanggal mutasi tidak valid." };

  const supabase = await createClient();
  const res = await applyStockIn(supabase, {
    productId: input.productId,
    warehouseId: input.warehouseId,
    quantity,
    unitCost,
    mutationDate: input.mutationDate,
    referenceType: "manual",
    notes: input.notes,
  });
  if (res.ok) revalidatePath("/inventaris");
  return res;
}

export async function recordStockOut(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  mutationDate: string;
  notes?: string;
}): Promise<ActionResult> {
  const quantity = round3(Number(input.quantity));
  if (!input.productId) return { ok: false, error: "Pilih produk." };
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang." };
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { ok: false, error: "Jumlah keluar harus lebih dari 0." };
  if (!isDateValid(input.mutationDate))
    return { ok: false, error: "Tanggal mutasi tidak valid." };

  const supabase = await createClient();
  const res = await applyStockOut(supabase, {
    productId: input.productId,
    warehouseId: input.warehouseId,
    quantity,
    mutationDate: input.mutationDate,
    referenceType: "manual",
    notes: input.notes,
  });
  if (res.ok) revalidatePath("/inventaris");
  return res;
}

/**
 * Stok opname: selisih antara hitungan fisik dan stok sistem dibukukan
 * sebagai mutasi penyesuaian. Stok masuk opname memakai HPP average
 * berjalan sehingga average tidak berubah; stok keluar opname memakai
 * HPP pada average berjalan (unit_cost NULL sesuai skema).
 */
export async function recordOpname(input: {
  productId: string;
  warehouseId: string;
  physicalCount: number;
  mutationDate: string;
  notes?: string;
}): Promise<ActionResult & { noDiff?: boolean }> {
  const physical = round3(Number(input.physicalCount));
  if (!input.productId) return { ok: false, error: "Pilih produk." };
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang." };
  if (!Number.isFinite(physical) || physical < 0)
    return { ok: false, error: "Hasil hitung fisik tidak valid." };
  if (!isDateValid(input.mutationDate))
    return { ok: false, error: "Tanggal opname tidak valid." };

  const supabase = await createClient();
  const prod = await getProduct(supabase, input.productId);
  if (!prod.ok) return prod;
  const wh = await getWarehouse(supabase, input.warehouseId);
  if (!wh.ok) return wh;

  const diff = round3(physical - prod.stock);
  if (Math.abs(diff) < 0.0005) {
    return {
      ok: true,
      noDiff: true,
    };
  }

  const notes =
    `Opname: fisik ${formatQty(physical)}, sistem ${formatQty(prod.stock)}` +
    (input.notes?.trim() ? ` — ${input.notes.trim()}` : "");

  let res: ActionResult;
  if (diff > 0) {
    // Masuk: HPP = average berjalan → average tidak berubah.
    res = await applyStockIn(supabase, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: diff,
      unitCost: round2(prod.avg),
      mutationDate: input.mutationDate,
      referenceType: "opname",
      notes,
    });
  } else {
    res = await applyStockOut(supabase, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: -diff,
      mutationDate: input.mutationDate,
      referenceType: "opname",
      notes,
    });
  }
  if (res.ok) revalidatePath("/inventaris");
  return res;
}

// ---------------------------------------------------------------------------
// Kartu Stok
// ---------------------------------------------------------------------------

export type KartuStokRow = {
  id: string;
  mutationDate: string;
  direction: MutationDirection;
  warehouseCode: string | null;
  warehouseName: string | null;
  quantity: number;
  unitCost: number | null;
  resultingAvg: number | null;
  referenceType: string | null;
  notes: string | null;
  runningStock: number;
  runningAvg: number | null;
};

export type KartuStokResult =
  | {
      ok: true;
      product: { sku: string; name: string; unit: string };
      openingStock: number;
      openingAvg: number;
      rows: KartuStokRow[];
    }
  | { ok: false; error: string };

type RawMutation = {
  id: string;
  mutation_date: string;
  direction: string;
  quantity: string | number;
  unit_cost: string | number | null;
  resulting_avg_cost: string | number | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
  warehouse:
    | { code: string; name: string }
    | Array<{ code: string; name: string }>
    | null;
};

/**
 * Kartu stok: seluruh mutasi produk secara kronologis beserta
 * stok berjalan dan snapshot HPP average per baris.
 * Catatan: HPP average bersifat global per produk (bukan per gudang),
 * sehingga kolom HPP menampilkan snapshot global pada tiap mutasi.
 */
export async function getKartuStok(input: {
  productId: string;
  warehouseId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}): Promise<KartuStokResult> {
  if (!input.productId) {
    return { ok: false, error: "Pilih produk terlebih dahulu." };
  }
  const from = isDateValid(input.fromDate) ? input.fromDate! : null;
  const to = isDateValid(input.toDate) ? input.toDate! : null;
  if (from && to && from > to) {
    return {
      ok: false,
      error: "Tanggal awal tidak boleh melebihi tanggal akhir.",
    };
  }

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, sku, name, unit")
    .eq("id", input.productId)
    .maybeSingle();
  const prod = product as {
    id: string;
    sku: string;
    name: string;
    unit: string;
  } | null;
  if (!prod) return { ok: false, error: "Produk tidak ditemukan." };

  let query = supabase
    .from("stock_mutations")
    .select(
      "id, mutation_date, direction, quantity, unit_cost, resulting_avg_cost, reference_type, notes, created_at, warehouse:warehouses(code, name)"
    )
    .eq("product_id", input.productId)
    .order("mutation_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);
  if (input.warehouseId) query = query.eq("warehouse_id", input.warehouseId);

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: "Gagal memuat kartu stok." };
  }

  let openingStock = 0;
  let openingAvg = 0;
  const inRange: RawMutation[] = [];

  for (const m of ((data ?? []) as RawMutation[])) {
    const d = m.mutation_date.slice(0, 10);
    const qty = toNumber(m.quantity);
    const signed = m.direction === "in" ? qty : -qty;
    if (from && d < from) {
      openingStock = round3(openingStock + signed);
      if (m.resulting_avg_cost != null)
        openingAvg = toNumber(m.resulting_avg_cost);
      continue;
    }
    if (to && d > to) continue;
    inRange.push(m);
  }

  let running = openingStock;
  const rows: KartuStokRow[] = inRange.map((m) => {
    const qty = toNumber(m.quantity);
    running = round3(running + (m.direction === "in" ? qty : -qty));
    const wh = one(m.warehouse);
    const avg =
      m.resulting_avg_cost == null ? null : toNumber(m.resulting_avg_cost);
    return {
      id: m.id,
      mutationDate: m.mutation_date,
      direction: (m.direction === "in" ? "in" : "out") as MutationDirection,
      warehouseCode: wh?.code ?? null,
      warehouseName: wh?.name ?? null,
      quantity: qty,
      unitCost: m.unit_cost == null ? null : toNumber(m.unit_cost),
      resultingAvg: avg,
      referenceType: m.reference_type,
      notes: m.notes,
      runningStock: running,
      runningAvg: avg,
    };
  });

  return {
    ok: true,
    product: { sku: prod.sku, name: prod.name, unit: prod.unit || "pcs" },
    openingStock: round3(openingStock),
    openingAvg,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Ringkasan untuk dasbor modul (dipakai tab Gudang)
// ---------------------------------------------------------------------------

export type WarehouseSummary = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_default: boolean;
  estimatedStock: number;
};

export async function getWarehouseSummaries(): Promise<WarehouseSummary[]> {
  const supabase = await createClient();
  const [{ data: whs }, { data: muts }] = await Promise.all([
    supabase.from("warehouses").select("id, code, name, address, is_default").order("code"),
    supabase
      .from("stock_mutations")
      .select("warehouse_id, direction, quantity")
      .limit(5000),
  ]);
  const net = new Map<string, number>();
  for (const m of ((muts ?? []) as Array<{
    warehouse_id: string | null;
    direction: string;
    quantity: string | number;
  }>)) {
    if (!m.warehouse_id) continue;
    const q = toNumber(m.quantity);
    net.set(
      m.warehouse_id,
      round3((net.get(m.warehouse_id) ?? 0) + (m.direction === "in" ? q : -q))
    );
  }
  return (
    ((whs ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      address: string | null;
      is_default: boolean;
    }>).map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      is_default: w.is_default,
      estimatedStock: net.get(w.id) ?? 0,
    }))
  );
}
