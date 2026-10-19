import { createClient } from "@/lib/supabase/server";
import { CrmClient, type CustomerRow } from "./_components/CrmClient";
import { toNumber } from "./_lib/crm";

type RawCustomer = {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: string | number;
  is_active: boolean;
};

type RawInvoice = {
  customer_id: string;
  total_amount: string | number;
  paid_amount: string | number;
  status: string;
  due_date: string | null;
};

/**
 * Daftar pelanggan beserta agregat piutang per pelanggan.
 * Piutang = Σ(total − dibayar) atas invoice berstatus sent/partial/
 * overdue/paid; draf dan yang dibatalkan bukan piutang.
 */
async function getCustomers(): Promise<CustomerRow[]> {
  const supabase = await createClient();
  const [{ data: customers }, { data: invoices }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, code, name, contact_person, phone, email, address, credit_limit, is_active"
      )
      .order("name"),
    supabase
      .from("sales_invoices")
      .select("customer_id, total_amount, paid_amount, status, due_date")
      .in("status", ["sent", "partial", "overdue", "paid"])
      .limit(5000),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const agg = new Map<string, { piutang: number; overdue: boolean }>();
  for (const inv of ((invoices ?? []) as RawInvoice[])) {
    const sisa = toNumber(inv.total_amount) - toNumber(inv.paid_amount);
    const cur = agg.get(inv.customer_id) ?? { piutang: 0, overdue: false };
    cur.piutang += sisa;
    if (sisa > 0.005 && inv.due_date && inv.due_date < today) {
      cur.overdue = true;
    }
    agg.set(inv.customer_id, cur);
  }

  return ((customers ?? []) as RawCustomer[]).map((c) => {
    const a = agg.get(c.id) ?? { piutang: 0, overdue: false };
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      contactPerson: c.contact_person,
      phone: c.phone,
      email: c.email,
      address: c.address,
      creditLimit: toNumber(c.credit_limit),
      isActive: c.is_active,
      totalPiutang: Math.max(0, Math.round(a.piutang * 100) / 100),
      hasOverdue: a.overdue,
    };
  });
}

export default async function CrmPage() {
  let customers: CustomerRow[] = [];
  try {
    customers = await getCustomers();
  } catch {
    customers = [];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">CRM</h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Data pelanggan, riwayat transaksi, dan pantauan piutang.
        </p>
      </div>
      <CrmClient customers={customers} />
    </div>
  );
}
