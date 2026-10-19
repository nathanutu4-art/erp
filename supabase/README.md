# Supabase — Database Migrations

SQL migration files for the ERP, ordered and timestamped by filename:

| File | Contents |
|------|----------|
| `migrations/01_core.sql` | `companies` (single row per deployment), `roles`, `profiles` (FK → `auth.users`), `set_updated_at()` trigger |
| `migrations/02_finance.sql` | `accounts` (chart of accounts), `journal_entries`, `journal_lines`, `fiscal_periods` |
| `migrations/03_hr.sql` | `employees` (with `supervisor_id` approval chain), `attendance_records`, `leave_types`, `leave_requests`, `payroll_periods`, `payroll_slips` |
| `migrations/04_inventory.sql` | `warehouses`, `products` (Average costing), `stock_mutations` (Kartu Stok audit trail) |
| `migrations/05_purchasing_sales.sql` | `suppliers`, `purchase_orders` + `po_lines`, `customers`, `sales_invoices` + `invoice_lines`, `invoice_payments`, `delivery_notes`, `nsfp_series` |
| `migrations/06_crm.sql` | `customer_interactions` |
| `migrations/07_assets.sql` | `asset_categories`, `assets` (straight-line default), `depreciation_schedules`, `asset_disposals` |
| `migrations/08_settings.sql` | `company_settings` (single row: costing/approval/depreciation defaults, letterhead), `print_templates` |
| `migrations/09_seed.sql` | Idempotent seed: Indonesian chart of accounts (~34 accounts), roles, leave types (Cuti Tahunan/Ijin/Sakit), asset categories, 5 print templates, default settings, placeholder company row |

## Key conventions

- **Single-tenant by deployment**: one Supabase project = one company. There are no tenant-id columns. `companies` and `company_settings` enforce exactly one row via a unique `singleton` flag.
- **RLS**: enabled on every table with a permissive `authenticated` policy — this is an internal app; isolation comes from the deployment, not row filters.
- Identifiers are English `snake_case`; PKs are `uuid` with `gen_random_uuid()`; every table has `created_at`/`updated_at` (`updated_at` auto-maintained by trigger).
- Journal balance (total debit = total credit) and running averages/stock totals are enforced in the application layer; the schema documents each maintained field with `COMMENT ON`.

## How to apply

**Option A — Supabase SQL Editor (simplest):**
1. Open the Supabase dashboard → SQL Editor.
2. Run the files **in filename order** (`01` → `09`), pasting each file's contents as a new query.
3. `09_seed.sql` is idempotent and safe to re-run.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <project-ref>
supabase db push
```

## After applying

1. Update the placeholder `companies` row with the real company identity (name, address, NPWP, logo).
2. Create the first user in **Authentication → Users**, then insert the matching row into `public.profiles` with the `admin` role:
   ```sql
   INSERT INTO public.profiles (id, email, full_name, role_id)
   SELECT '<auth-user-uuid>', 'admin@perusahaan.co.id', 'Administrator',
          (SELECT id FROM public.roles WHERE name = 'admin');
   ```
3. Adjust `company_settings` (costing method, letterhead) if the defaults don't fit.
