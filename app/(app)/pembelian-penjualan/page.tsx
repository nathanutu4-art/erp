import { createClient } from "@/lib/supabase/server";
import { PembelianPenjualanTabs } from "./_components/PembelianPenjualanTabs";
import { PoClient } from "./_components/PoClient";
import { InvoiceClient } from "./_components/InvoiceClient";
import { SuratJalanClient } from "./_components/SuratJalanClient";
import { getCompanyLetterhead } from "./actions";
import {
  toNumber,
  type CompanyLetterhead,
  type CustomerOption,
  type DeliveryNoteRow,
  type InvoiceRow,
  type PoRow,
  type ProductOption,
  type SupplierOption,
  type WarehouseOption,
} from "./_lib/jualbeli";

const TABS = ["po", "invoice", "surat-jalan"] as const;
type TabKey = (typeof TABS)[number];

type SearchParams = {
  tab?: string;
};

type RawJoin = {
  code: string;
  name: string;
} | Array<{ code: string; name: string }> | null;

function oneJoin(v: RawJoin): { code: string; name: string } | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function getSuppliers(): Promise<SupplierOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, code, name, is_active")
    .order("code");
  return ((data ?? []) as SupplierOption[]).map((s) => ({ ...s }));
}

async function getCustomers(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, code, name, tax_id, address, is_active")
    .order("code");
  return ((data ?? []) as CustomerOption[]).map((c) => ({ ...c }));
}

async function getProducts(): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, sku, name, unit, is_active")
    .order("sku");
  return ((data ?? []) as Array<{
    id: string;
    sku: string;
    name: string;
    unit: string | null;
    is_active: boolean;
  }>).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit || "pcs",
    is_active: p.is_active,
  }));
}

async function getWarehouses(): Promise<WarehouseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, code, name, is_default")
    .order("code");
  return ((data ?? []) as WarehouseOption[]).map((w) => ({ ...w }));
}

async function getPOs(): Promise<PoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, supplier_id, order_date, expected_date, subtotal, tax_amount, total_amount, status, notes, suppliers(code, name)"
    )
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<{
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
    suppliers: RawJoin;
  }>).map((r) => {
    const s = oneJoin(r.suppliers);
    return {
      id: r.id,
      po_number: r.po_number,
      supplier_id: r.supplier_id,
      order_date: r.order_date,
      expected_date: r.expected_date,
      subtotal: toNumber(r.subtotal),
      tax_amount: toNumber(r.tax_amount),
      total_amount: toNumber(r.total_amount),
      status: r.status,
      notes: r.notes,
      supplier_code: s?.code ?? null,
      supplier_name: s?.name ?? null,
    };
  });
}

async function getInvoices(): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(
      "id, invoice_number, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, faktur_pajak_number, notes, customers(code, name)"
    )
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<{
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
    customers: RawJoin;
  }>).map((r) => {
    const c = oneJoin(r.customers);
    return {
      id: r.id,
      invoice_number: r.invoice_number,
      customer_id: r.customer_id,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      subtotal: toNumber(r.subtotal),
      tax_amount: toNumber(r.tax_amount),
      total_amount: toNumber(r.total_amount),
      paid_amount: toNumber(r.paid_amount),
      status: r.status,
      faktur_pajak_number: r.faktur_pajak_number,
      notes: r.notes,
      customer_code: c?.code ?? null,
      customer_name: c?.name ?? null,
    };
  });
}

async function getDeliveryNotes(): Promise<DeliveryNoteRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_notes")
    .select(
      "id, delivery_number, invoice_id, delivery_date, recipient_name, status, notes, sales_invoices(invoice_number, customers(name))"
    )
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    delivery_number: string;
    invoice_id: string | null;
    delivery_date: string;
    recipient_name: string | null;
    status: string;
    notes: string | null;
    sales_invoices: {
      invoice_number: string;
      customers: { name: string } | Array<{ name: string }> | null;
    } | Array<{
      invoice_number: string;
      customers: { name: string } | Array<{ name: string }> | null;
    }> | null;
  }>).map((r) => {
    const inv = Array.isArray(r.sales_invoices)
      ? (r.sales_invoices[0] ?? null)
      : r.sales_invoices;
    const cust = inv?.customers
      ? Array.isArray(inv.customers)
        ? (inv.customers[0] ?? null)
        : inv.customers
      : null;
    return {
      id: r.id,
      delivery_number: r.delivery_number,
      invoice_id: r.invoice_id,
      delivery_date: r.delivery_date,
      recipient_name: r.recipient_name,
      status: r.status,
      notes: r.notes,
      invoice_number: inv?.invoice_number ?? null,
      customer_name: cust?.name ?? null,
    };
  });
}

export default async function PembelianPenjualanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabKey)
    : "po";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">
          Pembelian &amp; Penjualan
        </h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Purchase order beserta alur persetujuan, invoice penjualan dengan
          nomor Faktur Pajak, surat jalan, dan ekspor e-Faktur.
        </p>
      </div>

      <PembelianPenjualanTabs active={tab} />

      <div className="mt-6">
        {tab === "po" && <PoTab />}
        {tab === "invoice" && <InvoiceTab />}
        {tab === "surat-jalan" && <SuratJalanTab />}
      </div>
    </div>
  );
}

async function PoTab() {
  let pos: PoRow[] = [];
  let suppliers: SupplierOption[] = [];
  let products: ProductOption[] = [];
  let warehouses: WarehouseOption[] = [];
  let letterhead: CompanyLetterhead = {
    companyName: "PT Maju Bersama",
    address: "—",
    phone: "—",
    npwp: "",
  };
  try {
    [pos, suppliers, products, warehouses, letterhead] = await Promise.all([
      getPOs(),
      getSuppliers(),
      getProducts(),
      getWarehouses(),
      getCompanyLetterhead(),
    ]);
  } catch {
    pos = [];
    suppliers = [];
    products = [];
    warehouses = [];
  }
  return (
    <PoClient
      pos={pos}
      suppliers={suppliers}
      products={products}
      warehouses={warehouses}
      letterhead={letterhead}
    />
  );
}

async function InvoiceTab() {
  let invoices: InvoiceRow[] = [];
  let customers: CustomerOption[] = [];
  let products: ProductOption[] = [];
  let letterhead: CompanyLetterhead = {
    companyName: "PT Maju Bersama",
    address: "—",
    phone: "—",
    npwp: "",
  };
  try {
    [invoices, customers, products, letterhead] = await Promise.all([
      getInvoices(),
      getCustomers(),
      getProducts(),
      getCompanyLetterhead(),
    ]);
  } catch {
    invoices = [];
    customers = [];
    products = [];
  }
  return (
    <InvoiceClient
      invoices={invoices}
      customers={customers}
      products={products}
      letterhead={letterhead}
    />
  );
}

async function SuratJalanTab() {
  let notes: DeliveryNoteRow[] = [];
  let invoices: InvoiceRow[] = [];
  let letterhead: CompanyLetterhead = {
    companyName: "PT Maju Bersama",
    address: "—",
    phone: "—",
    npwp: "",
  };
  try {
    [notes, invoices, letterhead] = await Promise.all([
      getDeliveryNotes(),
      getInvoices(),
      getCompanyLetterhead(),
    ]);
  } catch {
    notes = [];
    invoices = [];
  }
  const invoiceOptions = invoices
    .filter((i) => ["sent", "partial", "paid"].includes(i.status))
    .map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      customer_name: i.customer_name,
      status: i.status,
    }));
  return (
    <SuratJalanClient
      deliveryNotes={notes}
      invoices={invoiceOptions}
      letterhead={letterhead}
    />
  );
}
