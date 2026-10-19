-- ============================================================================
-- ERP Migration 02 — Finance & Accounting:
-- accounts (chart of accounts), journal_entries, journal_lines, fiscal_periods
--
-- Double-entry bookkeeping. Journal balance (total debit = total credit) is
-- enforced in the application layer; the schema guarantees per-line sanity
-- (non-negative amounts, never debit AND credit on the same line).
-- ============================================================================

-- --------------------------------------------------------------------------
-- accounts: chart of accounts (Bagan Akun)
-- --------------------------------------------------------------------------
CREATE TABLE public.accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id   uuid        REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_header   boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

COMMENT ON TABLE public.accounts
  IS 'Chart of accounts (Bagan Akun). type follows Indonesian PSAK groupings.';
COMMENT ON COLUMN public.accounts.is_header
  IS 'Header accounts only group child accounts; postings to them are blocked in the app.';
COMMENT ON COLUMN public.accounts.parent_id
  IS 'Optional hierarchy. Deleting a parent keeps children (parent set to NULL).';

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- journal_entries: double-entry journal header
-- --------------------------------------------------------------------------
CREATE TABLE public.journal_entries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number   text        NOT NULL UNIQUE,
  entry_date     date        NOT NULL,
  description    text        NOT NULL,
  reference_type text,
  reference_id   uuid,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','posted','void')),
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journal_entries
  IS 'Journal header (Jurnal Umum). One entry = one balanced transaction.';
COMMENT ON COLUMN public.journal_entries.entry_number
  IS 'Human-readable number, e.g. JU-2026-0001. Generated in the app.';
COMMENT ON COLUMN public.journal_entries.reference_type
  IS 'Origin module, e.g. sales_invoice, purchase_order, payroll, depreciation, manual.';
COMMENT ON COLUMN public.journal_entries.status
  IS 'draft: editable. posted: locked into the ledger. void: cancelled (kept for audit).';

CREATE INDEX idx_journal_entries_entry_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status     ON public.journal_entries(status);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- journal_lines: debit/credit lines of a journal entry
-- --------------------------------------------------------------------------
CREATE TABLE public.journal_lines (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid          NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id       uuid          NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit            numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit           numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description      text,
  line_order       integer       NOT NULL DEFAULT 0,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_single_side CHECK (debit = 0 OR credit = 0)
);

COMMENT ON TABLE public.journal_lines IS 'Journal lines. Each line is debit XOR credit (never both).';
COMMENT ON COLUMN public.journal_lines.account_id
  IS 'RESTRICT on delete: accounts with postings can never be removed.';

CREATE INDEX idx_journal_lines_entry   ON public.journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);

CREATE TRIGGER trg_journal_lines_updated_at
  BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- fiscal_periods: accounting periods that can be closed
-- --------------------------------------------------------------------------
CREATE TABLE public.fiscal_periods (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  start_date date        NOT NULL,
  end_date   date        NOT NULL,
  is_closed  boolean     NOT NULL DEFAULT false,
  closed_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_periods_valid_range CHECK (start_date <= end_date)
);

COMMENT ON TABLE public.fiscal_periods
  IS 'Accounting periods (e.g. Januari 2026). Closed periods reject new postings in the app.';

CREATE TRIGGER trg_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.journal_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.journal_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.fiscal_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
