-- ============================================================================
-- ERP Migration 04 — Inventory & Warehouse: warehouses, products, stock_mutations
--
-- Costing (decision D6): Average (rata-rata tertimbang) is the default.
-- products.avg_cost is maintained by the app on every inbound mutation:
--   new_avg = (old_stock * old_avg + qty_in * unit_cost) / (old_stock + qty_in)
-- stock_mutations keeps a full audit trail including the resulting average.
-- ============================================================================

-- --------------------------------------------------------------------------
-- warehouses
-- --------------------------------------------------------------------------
CREATE TABLE public.warehouses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  address    text,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.warehouses IS 'Warehouses (Gudang).';

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- products
-- --------------------------------------------------------------------------
CREATE TABLE public.products (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text          NOT NULL UNIQUE,
  name          text          NOT NULL,
  category      text,
  unit          text          NOT NULL DEFAULT 'pcs',
  avg_cost      numeric(18,2) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
  current_stock numeric(18,3) NOT NULL DEFAULT 0,
  min_stock     numeric(18,3) NOT NULL DEFAULT 0,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS 'Products / goods (Produk/Barang).';
COMMENT ON COLUMN public.products.avg_cost
  IS 'Weighted-average cost (HPP rata-rata, D6). Maintained by the app on inbound mutations.';
COMMENT ON COLUMN public.products.current_stock
  IS 'Denormalized stock total across warehouses. Maintained by the app on every mutation.';
COMMENT ON COLUMN public.products.min_stock
  IS 'Low-stock alert threshold (badge Stok Menipis in the UI).';

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- stock_mutations: audit trail of every stock movement (Kartu Stok)
-- --------------------------------------------------------------------------
CREATE TABLE public.stock_mutations (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id       uuid          REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  mutation_date      timestamptz   NOT NULL DEFAULT now(),
  direction          text          NOT NULL CHECK (direction IN ('in','out')),
  quantity           numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost          numeric(18,2),
  resulting_avg_cost numeric(18,2),
  reference_type     text,
  reference_id       uuid,
  notes              text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_mutations
  IS 'Stock movement ledger (Kartu Stok). Immutable audit trail; corrections via reversing entries.';
COMMENT ON COLUMN public.stock_mutations.unit_cost
  IS 'Cost per unit for inbound mutations; NULL for outbound/adjustments.';
COMMENT ON COLUMN public.stock_mutations.resulting_avg_cost
  IS 'Snapshot of products.avg_cost immediately after this mutation.';
COMMENT ON COLUMN public.stock_mutations.reference_type
  IS 'Origin, e.g. purchase_order, sales_invoice, adjustment, opname.';

CREATE INDEX idx_stock_mutations_product ON public.stock_mutations(product_id);
CREATE INDEX idx_stock_mutations_date    ON public.stock_mutations(mutation_date);

CREATE TRIGGER trg_stock_mutations_updated_at
  BEFORE UPDATE ON public.stock_mutations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.warehouses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.warehouses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.stock_mutations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
