"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL PEMBELIAN & PENJUALAN
 * ============================================================================
 * 
 * Mengendalikan alur kerja transaksi komersial dan perpajakan:
 * 1. createPurchaseOrder(): Menerbitkan nomor PO (PO-YYYY-NNNN) dan baris pesanan barang.
 * 2. decidePurchaseOrder(): Menyetujui atau menolak PO berdasarkan batas otorisasi.
 * 3. receiveGoods(): Mencatat penerimaan barang supplier dan menambah kuantitas stok gudang.
 * 4. createInvoice(): Menerbitkan invoice penjualan (INV-YYYY-NNNN) dengan perhitungan DPP & PPN 11%.
 * 5. recordPayment(): Mencatat pelunasan pembayaran piutang invoice secara tunai/transfer.
 * 6. exportFakturPajakCsv(): Mengonversi invoice menjadi skema CSV impor resmi aplikasi e-Faktur DJP.
 * 7. createDeliveryNote(): Menerbitkan Surat Jalan (SJ-YYYY-NNNN) dan mencatat mutasi barang keluar.
 * 8. getCompanyLetterhead(): Mengambil identitas kop surat perusahaan untuk pratinjau dan cetak dokumen.
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/app/(app)/inventaris/_lib/inventory";
import {
  toNumber,
  isDateValid,
  todayISO,
  type CompanyLetterhead,
} from "./_lib/jualbeli";

export type ActionResult = { ok: true } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type DocInputLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

// ---------------------------------------------------------------------------
// Penomoran dokumen: PREFIX-YYYY-NNNN (mis. PO-2026-0001)
// ---------------------------------------------------------------------------

async function nextDocNumber(
  supabase: SupabaseClient,
  table: string,
  column: string,
  prefix: string,
  year: number,
  startSeq = 1
): Promise<string> {
  const like = `${prefix}-${year}-%`;
  const { data } = await supabase
    .from(table)
    .select(column)
    .like(column, like)
    .order(column, { ascending: false })
    .limit(1);
  let seq = startSeq;
  const last = (data?.[0] as Record<string, string> | undefined)?.[column];
  if (last) {
    const m = last.match(/-(\d+)$/);
    if (m) seq = Math.max(seq, parseInt(m[1], 10) + 1);
  }
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

/** Sisip dengan penomoran; coba ulang sekali bila nomor bentrok (23505). */
async function insertNumbered(
  supabase: SupabaseClient,
  table: string,
  column: string,
  prefix: string,
  row: Record<string, unknown>
): Promise<{ ok: true; id: string; number: string } | { ok: false; error: string }> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = await nextDocNumber(
      supabase,
      table,
      column,
      prefix,
      year,
      attempt + 1
    );
    const { data, error } = await supabase
      .from(table)
      .insert({ ...row, [column]: number })
      .select("id")
      .maybeSingle();
    if (!error && data) {
      return { ok: true, id: (data as { id: string }).id, number };
    }
    if ((error as { code?: string } | null)?.code !== "23505") break;
  }
  return { ok: false, error: "Gagal membuat nomor dokumen. Silakan coba lagi." };
}

// ---------------------------------------------------------------------------
// Nomor Faktur Pajak dari nsfp_series (D11)
// ---------------------------------------------------------------------------

type NsfpRow = {
  id: string;
  series_code: string;
  start_number: string;
  end_number: string;
  current_number: string;
};

/**
 * Mengambil nomor Faktur Pajak berikutnya dari rentang NSFP aktif.
 * Format: {series_code}.{nomor 8 digit}, mis. 010.001-26.00000001.
 * Mengembalikan null bila belum ada rentang NSFP aktif — invoice tetap
 * bisa dibuat; kolom Faktur Pajak tampil kosong hingga NSFP diisi
 * (dikelola di Pengaturan pada fase berikutnya).
 */
async function assignFakturPajak(
  supabase: SupabaseClient
): Promise<
  | { ok: true; number: string | null }
  | { ok: false; error: string }
