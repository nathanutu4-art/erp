/**
 * Utilitas bersama modul Pembelian & Penjualan.
 * Tipe baris, label status Bahasa Indonesia, dan helper angka.
 */

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type CustomerOption = {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  is_active: boolean;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  is_active: boolean;
};

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
};

export type PoRow = {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
};

export type PoLineRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku: string | null;
  product_name: string | null;
  unit: string | null;
};

export type PoDetail = PoRow & { lines: PoLineRow[] };

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  faktur_pajak_number: string | null;
  notes: string | null;
  customer_code: string | null;
  customer_name: string | null;
};

export type InvoiceLineRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku: string | null;
  product_name: string | null;
  unit: string | null;
};

export type InvoicePaymentRow = {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
  notes: string | null;
};

export type InvoiceDetail = InvoiceRow & {
  lines: InvoiceLineRow[];
  payments: InvoicePaymentRow[];
};

export type DeliveryNoteRow = {
  id: string;
  delivery_number: string;
  invoice_id: string | null;
  delivery_date: string;
  recipient_name: string | null;
  status: string;
  notes: string | null;
  invoice_number: string | null;
  customer_name: string | null;
};

export type CompanyLetterhead = {
  companyName: string;
  address: string;
  phone: string;
  npwp: string;
};

export const PO_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  pending: "Menunggu Persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  sent: "Terkirim",
  partial: "Sebagian Dibayar",
  paid: "Lunas",
  overdue: "Jatuh Tempo",
  cancelled: "Dibatalkan",
};

export const SJ_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  shipped: "Dikirim",
  delivered: "Diterima",
  cancelled: "Dibatalkan",
};

export function statusLabel(
  status: string,
  map: Record<string, string>
): string {
  return map[status] ?? status;
}

/** "1.234,56" (id) atau "1234.56" (en) → number; NaN bila tak valid. */
export function parseDecimal(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  return Number(normalized);
}

/** Konversi nilai numeric Supabase (string|number) menjadi number aman. */
export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Tanggal hari ini YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validasi format YYYY-MM-DD. */
export function isDateValid(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Badge warna untuk status dokumen. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
    case "paid":
    case "delivered":
    case "done":
      return "bg-teal-400/20 text-teal-200 border-teal-300/40";
    case "pending":
    case "partial":
    case "shipped":
    case "sent":
      return "bg-amber-400/20 text-amber-200 border-amber-300/40";
    case "rejected":
    case "cancelled":
    case "overdue":
      return "bg-rose-400/20 text-rose-200 border-rose-300/40";
    default:
      return "bg-slate-400/20 text-slate-200 border-slate-300/40";
  }
}
