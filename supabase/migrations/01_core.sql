-- ============================================================================
-- ERP Migration 01 — Core: companies, roles, profiles, updated_at trigger
--
-- Single-tenant by deployment: one database = one company. There are NO
-- tenant-id columns; per-company isolation is achieved by deploying a
-- separate Supabase project per company. RLS is enabled on every table with
-- permissive policies for the `authenticated` role because this is an
-- internal app used only by the company's own staff.
-- ============================================================================

-- Trigger function: refresh updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_updated_at()
  IS 'Trigger function: refreshes updated_at timestamp on UPDATE.';

-- --------------------------------------------------------------------------
-- companies: exactly ONE row per deployment (enforced by unique singleton)
-- --------------------------------------------------------------------------
CREATE TABLE public.companies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton   boolean     NOT NULL DEFAULT true,
  name        text        NOT NULL,
  address     text,
  phone       text,
  email       text,
  npwp        text,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_single_row        UNIQUE (singleton),
  CONSTRAINT companies_single_row_is_true CHECK (singleton = true)
);

COMMENT ON TABLE public.companies
  IS 'Company identity. Single-tenant: exactly one row per deployment.';
COMMENT ON COLUMN public.companies.npwp
  IS 'Nomor Pokok Wajib Pajak (Indonesian tax ID).';

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- roles: application roles assigned to profiles
-- --------------------------------------------------------------------------
CREATE TABLE public.roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles
  IS 'Application roles (admin, hr, finance, ...). Assigned to profiles.';

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- profiles: application user linked 1:1 to a Supabase Auth user
-- --------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text        NOT NULL,
  full_name  text        NOT NULL,
  role_id    uuid        REFERENCES public.roles(id) ON DELETE SET NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles
  IS 'Application users. id is the Supabase Auth user id (auth.users).';
COMMENT ON COLUMN public.profiles.role_id
  IS 'Nullable: a user without a role cannot access anything until one is assigned.';

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.companies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