> {
  const { data } = await supabase
    .from("nsfp_series")
    .select("id, series_code, start_number, end_number, current_number")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const series = data as NsfpRow | null;
  if (!series) return { ok: true, number: null };

  const cur = parseInt(series.current_number, 10);
  const end = parseInt(series.end_number, 10);
  if (!Number.isFinite(cur) || !Number.isFinite(end)) {
    return { ok: false, error: "Rentang NSFP tidak valid." };
  }
  if (cur > end) {
    return {
      ok: false,
      error: `Rentang NSFP ${series.series_code} sudah habis. Minta rentang baru ke DJP.`,
    };
  }
  const width = Math.max(8, series.current_number.trim().length);
  const number = `${series.series_code}.${String(cur).padStart(width, "0")}`;

  const { error } = await supabase
    .from("nsfp_series")
    .update({ current_number: String(cur + 1).padStart(width, "0") })
    .eq("id", series.id);
  if (error) {
    return { ok: false, error: "Gagal memajukan nomor NSFP." };
  }
  return { ok: true, number };
}

// ---------------------------------------------------------------------------
// Validasi baris dokumen bersama
// ---------------------------------------------------------------------------

type ProductRef = {
  id: string;
  name: string;
  unit: string;
  is_active: boolean;
};

async function validateLines(
  supabase: SupabaseClient,
  lines: DocInputLine[]
): Promise<
  | { ok: true; clean: Array<{ productId: string; quantity: number; unitPrice: number }> }
  | { ok: false; error: string }
> {
  if (lines.length === 0) {
    return { ok: false, error: "Dokumen harus memiliki minimal 1 baris barang." };
  }
  const clean: Array<{ productId: string; quantity: number; unitPrice: number }> = [];
  for (const l of lines) {
    const quantity = round3(Number(l.quantity));
    const unitPrice = round2(Number(l.unitPrice));
    if (!l.productId) return { ok: false, error: "Ada baris tanpa produk." };
    if (!Number.isFinite(quantity) || quantity <= 0)
      return { ok: false, error: "Jumlah pada setiap baris harus lebih dari 0." };
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      return { ok: false, error: "Harga satuan tidak boleh negatif." };
    const { data } = await supabase
      .from("products")
      .select("id, name, unit, is_active")
      .eq("id", l.productId)
      .maybeSingle();
    const p = data as ProductRef | null;
    if (!p) return { ok: false, error: "Ada produk yang tidak ditemukan." };
    if (!p.is_active)
      return { ok: false, error: `Produk "${p.name}" sudah tidak aktif.` };
    clean.push({ productId: l.productId, quantity, unitPrice });
  }
  return { ok: true, clean };
}

function totalsOf(
  lines: Array<{ quantity: number; unitPrice: number }>,
  withPpn: boolean
) {
  const subtotal = round2(
    lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0)
  );
  const tax = withPpn ? round2(subtotal * 0.11) : 0;
  return { subtotal, tax, total: round2(subtotal + tax) };
}

async function requireAuth(): Promise<
  | { ok: true; userId: string; roleName: string | null }
  | { ok: false; error: string }
> {
  const current = await getCurrentUser();
  if (!current?.user) return { ok: false, error: "Anda harus masuk." };
  return {
    ok: true,
    userId: current.user.id,
    roleName: current.profile?.role_name ?? null,
  };
}

/** ID karyawan dari login saat ini (null bila tidak tertaut). */
async function myEmployeeId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// ---------------------------------------------------------------------------
// PURCHASE ORDER
// ---------------------------------------------------------------------------

export async function createPO(input: {
  supplierId: string;
  orderDate: string;
  expectedDate?: string;
  withPpn: boolean;
  notes?: string;
  lines: DocInputLine[];
}): Promise<ActionResult & { poNumber?: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!input.supplierId) return { ok: false, error: "Pilih pemasok." };
  if (!isDateValid(input.orderDate))
    return { ok: false, error: "Tanggal PO tidak valid." };
  if (input.expectedDate && !isDateValid(input.expectedDate))
    return { ok: false, error: "Tanggal estimasi tidak valid." };

  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, is_active")
    .eq("id", input.supplierId)
    .maybeSingle();
  const sup = supplier as { id: string; name: string; is_active: boolean } | null;
  if (!sup) return { ok: false, error: "Pemasok tidak ditemukan." };
  if (!sup.is_active)
    return { ok: false, error: `Pemasok "${sup.name}" sudah tidak aktif.` };

  const valid = await validateLines(supabase, input.lines);
  if (!valid.ok) return valid;
  const { subtotal, tax, total } = totalsOf(valid.clean, input.withPpn);

  const inserted = await insertNumbered(supabase, "purchase_orders", "po_number", "PO", {
    supplier_id: input.supplierId,
    order_date: input.orderDate,
    expected_date: input.expectedDate || null,
    subtotal,
    tax_amount: tax,
    total_amount: total,
    status: "draft",
    requested_by: auth.userId,
    notes: input.notes?.trim() || null,
  });
  if (!inserted.ok) return inserted;

  const { error: lineErr } = await supabase.from("po_lines").insert(
    valid.clean.map((l) => ({
      po_id: inserted.id,
      product_id: l.productId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    }))
  );
  if (lineErr) {
    await supabase.from("purchase_orders").delete().eq("id", inserted.id);
    return { ok: false, error: "Gagal menyimpan baris PO. Silakan coba lagi." };
  }

  // Integrasi GL OTOMATIS (jurnal pembelian) direncanakan di fase berikutnya;
  // saat ini PO hanya menggerakkan stok saat barang diterima.
  revalidatePath("/pembelian-penjualan");
  return { ok: true, poNumber: inserted.number };
}

