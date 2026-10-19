-- ============================================================================
-- ERP Migration 06 — CRM: customer_interactions
-- (customers table lives in 05_purchasing_sales.sql and is reused here)
-- ============================================================================

CREATE TABLE public.customer_interactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  interaction_date timestamptz NOT NULL DEFAULT now(),
  type             text        NOT NULL
                                 CHECK (type IN ('call','meeting','email','whatsapp','note','follow_up')),
  subject          text,
  notes            text,
  follow_up_date   date,
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_interactions
  IS 'Customer touchpoints: calls, meetings, notes and follow-ups (Aktivitas Pelanggan).';

CREATE INDEX idx_customer_interactions_customer ON public.customer_interactions(customer_id);
CREATE INDEX idx_customer_interactions_followup ON public.customer_interactions(follow_up_date);

CREATE TRIGGER trg_customer_interactions_updated_at
  BEFORE UPDATE ON public.customer_interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.customer_interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
