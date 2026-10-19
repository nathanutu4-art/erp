-- ============================================================================
-- ERP Migration 05 — Purchasing & Sales:
-- suppliers, purchase_orders, po_lines, customers, sales_invoices,
-- invoice_lines, invoice_payments, delivery_notes, nsfp_series
--
-- PO approval (decision D9): draft -> pending -> approved (by direct
-- supervisor; HR takeover allowed) -> done. e-Faktur (decision D11): v1
-- manages the NSFP series and Faktur Pajak numbering and exports the DJP
-- import file; full DJP API integration is a later phase.
-- ============================================================================

-- --------------------------------------------------------------------------
-- suppliers
-- --------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL UNIQUE,
  name           text        NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  tax_id         text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suppliers IS 'Suppliers (Pemasok).';
COMMENT ON COLUMN public.suppliers.tax_id IS 'NPWP of the supplier.';

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- purchase_orders + po_lines
-- --------------------------------------------------------------------------
CREATE TABLE public.purchase_orders (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number    text          NOT NULL UNIQUE,
  supplier_id  uuid          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_date   date          NOT NULL,
  expected_date date,
  subtotal     numeric(18,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount   numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status       text          NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','pending','approved','rejected','done','cancelled')),
  requested_by uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by  uuid          REFERENCES public.employees(id) ON DELETE SET NULL,
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_orders
  IS 'Purchase orders. Flow: draft -> pending -> approved -> done (goods received).';
COMMENT ON COLUMN public.purchase_orders.approved_by
  IS 'Approver: direct supervisor by default, HR takeover allowed (D9).';

CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status   ON public.purchase_orders(status);

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.po_lines (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id      uuid          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity   numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz   NOT NULL DEFAULT now(),
  updated_at timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.po_lines IS 'Purchase order line items.';

CREATE INDEX idx_po_lines_po ON public.po_lines(po_id);

CREATE TRIGGER trg_po_lines_updated_at
  BEFORE UPDATE ON public.po_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- customers
-- --------------------------------------------------------------------------
CREATE TABLE public.customers (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text          NOT NULL UNIQUE,
  name           text          NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  tax_id         text,
  credit_limit   numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  is_active      boolean       NOT NULL DEFAULT true,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customers IS 'Customers (Pelanggan). Also referenced by the CRM module.';

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- sales_invoices + invoice_lines + invoice_payments
-- --------------------------------------------------------------------------
CREATE TABLE public.sales_invoices (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     text          NOT NULL UNIQUE,
  customer_id        uuid          NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_date       date          NOT NULL,
  due_date           date,
  subtotal           numeric(18,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount         numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount       numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount        numeric(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status             text          NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  faktur_pajak_number text         UNIQUE,
  notes              text,
  created_by         uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_invoices IS 'Sales invoices (Faktur Penjualan).';
COMMENT ON COLUMN public.sales_invoices.faktur_pajak_number
  IS 'Nomor Faktur Pajak (D11). Taken from nsfp_series; unique when present.';
COMMENT ON COLUMN public.sales_invoices.paid_amount
  IS 'Denormalized total of invoice_payments. Maintained by the app.';

CREATE INDEX idx_sales_invoices_customer ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_status   ON public.sales_invoices(status);

CREATE TRIGGER trg_sales_invoices_updated_at
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_lines (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid          NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id  uuid          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity    numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_price  numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  line_total  numeric(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_lines IS 'Sales invoice line items.';

CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

CREATE TRIGGER trg_invoice_lines_updated_at
  BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_payments (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid          NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  payment_date date          NOT NULL,
  amount       numeric(18,2) NOT NULL CHECK (amount > 0),
  method       text,
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_payments IS 'Payments received against a sales invoice (Pelunasan Piutang).';

CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

CREATE TRIGGER trg_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- delivery_notes (Surat Jalan)
-- --------------------------------------------------------------------------
CREATE TABLE public.delivery_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number text        NOT NULL UNIQUE,
  invoice_id      uuid        REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  delivery_date   date        NOT NULL,
  recipient_name  text,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','shipped','delivered','cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.delivery_notes IS 'Delivery notes (Surat Jalan), usually linked to a sales invoice.';

CREATE TRIGGER trg_delivery_notes_updated_at
  BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- nsfp_series: Faktur Pajak number series from DJP (decision D11)
-- --------------------------------------------------------------------------
CREATE TABLE public.nsfp_series (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  series_code    text        NOT NULL UNIQUE,
  start_number   text        NOT NULL,
  end_number     text        NOT NULL,
  current_number text        NOT NULL,
  tax_year       integer     NOT NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nsfp_series
  IS 'NSFP (Nomor Seri Faktur Pajak) ranges obtained from DJP. v1 only manages numbering + DJP import-file export (D11).';
COMMENT ON COLUMN public.nsfp_series.current_number
  IS 'Next number to assign. Advanced by the app on each Faktur Pajak issuance.';

CREATE TRIGGER trg_nsfp_series_updated_at
  BEFORE UPDATE ON public.nsfp_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nsfp_series     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.po_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.sales_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.invoice_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.invoice_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.delivery_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.nsfp_series
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
