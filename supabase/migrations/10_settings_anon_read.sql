-- ============================================================================
-- ERP Migration 10 — Settings: allow anon read access for company branding
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'anon_read_companies') THEN
    CREATE POLICY anon_read_companies ON public.companies FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'anon_read_settings') THEN
    CREATE POLICY anon_read_settings ON public.company_settings FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_templates' AND policyname = 'anon_read_templates') THEN
    CREATE POLICY anon_read_templates ON public.print_templates FOR SELECT TO anon USING (true);
  END IF;
END $$;