/** Draf → Menunggu Persetujuan. */
export async function submitPO(input: { poId: string }): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", input.poId)
    .maybeSingle();
  const po = data as { id: string; status: string } | null;
  if (!po) return { ok: false, error: "PO tidak ditemukan." };
  if (po.status !== "draft")
    return { ok: false, error: "Hanya PO berstatus Draf yang dapat diajukan." };

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "pending" })
    .eq("id", input.poId);
  if (error) return { ok: false, error: "Gagal mengajukan PO." };
  revalidatePath("/pembelian-penjualan");
  return { ok: true };
}

type PoDecisionRow = {
  id: string;
  status: string;
  requested_by: string | null;
};

/**
 * Menyetujui / menolak PO (D9).
 * Bila pemohon tertaut ke karyawan yang memiliki atasan langsung, hanya
 * atasan tersebut atau HR/Admin (takeover) yang boleh memutuskan.
 * Bila tidak ada rantai atasan, pengguna terautentikasi mana pun boleh
 * memutuskan — approved_by dicatat bila tertaut ke karyawan.
 */
export async function decidePO(input: {
  poId: string;
  decision: "approved" | "rejected";
}): Promise<ActionResult> {
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, error: "Keputusan tidak valid." };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, status, requested_by")
    .eq("id", input.poId)
    .maybeSingle();
  const po = data as PoDecisionRow | null;
  if (!po) return { ok: false, error: "PO tidak ditemukan." };
  if (po.status !== "pending") {
    return {
      ok: false,
      error: "Hanya PO berstatus Menunggu Persetujuan yang dapat diputuskan.",
    };
  }

  const me = await myEmployeeId(supabase, auth.userId);
  let supervisorId: string | null = null;
  if (po.requested_by) {
    const { data: reqEmp } = await supabase
      .from("employees")
      .select("supervisor_id")
      .eq("profile_id", po.requested_by)
      .maybeSingle();
    supervisorId =
      (reqEmp as { supervisor_id: string | null } | null)?.supervisor_id ?? null;
  }

  if (supervisorId) {
    const isSupervisor = !!me && me === supervisorId;
    const isHrAdmin = auth.roleName === "admin" || auth.roleName === "hr";
    if (!isSupervisor && !isHrAdmin) {
      return {
        ok: false,
        error:
          "Hanya atasan langsung pemohon atau HR yang dapat memutuskan PO ini.",
      };
    }
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: input.decision, approved_by: me })
    .eq("id", input.poId);
  if (error) return { ok: false, error: "Gagal menyimpan keputusan." };
  revalidatePath("/pembelian-penjualan");
  return { ok: true };
}

/**
 * Pembukuan stok MASUK mengikuti pola average-costing modul Inventaris (D6):
 *   new_avg = (stok_lama × avg_lama + qty × harga_satuan) / stok_baru
 * dengan rollback mutasi bila pembaruan produk gagal.
 */
