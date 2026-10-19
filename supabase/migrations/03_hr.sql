-- ============================================================================
-- ERP Migration 03 — HR & Attendance:
-- employees, attendance_records, leave_types, leave_requests,
-- payroll_periods, payroll_slips
--
-- Approval chain (decision D9): leave requests go to the employee's direct
-- supervisor (employees.supervisor_id); HR may take over when the supervisor
-- is unavailable (enforced in the app).
-- Payroll (decision D8): configurable components, automatic PPh 21 using the
-- Tarif Efektif Rata-rata (TER), BPJS Kesehatan & Ketenagakerjaan flags,
-- pro-rata THR accrual, printable pay slips.
-- ============================================================================

-- --------------------------------------------------------------------------
-- employees
-- --------------------------------------------------------------------------
CREATE TABLE public.employees (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_code     text          NOT NULL UNIQUE,
  full_name         text          NOT NULL,
  position          text,
  department        text,
  join_date         date,
  employment_status text          NOT NULL DEFAULT 'active'
                                  CHECK (employment_status IN ('active','resigned','terminated')),
  supervisor_id     uuid          REFERENCES public.employees(id) ON DELETE SET NULL,
  base_salary       numeric(18,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT employees_no_self_supervisor CHECK (supervisor_id IS NULL OR supervisor_id <> id)
);

COMMENT ON TABLE public.employees IS 'Employees (Karyawan). May exist without a login (profile_id nullable).';
COMMENT ON COLUMN public.employees.supervisor_id
  IS 'Direct supervisor (atasan langsung) — default approver for leave requests (D9).';
COMMENT ON COLUMN public.employees.profile_id
  IS 'Link to app login. NULL for employees without system access.';

CREATE INDEX idx_employees_supervisor ON public.employees(supervisor_id);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- attendance_records: one row per employee per day
-- --------------------------------------------------------------------------
CREATE TABLE public.attendance_records (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date        NOT NULL,
  clock_in_time   timestamptz,
  clock_out_time  timestamptz,
  status          text        NOT NULL DEFAULT 'present'
                              CHECK (status IN ('present','late','leave','sick','permit','absent')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_one_per_day UNIQUE (employee_id, attendance_date)
);

COMMENT ON TABLE public.attendance_records IS 'Daily attendance (Kehadiran). Web-based clock in/out.';

CREATE INDEX idx_attendance_employee_date ON public.attendance_records(employee_id, attendance_date);

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- leave_types: Cuti Tahunan, Ijin, Sakit, ...
-- --------------------------------------------------------------------------
CREATE TABLE public.leave_types (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  annual_quota_days integer     NOT NULL DEFAULT 0 CHECK (annual_quota_days >= 0),
  deducts_quota     boolean     NOT NULL DEFAULT true,
  requires_document boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leave_types IS 'Leave categories (Jenis Cuti/Ijin/Sakit).';
COMMENT ON COLUMN public.leave_types.requires_document
  IS 'e.g. Sakit requires a doctor note (surat sakit) attachment.';

CREATE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- leave_requests: cuti/ijin/sakit submissions with approval flow
-- --------------------------------------------------------------------------
CREATE TABLE public.leave_requests (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid         NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date   date          NOT NULL,
  end_date     date          NOT NULL,
  total_days   numeric(5,1)  NOT NULL CHECK (total_days > 0),
  reason       text,
  document_url text,
  status       text          NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id  uuid          REFERENCES public.employees(id) ON DELETE SET NULL,
  decided_at   timestamptz,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_valid_range CHECK (start_date <= end_date)
);

COMMENT ON TABLE public.leave_requests IS 'Leave submissions (Pengajuan Cuti/Ijin/Sakit) with approval flow.';
COMMENT ON COLUMN public.leave_requests.approver_id
  IS 'Defaults to the employee''s supervisor (D9); HR takeover recorded here.';
COMMENT ON COLUMN public.leave_requests.document_url
  IS 'Storage URL of supporting document, e.g. surat sakit.';

CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status   ON public.leave_requests(status);

CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- payroll_periods & payroll_slips
-- --------------------------------------------------------------------------
CREATE TABLE public.payroll_periods (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','finalized','paid')),
  finalized_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_periods_valid_range CHECK (start_date <= end_date)
);

COMMENT ON TABLE public.payroll_periods
  IS 'Payroll runs (Periode Penggajian). Finalized periods are locked in the app.';

CREATE TRIGGER trg_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payroll_slips (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id         uuid          NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id               uuid          NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary               numeric(18,2) NOT NULL DEFAULT 0,
  allowances                numeric(18,2) NOT NULL DEFAULT 0,
  overtime_pay              numeric(18,2) NOT NULL DEFAULT 0,
  thr_accrual               numeric(18,2) NOT NULL DEFAULT 0,
  bpjs_health_employee      numeric(18,2) NOT NULL DEFAULT 0,
  bpjs_health_employer      numeric(18,2) NOT NULL DEFAULT 0,
  bpjs_employment_employee  numeric(18,2) NOT NULL DEFAULT 0,
  bpjs_employment_employer  numeric(18,2) NOT NULL DEFAULT 0,
  pph21_ter                 numeric(18,2) NOT NULL DEFAULT 0,
  other_deductions          numeric(18,2) NOT NULL DEFAULT 0,
  gross_pay                 numeric(18,2) NOT NULL DEFAULT 0,
  net_pay                   numeric(18,2) NOT NULL DEFAULT 0,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT payroll_slips_one_per_period UNIQUE (payroll_period_id, employee_id)
);

COMMENT ON TABLE public.payroll_slips IS 'Per-employee pay slip (Slip Gaji) for a payroll period.';
COMMENT ON COLUMN public.payroll_slips.pph21_ter
  IS 'PPh 21 income tax computed with Tarif Efektif Rata-rata (TER, in force since Jan 2024).';
COMMENT ON COLUMN public.payroll_slips.thr_accrual
  IS 'Pro-rata religious holiday allowance (THR Keagamaan) accrual.';

CREATE INDEX idx_payroll_slips_period   ON public.payroll_slips(payroll_period_id);
CREATE INDEX idx_payroll_slips_employee ON public.payroll_slips(employee_id);

CREATE TRIGGER trg_payroll_slips_updated_at
  BEFORE UPDATE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security (permissive for authenticated; isolation is by deployment)
-- --------------------------------------------------------------------------
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.attendance_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.leave_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.leave_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.payroll_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.payroll_slips
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
