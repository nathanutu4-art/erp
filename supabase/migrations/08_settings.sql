-- ============================================================================
-- ERP Migration 08 — Settings: company_settings, print_templates
--
-- company_settings holds the locked product decisions as deployment-level
-- defaults: D6 costing_method='average', D7 depreciation default,
-- D9 approval defaults (direct supervisor + HR takeover), D10 letterhead.
-- Exactly one row per deployment (same singleton pattern as companies).
-- ============================================================================

-- --------------------------------------------------------------------------
-- company_settings
-- --------------------------------------------------------------------------
CREATE TABLE public.company_settings (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton                boolean     NOT NULL DEFAULT true,
  costing_method           text        NOT NULL DEFAULT 'average'
                                           CHECK (costing_method IN ('average','fifo')),
  default_depreciation_method text      NOT NULL DEFAULT 'straight_line'
                                           CHECK (default_depreciation_method IN ('straight_line','declining_balance')),
  default_approver_type    text        NOT NULL DEFAULT 'direct_supervisor'
                                           CHECK (default_approver_type IN ('direct_supervisor','hr','finance')),
  hr_takeover_enabled      boolean     NOT NULL DEFAULT true,
  letterhead_company_name  text,
  letterhead_address       text,
  letterhead_phone         text,
  letterhead_npwp          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_single_row        UNIQUE (singleton),
  CONSTRAINT company_settings_single_row_is_true CHECK (singleton = true)
);

COMMENT ON TABLE public.company_settings
  IS 'Deployment-level defaults. Exactly one row per deployment.';
COMMENT ON COLUMN public.company_settings.costing_method
  IS 'Inventory costing (D6). average is the default; fifo selectable per deployment.';
COMMENT ON COLUMN public.company_settings.default_approver_type
  IS 'Default approval chain (D9): direct supervisor, HR takeover governed by hr_takeover_enabled.';
COMMENT ON COLUMN public.company_settings.letterhead_company_name
  IS 'D10: letterhead fields used by all print templates. Falls back to companies row when NULL.';

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- print_templates: the 5 Indonesian document templates (decision D10)
-- --------------------------------------------------------------------------
CREATE TABLE public.print_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text       NOT NULL UNIQUE
                          CHECK (template_key IN ('invoice','purchase_order','delivery_note','receipt','pay_slip')),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.print_templates
  IS 'Printable document templates (D10): Invoice, PO, Surat Jalan, Kuitansi, Slip Gaji. Layouts live in the app; this table tracks availability.';

CREATE TRIGGER trg_print_templates_updated_at
  BEFORE UPDATE ON public.print_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_templates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.company_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.print_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
