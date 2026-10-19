import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  toNumber,
  one,
  INTERACTION_TYPE_LABEL,
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_STATUS_STYLE,
  type InteractionType,
} from "../_lib/crm";
import { DetailClient } from "./_components/DetailClient";

type CustomerDetail = {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  credit_limit: string | number;
  is_active: boolean;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  status: string;
  faktur_pajak_number: string | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: string | number;
  method: string | null;
  invoice: { invoice_number: string } | Array<{ invoice_number: string }> | null;
};

type InteractionRow = {
  id: string;
  interaction_date: string;
  type: string;
  subject: string | null;
  notes: string | null;
  follow_up_date: string | null;
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  sent: "Terkirim",
  partial: "Sebagian",
  paid: "Lunas",
  overdue: "Jatuh Tempo",
  cancelled: "Dibatalkan",
};

const INVOICE_STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-400/20 text-slate-300 border-slate-300/40",
  sent: "bg-sky-400/20 text-sky-200 border-sky-300/40",
  partial: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  paid: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  overdue: "bg-rose-400/20 text-rose-200 border-rose-300/40",
  cancelled: "bg-slate-400/20 text-slate-400 border-slate-300/30",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customerData } = await supabase
    .from("customers")
    .select(
      "id, code, name, contact_person, phone, email, address, tax_id, credit_limit, is_active"
    )
    .eq("id", id)
    .maybeSingle();
  const customer = customerData as CustomerDetail | null;
  if (!customer) notFound();

  let invoices: InvoiceRow[] = [];
  let payments: PaymentRow[] = [];
  let interactions: InteractionRow[] = [];
  try {
    const [{ data: invData }, { data: intData }] = await Promise.all([
      supabase
        .from("sales_invoices")
        .select(
          "id, invoice_number, invoice_date, due_date, total_amount, paid_amount, status, faktur_pajak_number"
        )
        .eq("customer_id", id)
        .order("invoice_date", { ascending: false })
        .limit(500),
      supabase
        .from("customer_interactions")
        .select("id, interaction_date, type, subject, notes, follow_up_date")
        .eq("customer_id", id)
        .order("interaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    invoices = (invData ?? []) as InvoiceRow[];
    interactions = (intData ?? []) as InteractionRow[];

    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length > 0) {
      const { data: payData } = await supabase
        .from("invoice_payments")
        .select(
          "id, invoice_id, payment_date, amount, method, invoice:sales_invoices(invoice_number)"
        )
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: false })
        .limit(500);
      payments = (payData ?? []) as PaymentRow[];
    }
  } catch {
    invoices = [];
    payments = [];
    interactions = [];
  }

  const totalInvoiced = invoices
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .reduce((s, i) => s + toNumber(i.total_amount), 0);
  const totalPaid = invoices
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .reduce((s, i) => s + toNumber(i.paid_amount), 0);
  const sisaPiutang = Math.max(0, totalInvoiced - totalPaid);

  return (
    <div>
      <Link
        href="/crm"
        className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 mb-4 min-h-[44px]"
      >
        ← Kembali ke daftar pelanggan
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-100">
            {customer.name}
          </h1>
          <span
            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
              CUSTOMER_STATUS_STYLE[customer.is_active ? "active" : "inactive"]
            }`}
          >
            {CUSTOMER_STATUS_LABEL[customer.is_active ? "active" : "inactive"]}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">{customer.code}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-5 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-200 mb-3">
            Profil Pelanggan
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Kontak</dt>
              <dd className="text-slate-100 text-right">
                {customer.contact_person || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Telepon</dt>
              <dd className="text-slate-100 text-right">
                {customer.phone || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Email</dt>
              <dd className="text-slate-100 text-right break-all">
                {customer.email || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Alamat</dt>
              <dd className="text-slate-100 text-right">
                {customer.address || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">NPWP</dt>
              <dd className="text-slate-100 text-right">
                {customer.tax_id || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Batas Kredit</dt>
              <dd className="text-slate-100 text-right font-semibold">
                {formatIDR(customer.credit_limit)}
              </dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">
            Total Ditagihkan
          </h2>
          <p className="text-2xl font-extrabold text-slate-100">
            {formatIDR(totalInvoiced)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {invoices.length} invoice tercatat
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">Sisa Piutang</h2>
          <p className="text-2xl font-extrabold text-amber-200">
            {formatIDR(sisaPiutang)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Sudah dibayar {formatIDR(totalPaid)}
          </p>
        </GlassCard>
      </div>

      <DetailClient
        customerId={customer.id}
        customerName={customer.name}
        invoices={invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoice_number,
          invoiceDate: i.invoice_date,
          dueDate: i.due_date,
          totalAmount: toNumber(i.total_amount),
          paidAmount: toNumber(i.paid_amount),
          status: i.status,
          statusLabel: INVOICE_STATUS_LABEL[i.status] ?? i.status,
          statusStyle:
            INVOICE_STATUS_STYLE[i.status] ?? INVOICE_STATUS_STYLE.draft,
          fakturPajakNumber: i.faktur_pajak_number,
        }))}
        payments={payments.map((p) => ({
          id: p.id,
          paymentDate: p.payment_date,
          amount: toNumber(p.amount),
          method: p.method,
          invoiceNumber: one(p.invoice)?.invoice_number ?? "—",
        }))}
        interactions={interactions.map((t) => ({
          id: t.id,
          interactionDate: t.interaction_date,
          typeLabel:
            INTERACTION_TYPE_LABEL[t.type as InteractionType] ?? t.type,
          subject: t.subject,
          notes: t.notes,
          followUpDate: t.follow_up_date,
        }))}
      />
    </div>
  );
}