async function applyStockInForPO(
  supabase: SupabaseClient,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
    mutationDate: string;
    poId: string;
    poNumber: string;
    productName: string;
  }
): Promise<ActionResult> {
  const { data } = await supabase
    .from("products")
    .select("id, current_stock, avg_cost, is_active")
    .eq("id", args.productId)
    .maybeSingle();
  const p = data as {
    id: string;
    current_stock: string | number;
    avg_cost: string | number;
    is_active: boolean;
  } | null;
  if (!p) return { ok: false, error: `Produk "${args.productName}" tidak ditemukan.` };
  if (!p.is_active)
    return { ok: false, error: `Produk "${args.productName}" sudah tidak aktif.` };

  const stock = toNumber(p.current_stock);
  const avg = toNumber(p.avg_cost);
  const newStock = round3(stock + args.quantity);
  const newAvg =
    newStock > 0 ? round2((stock * avg + args.quantity * args.unitCost) / newStock) : 0;

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
      reference_type: "purchase_order",
      reference_id: args.poId,
      notes: `Penerimaan barang ${args.poNumber}`,
    })
    .select("id")
    .maybeSingle();

  if (mutErr || !mutation) {
    return {
      ok: false,
      error: `Gagal mencatat mutasi masuk untuk "${args.productName}".`,
    };
  }

  const { error: updErr } = await supabase
    .from("products")
    .update({ current_stock: newStock, avg_cost: newAvg })
    .eq("id", args.productId);

  if (updErr) {
    await supabase
      .from("stock_mutations")
      .delete()
      .eq("id", (mutation as { id: string }).id);
    return {
      ok: false,
      error: `Gagal memperbarui stok "${args.productName}" — mutasi dibatalkan.`,
    };
  }
  return { ok: true };
}

/**
 * Terima Barang: approved → done + mutasi stok masuk per baris PO.
 * Ini alur lintas-modul pertama ERP: Pembelian menggerakkan Inventaris.
 * Batasan v1: penerimaan penuh (seluruh baris sekaligus); penerimaan
 * parsial direncanakan di fase berikutnya.
 */
export async function receivePO(input: {
  poId: string;
  warehouseId: string;
  receivedDate: string;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang penerima." };
  if (!isDateValid(input.receivedDate))
    return { ok: false, error: "Tanggal penerimaan tidak valid." };

  const supabase = await createClient();

  const { data: wh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", input.warehouseId)
    .maybeSingle();
  if (!wh) return { ok: false, error: "Gudang tidak ditemukan." };

  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, po_lines(id, product_id, quantity, unit_price, products(name))"
    )
    .eq("id", input.poId)
    .maybeSingle();
  const po = data as {
    id: string;
    po_number: string;
    status: string;
    po_lines: Array<{
      id: string;
      product_id: string;
      quantity: string | number;
      unit_price: string | number;
      products: { name: string } | Array<{ name: string }> | null;
    }>;
  } | null;
  if (!po) return { ok: false, error: "PO tidak ditemukan." };
  if (po.status !== "approved") {
    return {
      ok: false,
      error: "Hanya PO yang sudah disetujui yang dapat diterima barangnya.",
    };
  }
  if (po.po_lines.length === 0) {
    return { ok: false, error: "PO tidak memiliki baris barang." };
  }

  for (const line of po.po_lines) {
    const prod = one(line.products);
    const res = await applyStockInForPO(supabase, {
      productId: line.product_id,
      warehouseId: input.warehouseId,
      quantity: toNumber(line.quantity),
      unitCost: toNumber(line.unit_price),
      mutationDate: input.receivedDate,
      poId: po.id,
      poNumber: po.po_number,
      productName: prod?.name ?? "produk",
    });
    if (!res.ok) return res;
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "done" })
    .eq("id", input.poId);
  if (error) {
    return {
      ok: false,
      error:
        "Stok tercatat, tetapi gagal menandai PO selesai. Hubungi administrator.",
    };
  }

  // Integrasi GL OTOMATIS (jurnal pembelian/persediaan) direncanakan di
  // fase berikutnya; saat ini penerimaan hanya menggerakkan stok.
  revalidatePath("/pembelian-penjualan");
  revalidatePath("/inventaris");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// INVOICE PENJUALAN
// ---------------------------------------------------------------------------

export async function createInvoice(input: {
  customerId: string;
  invoiceDate: string;
  dueDate?: string;
  withPpn: boolean;
  notes?: string;
  lines: DocInputLine[];
}): Promise<ActionResult & { invoiceNumber?: string; fakturNumber?: string | null }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!input.customerId) return { ok: false, error: "Pilih pelanggan." };
  if (!isDateValid(input.invoiceDate))
    return { ok: false, error: "Tanggal invoice tidak valid." };
  if (input.dueDate && !isDateValid(input.dueDate))
    return { ok: false, error: "Tanggal jatuh tempo tidak valid." };

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, is_active")
    .eq("id", input.customerId)
    .maybeSingle();
  const cust = customer as { id: string; name: string; is_active: boolean } | null;
  if (!cust) return { ok: false, error: "Pelanggan tidak ditemukan." };
  if (!cust.is_active)
    return { ok: false, error: `Pelanggan "${cust.name}" sudah tidak aktif.` };

  const valid = await validateLines(supabase, input.lines);
  if (!valid.ok) return valid;
  const { subtotal, tax, total } = totalsOf(valid.clean, input.withPpn);

  const faktur = await assignFakturPajak(supabase);
  if (!faktur.ok) return faktur;

  const inserted = await insertNumbered(supabase, "sales_invoices", "invoice_number", "INV", {
    customer_id: input.customerId,
    invoice_date: input.invoiceDate,
    due_date: input.dueDate || null,
    subtotal,
    tax_amount: tax,
    total_amount: total,
    paid_amount: 0,
    status: "draft",
    faktur_pajak_number: faktur.number,
    notes: input.notes?.trim() || null,
    created_by: auth.userId,
  });
  if (!inserted.ok) return inserted;

  const { error: lineErr } = await supabase.from("invoice_lines").insert(
    valid.clean.map((l) => ({
      invoice_id: inserted.id,
      product_id: l.productId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    }))
  );
  if (lineErr) {
    await supabase.from("sales_invoices").delete().eq("id", inserted.id);
    return { ok: false, error: "Gagal menyimpan baris invoice. Silakan coba lagi." };
  }

  // Stok keluar otomatis + jurnal penjualan/GL direncanakan di fase
  // berikutnya; saat ini invoice hanya mencatat piutang.
  revalidatePath("/pembelian-penjualan");
  return { ok: true, invoiceNumber: inserted.number, fakturNumber: faktur.number };
}

