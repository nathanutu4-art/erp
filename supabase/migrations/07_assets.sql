-- ============================================================================
-- ERP Migration 07 — Fixed Assets:
-- asset_categories, assets, depreciation_schedules, asset_disposals
--
-- Depreciation (decision D7): straight-line (garis lurus) is the default;
-- declining-balance (saldo menurun) is available per asset/category.
-- Depreciation journals are posted to the GL by the app and linked back
-- via depreciation_schedules.journal_entry_id.
-- ============================================================================

-- --------------------------------------------------------------------------
-- asset_categories
-- --------------------------------------------------------------------------
CREATE TABLE public.asset_categories (
  id                             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                           text        NOT NULL UNIQUE,
  name                           text        NOT NULL,
  default_useful_life_months     integer     NOT NULL DEFAULT 48 CHECK (default_useful_life_months > 0),
  default_depreciation_method    text        NOT NULL DEFAULT 'straight_line'
                                             CHECK (default_depreciation_method IN ('straight_line','declining_balance')),
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asset_categories IS 'Asset categories (e.g. Kendaraan, Peralatan Kantor) with depreciation defaults.';

CREATE TRIGGER trg_asset_categories_updated_at
  BEFORE UPDATE ON public.asset_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- assets
-- --------------------------------------------------------------------------
CREATE TABLE public.assets (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code              text          NOT NULL UNIQUE,
  name                    text          NOT NULL,
  category_id             uuid          NOT NULL REFERENCES public.asset_categories(id) ON DELETE RESTRICT,
  purchase_date           date          NOT NULL,
  purchase_cost           numeric(18,2) NOT NULL CHECK (purchase_cost >= 0),
  useful_life_months      integer       NOT NULL CHECK (useful_life_months > 0),
  depreciation_method     text          NOT NULL DEFAULT 'straight_line'
                                        CHECK (depreciation_method IN ('straight_line','declining_balance')),
  salvage_value           numeric(18,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0 CHECK (accumulated_depreciation >= 0),
  book_value              numeric(18,2) GENERATED ALWAYS AS (purchase_cost - accumulated_depreciation) STORED,
  location                text,
  status                  text          NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active','under_maintenance','disposed')),
  notes                   text,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assets IS 'Fixed assets (Aset Tetap).';
COMMENT ON COLUMN public.assets.depreciation_method
  IS 'Default straight_line per D7; declining_balance selectable per asset.';
COMMENT ON COLUMN public.assets.accumulated_depreciation
  IS 'Advanced by the app as depreciation_schedules rows are posted.';
COMMENT ON COLUMN public.assets.book_value
  IS 'Nilai buku = purchase_cost - accumulated_depreciation (computed).';

CREATE INDEX idx_assets_category ON public.assets(category_id);
CREATE INDEX idx_assets_status   ON public.assets(status);

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- depreciation_schedules: monthly depreciation plan + actuals
-- --------------------------------------------------------------------------
CREATE TABLE public.depreciation_schedules (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                 uuid          NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  period_date              date          NOT NULL,
  depreciation_amount      numeric(18,2) NOT NULL CHECK (depreciation_amount >= 0),
  accumulated_depreciation numeric(18,2) NOT NULL CHECK (accumulated_depreciation >= 0),
  book_value               numeric(18,2) NOT NULL CHECK (book_value >= 0),
  is_posted                boolean       NOT NULL DEFAULT false,
  journal_entry_id         uuid          REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT depreciation_one_per_period UNIQUE (asset_id, period_date)
);

COMMENT ON TABLE public.depreciation_schedules
  IS 'Monthly depreciation schedule (Jadwal Penyusutan). is_posted=true links to the auto GL journal.';
COMMENT ON COLUMN public.depreciation_schedules.period_date
  IS 'First day of the depreciation month.';
COMMENT ON COLUMN public.depreciation_schedules.journal_entry_id
  IS 'Auto-created journal: Dr Beban Penyusutan / Cr Akumulasi Penyusutan.';

CREATE INDEX idx_depreciation_schedules_asset ON public.depreciation_schedules(asset_id);

CREATE TRIGGER trg_depreciation_schedules_updated_at
  BEFORE UPDATE ON public.depreciation_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- asset_disposals
-- --------------------------------------------------------------------------
CREATE TABLE public.asset_disposals (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid          NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  disposal_date date          NOT NULL,
  disposal_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (disposal_price >= 0),
  gain_loss     numeric(18,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asset_disposals
  IS 'Asset disposals (Pelepasan Aset). gain_loss = disposal_price - book_value at disposal.';
COMMENT ON COLUMN public.asset_disposals.asset_id
  IS 'RESTRICT: an asset with a disposal record cannot be deleted; set status=disposed instead.';

CREATE TRIGGER trg_asset_disposals_updated_at
  BEFORE UPDATE ON public.asset_disposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.asset_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_disposals        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.asset_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.depreciation_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.asset_disposals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