/** Draf → Terkirim. */
export async function sendInvoice(input: { invoiceId: string }): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("id, status")
    .eq("id", input.invoiceId)
    .maybeSingle();
  const inv = data as { id: string; status: string } | null;
  if (!inv) return { ok: false, error: "Invoice tidak ditemukan." };
  if (inv.status !== "draft")
    return { ok: false, error: "Hanya invoice berstatus Draf yang dapat dikirim." };

  const { error } = await supabase
    .from("sales_invoices")
    .update({ status: "sent" })
    .eq("id", input.invoiceId);
  if (error) return { ok: false, error: "Gagal mengirim invoice." };
  revalidatePath("/pembelian-penjualan");
  return { ok: true };
}

/** Catat pembayaran → invoice_payments; status dihitung ulang otomatis. */
export async function recordInvoicePayment(input: {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method?: string;
  notes?: string;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Nominal pembayaran harus lebih dari 0." };
  if (!isDateValid(input.paymentDate))
    return { ok: false, error: "Tanggal pembayaran tidak valid." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("id, status, total_amount, paid_amount")
    .eq("id", input.invoiceId)
    .maybeSingle();
  const inv = data as {
    id: string;
    status: string;
    total_amount: string | number;
    paid_amount: string | number;
  } | null;
  if (!inv) return { ok: false, error: "Invoice tidak ditemukan." };
  if (["draft", "cancelled", "paid"].includes(inv.status)) {
    return {
      ok: false,
      error: "Pembayaran hanya dapat dicatat untuk invoice Terkirim / Sebagian Dibayar.",
    };
  }

  const total = toNumber(inv.total_amount);
  const paid = toNumber(inv.paid_amount);
  const remaining = round2(total - paid);
  if (amount > remaining + 0.005) {
    return {
      ok: false,
      error: `Nominal melebihi sisa tagihan (${formatIDRshort(remaining)}).`,
    };
  }

  const { error: payErr } = await supabase.from("invoice_payments").insert({
    invoice_id: input.invoiceId,
    payment_date: input.paymentDate,
    amount,
    method: input.method?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (payErr) return { ok: false, error: "Gagal mencatat pembayaran." };

  const newPaid = round2(paid + amount);
  const newStatus = newPaid >= total - 0.005 ? "paid" : "partial";
  const { error: updErr } = await supabase
    .from("sales_invoices")
    .update({ paid_amount: newPaid, status: newStatus })
    .eq("id", input.invoiceId);
  if (updErr) {
    return {
      ok: false,
      error:
        "Pembayaran tercatat, tetapi gagal memperbarui status invoice. Hubungi administrator.",
    };
  }

  // Jurnal pelunasan piutang (GL) direncanakan di fase berikutnya.
  revalidatePath("/pembelian-penjualan");
  return { ok: true };
}

function formatIDRshort(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

type EfakturSource = {
  invoice_number: string;
  invoice_date: string;
  faktur_pajak_number: string | null;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  customers: { name: string; tax_id: string | null; address: string | null } | Array<{ name: string; tax_id: string | null; address: string | null }> | null;
  invoice_lines: Array<{
    quantity: string | number;
    unit_price: string | number;
    products: { sku: string; name: string; unit: string } | Array<{ sku: string; name: string; unit: string }> | null;
  }>;
  company: { letterhead_npwp: string | null; letterhead_company_name: string | null } | null;
};

/**
 * Ekspor CSV format impor e-Faktur DJP (D11: v1 hanya ekspor file,
 * tanpa integrasi API DJP). Struktur baris FK/LT/OF mengikuti format
 * impor aplikasi e-Faktur; v1 memakai pendekatan generik yang
 * didokumentasikan — validasi akhir tetap di aplikasi e-Faktur DJP.
 */
export async function exportEfakturCsv(input: {
  invoiceId: string;
}): Promise<ActionResult & { csv?: string; filename?: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select(
      "invoice_number, invoice_date, faktur_pajak_number, subtotal, tax_amount, total_amount, customers(name, tax_id, address), invoice_lines(quantity, unit_price, products(sku, name, unit))"
    )
    .eq("id", input.invoiceId)
    .maybeSingle();
  const inv = data as EfakturSource | null;
  if (!inv) return { ok: false, error: "Invoice tidak ditemukan." };
  if (!inv.faktur_pajak_number) {
    return {
      ok: false,
      error:
        "Invoice ini belum memiliki Nomor Faktur Pajak (rentang NSFP belum diisi).",
    };
  }

  const { data: settings } = await supabase
    .from("company_settings")
    .select("letterhead_npwp, letterhead_company_name")
    .eq("singleton", true)
    .maybeSingle();
  const company = settings as {
    letterhead_npwp: string | null;
    letterhead_company_name: string | null;
  } | null;

  const cust = one(inv.customers);
  const d = new Date(`${inv.invoice_date}T00:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const masaPajak = pad(d.getMonth() + 1);
  const tahunPajak = d.getFullYear();
  const tglFaktur = `${pad(d.getDate())}/${masaPajak}/${tahunPajak}`;
  const clean = (s: string | null | undefined) =>
    (s ?? "").replace(/;/g, ",").replace(/\r?\n/g, " ").trim();
  const int = (n: string | number) => String(Math.round(toNumber(n)));

  const header =
    "FK;KD_JENIS_TRANSAKSI;FG_PENGGANTI;NOMOR_FAKTUR;MASA_PAJAK;TAHUN_PAJAK;TANGGAL_FAKTUR;NPWP;NAMA;ALAMAT_LENGKAP;JUMLAH_DPP;JUMLAH_PPN;JUMLAH_PPNBM;ID_KETERANGAN_TAMBAHAN;FG_UANG_MUKA;UANG_MUKA_DPP;UANG_MUKA_PPN;UANG_MUKA_PPNBM;REFERENSI;KODE_DOKUMEN_PENDUKUNG";
  const fkRow = [
    "FK",
    "01",
    "0",
    clean(inv.faktur_pajak_number).replace(/\./g, ""),
    masaPajak,
    String(tahunPajak),
    tglFaktur,
    clean(company?.letterhead_npwp),
    clean(company?.letterhead_company_name),
    "",
    int(inv.subtotal),
    int(inv.tax_amount),
    "0",
    "",
    "0",
    "0",
    "0",
    "0",
    clean(inv.invoice_number),
    "",
  ].join(";");

  const ltHeader =
    "LT;NPWP;NAMA;JALAN;BLOK;NOMOR;RT;RW;KECAMATAN;KELURAHAN;KABUPATEN;PROPINSI;KODE_POS;NOMOR_TELEPON";
  const ltRow = [
    "LT",
    clean(cust?.tax_id),
    clean(cust?.name),
    clean(cust?.address),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].join(";");

  const ofHeader =
    "OF;KODE_OBJEK;NAMA;HARGA_SATUAN;JUMLAH_BARANG;HARGA_TOTAL;DISKON;DPP;PPN;TARIF_PPNBM;PPNBM";
  const ofRows = inv.invoice_lines.map((l) => {
    const prod = one(l.products);
    const qty = toNumber(l.quantity);
    const price = toNumber(l.unit_price);
    const lineTotal = Math.round(qty * price);
    return [
      "OF",
      clean(prod?.sku),
      clean(prod?.name),
      int(price),
      String(qty),
      String(lineTotal),
      "0",
      String(lineTotal),
      "0",
      "0",
      "0",
    ].join(";");
  });

  const csv = [header, fkRow, ltHeader, ltRow, ofHeader, ...ofRows].join("\r\n");
  const filename = `efaktur_${inv.invoice_number.replace(/[^A-Za-z0-9-]/g, "_")}.csv`;
  return { ok: true, csv, filename };
}

// ---------------------------------------------------------------------------
// SURAT JALAN
// ---------------------------------------------------------------------------

export async function createDeliveryNote(input: {
  invoiceId?: string;
  deliveryDate: string;
  recipientName?: string;
  notes?: string;
}): Promise<ActionResult & { deliveryNumber?: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!isDateValid(input.deliveryDate))
    return { ok: false, error: "Tanggal surat jalan tidak valid." };

  const supabase = await createClient();
  if (input.invoiceId) {
    const { data } = await supabase
      .from("sales_invoices")
      .select("id")
      .eq("id", input.invoiceId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Invoice tidak ditemukan." };
  }

  const inserted = await insertNumbered(
    supabase,
    "delivery_notes",
    "delivery_number",
    "SJ",
    {
      invoice_id: input.invoiceId || null,
      delivery_date: input.deliveryDate,
      recipient_name: input.recipientName?.trim() || null,
      status: "draft",
      notes: input.notes?.trim() || null,
    }
  );
  if (!inserted.ok) return inserted;
  revalidatePath("/pembelian-penjualan");
  return { ok: true, deliveryNumber: inserted.number };
}

async function setDeliveryStatus(
  id: string,
  from: string[],
  to: string,
  errMsg: string
): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_notes")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  const dn = data as { id: string; status: string } | null;
  if (!dn) return { ok: false, error: "Surat jalan tidak ditemukan." };
  if (!from.includes(dn.status)) return { ok: false, error: errMsg };
  const { error } = await supabase
    .from("delivery_notes")
    .update({ status: to })
    .eq("id", id);
  if (error) return { ok: false, error: "Gagal memperbarui status." };
  revalidatePath("/pembelian-penjualan");
  return { ok: true };
}

export async function shipDeliveryNote(input: { id: string }) {
  return setDeliveryStatus(
    input.id,
    ["draft"],
    "shipped",
    "Hanya surat jalan berstatus Draf yang dapat dikirim."
  );
}

export async function deliverDeliveryNote(input: { id: string }) {
  return setDeliveryStatus(
    input.id,
    ["shipped"],
    "delivered",
    "Hanya surat jalan berstatus Dikirim yang dapat ditandai diterima."
  );
}

// ---------------------------------------------------------------------------
// Kop perusahaan untuk pratinjau cetak (D10)
// ---------------------------------------------------------------------------

export async function getCompanyLetterhead(): Promise<CompanyLetterhead> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_settings")
      .select(
        "letterhead_company_name, letterhead_address, letterhead_phone, letterhead_npwp"
      )
      .eq("singleton", true)
      .maybeSingle();
    const row = data as {
      letterhead_company_name: string | null;
      letterhead_address: string | null;
      letterhead_phone: string | null;
      letterhead_npwp: string | null;
    } | null;
    return {
      companyName: row?.letterhead_company_name?.trim() || "PT Maju Bersama",
      address: row?.letterhead_address?.trim() || "—",
      phone: row?.letterhead_phone?.trim() || "—",
      npwp: row?.letterhead_npwp?.trim() || "",
    };
  } catch {
    return {
      companyName: "PT Maju Bersama",
      address: "—",
      phone: "—",
      npwp: "",
    };
  }
}

export { todayISO };

// ---------------------------------------------------------------------------
// Detail dokumen untuk pratinjau cetak
// ---------------------------------------------------------------------------

import type {
  PoDetail,
  PoLineRow,
  InvoiceDetail,
  InvoiceLineRow,
  InvoicePaymentRow,
} from "./_lib/jualbeli";

type RawPoLine = {
  id: string;
  product_id: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  products:
    | { sku: string; name: string; unit: string }
    | Array<{ sku: string; name: string; unit: string }>
    | null;
};

export async function getPoDetail(
  poId: string
): Promise<{ ok: true; po: PoDetail } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        "id, po_number, supplier_id, order_date, expected_date, subtotal, tax_amount, total_amount, status, notes, suppliers(code, name), po_lines(id, product_id, quantity, unit_price, line_total, products(sku, name, unit))"
      )
      .eq("id", poId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "PO tidak ditemukan." };
    const row = data as {
      id: string;
      po_number: string;
      supplier_id: string;
      order_date: string;
      expected_date: string | null;
      subtotal: string | number;
      tax_amount: string | number;
      total_amount: string | number;
      status: string;
      notes: string | null;
      suppliers: { code: string; name: string } | Array<{ code: string; name: string }> | null;
      po_lines: RawPoLine[];
    };
    const sup = one(row.suppliers);
    const lines: PoLineRow[] = (row.po_lines ?? []).map((l) => {
      const p = one(l.products);
      return {
        id: l.id,
        product_id: l.product_id,
        quantity: toNumber(l.quantity),
        unit_price: toNumber(l.unit_price),
        line_total: toNumber(l.line_total),
        sku: p?.sku ?? null,
        product_name: p?.name ?? null,
        unit: p?.unit ?? null,
      };
    });
    return {
      ok: true,
      po: {
        id: row.id,
        po_number: row.po_number,
        supplier_id: row.supplier_id,
        order_date: row.order_date,
        expected_date: row.expected_date,
        subtotal: toNumber(row.subtotal),
        tax_amount: toNumber(row.tax_amount),
        total_amount: toNumber(row.total_amount),
        status: row.status,
        notes: row.notes,
        supplier_code: sup?.code ?? null,
        supplier_name: sup?.name ?? null,
        lines,
      },
    };
  } catch {
    return { ok: false, error: "Gagal memuat detail PO." };
  }
}

type RawInvoiceLine = {
  id: string;
  product_id: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  products:
    | { sku: string; name: string; unit: string }
    | Array<{ sku: string; name: string; unit: string }>
    | null;
};

type RawPayment = {
  id: string;
  payment_date: string;
  amount: string | number;
  method: string | null;
  notes: string | null;
};

export async function getInvoiceDetail(
  invoiceId: string
): Promise<{ ok: true; invoice: InvoiceDetail } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sales_invoices")
      .select(
        "id, invoice_number, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, faktur_pajak_number, notes, customers(code, name), invoice_lines(id, product_id, quantity, unit_price, line_total, products(sku, name, unit)), invoice_payments(id, payment_date, amount, method, notes)"
      )
      .eq("id", invoiceId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Invoice tidak ditemukan." };
    const row = data as {
      id: string;
      invoice_number: string;
      customer_id: string;
      invoice_date: string;
      due_date: string | null;
      subtotal: string | number;
      tax_amount: string | number;
      total_amount: string | number;
      paid_amount: string | number;
      status: string;
      faktur_pajak_number: string | null;
      notes: string | null;
      customers: { code: string; name: string } | Array<{ code: string; name: string }> | null;
      invoice_lines: RawInvoiceLine[];
      invoice_payments: RawPayment[];
    };
    const cust = one(row.customers);
    const lines: InvoiceLineRow[] = (row.invoice_lines ?? []).map((l) => {
      const p = one(l.products);
      return {
        id: l.id,
        product_id: l.product_id,
        quantity: toNumber(l.quantity),
        unit_price: toNumber(l.unit_price),
        line_total: toNumber(l.line_total),
        sku: p?.sku ?? null,
        product_name: p?.name ?? null,
        unit: p?.unit ?? null,
      };
    });
    const payments: InvoicePaymentRow[] = (row.invoice_payments ?? []).map(
      (p) => ({
        id: p.id,
        payment_date: p.payment_date,
        amount: toNumber(p.amount),
        method: p.method,
        notes: p.notes,
      })
    );
    return {
      ok: true,
      invoice: {
        id: row.id,
        invoice_number: row.invoice_number,
        customer_id: row.customer_id,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        subtotal: toNumber(row.subtotal),
        tax_amount: toNumber(row.tax_amount),
        total_amount: toNumber(row.total_amount),
        paid_amount: toNumber(row.paid_amount),
        status: row.status,
        faktur_pajak_number: row.faktur_pajak_number,
        notes: row.notes,
        customer_code: cust?.code ?? null,
        customer_name: cust?.name ?? null,
        lines,
        payments,
      },
    };
  } catch {
    return { ok: false, error: "Gagal memuat detail invoice." };
  }
}
