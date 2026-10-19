-- ============================================================================
-- ERP Migration 09 — Seed: chart of accounts, roles, leave types,
-- asset categories, print templates, default settings & company row.
--
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so the seed can be
-- re-run safely. All user-facing content is in Bahasa Indonesia.
-- IMPORTANT: update the placeholder `companies` row with the real company
-- identity after deploying.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Placeholder company row (single-tenant: the one and only company)
-- --------------------------------------------------------------------------
INSERT INTO public.companies (name, address, phone, email, npwp)
VALUES (
  'PT Maju Bersama',
  'Jl. Contoh No. 123, Jakarta Selatan',
  '(021) 555-0123',
  'info@majubersama.co.id',
  '00.000.000.0-000.000'
)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Roles
-- --------------------------------------------------------------------------
INSERT INTO public.roles (name, description) VALUES
  ('admin',     'Administrator — akses penuh ke seluruh modul'),
  ('hr',        'HRD — modul SDM & Kehadiran, persetujuan cuti'),
  ('finance',   'Keuangan — modul Keuangan & Akuntansi'),
  ('inventory', 'Gudang — modul Inventaris & Pembelian'),
  ('sales',     'Penjualan — modul Penjualan & CRM')
ON CONFLICT (name) DO NOTHING;

-- --------------------------------------------------------------------------
-- Chart of accounts (~34 akun, mengikuti pengelompokan PSAK)
-- --------------------------------------------------------------------------
INSERT INTO public.accounts (code, name, type, description) VALUES
  -- Aset Lancar (1-1xx)
  ('1100', 'Kas',                              'asset', 'Kas tunai perusahaan'),
  ('1110', 'Bank',                             'asset', 'Rekening bank perusahaan'),
  ('1120', 'Piutang Usaha',                    'asset', 'Tagihan kepada pelanggan'),
  ('1130', 'Persediaan Barang Dagang',         'asset', 'Nilai persediaan (metode Average)'),
  ('1140', 'Beban Dibayar di Muka',            'asset', 'Beban yang dibayar di muka'),
  -- Aset Tetap (1-2xx)
  ('1210', 'Kendaraan',                        'asset', 'Harga perolehan kendaraan'),
  ('1211', 'Akumulasi Penyusutan - Kendaraan', 'asset', 'Akun kontra aset untuk kendaraan'),
  ('1220', 'Peralatan Kantor',                 'asset', 'Harga perolehan peralatan kantor'),
  ('1221', 'Akumulasi Penyusutan - Peralatan', 'asset', 'Akun kontra aset untuk peralatan'),
  ('1230', 'Bangunan',                         'asset', 'Harga perolehan bangunan'),
  ('1231', 'Akumulasi Penyusutan - Bangunan',  'asset', 'Akun kontra aset untuk bangunan'),
  -- Liabilitas (2-xxx)
  ('2100', 'Hutang Usaha',                     'liability', 'Kewajiban kepada pemasok'),
  ('2110', 'Hutang Bank',                      'liability', 'Pinjaman bank'),
  ('2120', 'Hutang Pajak',                     'liability', 'PPh 21, PPN, dan pajak lainnya yang masih harus dibayar'),
  ('2130', 'Beban yang Masih Harus Dibayar',   'liability', 'Beban terhutang, termasuk gaji'),
  ('2140', 'Uang Muka Pelanggan',              'liability', 'Uang muka / deposit dari pelanggan'),
  -- Ekuitas (3-xxx)
  ('3100', 'Modal Pemilik',                    'equity', 'Modal awal dan tambahan pemilik'),
  ('3200', 'Laba Ditahan',                     'equity', 'Akumulasi laba bersih tahun berjalan dan lalu'),
  ('3300', 'Prive Pemilik',                    'equity', 'Penarikan dana oleh pemilik (kontra ekuitas)'),
  -- Pendapatan (4-xxx)
  ('4100', 'Penjualan Barang Dagang',          'revenue', 'Pendapatan penjualan produk'),
  ('4200', 'Pendapatan Jasa',                  'revenue', 'Pendapatan jasa'),
  ('4300', 'Pendapatan Lain-lain',             'revenue', 'Pendapatan di luar usaha utama'),
  -- Harga Pokok Penjualan (5-xxx)
  ('5100', 'Harga Pokok Penjualan',            'expense', 'HPP atas barang yang terjual'),
  -- Beban Operasional (6-xxx)
  ('6100', 'Beban Gaji dan Tunjangan',         'expense', 'Gaji pokok, tunjangan, lembur, THR'),
  ('6110', 'Beban Jaminan Sosial (BPJS)',      'expense', 'Iuran BPJS Kesehatan & Ketenagakerjaan porsi perusahaan'),
  ('6120', 'Beban Sewa',                       'expense', 'Sewa kantor / gudang / toko'),
  ('6130', 'Beban Listrik, Air, dan Telepon',  'expense', 'Utilitas dan komunikasi'),
  ('6140', 'Beban Penyusutan',                 'expense', 'Penyusutan aset tetap (garis lurus default)'),
  ('6150', 'Beban Iklan dan Promosi',          'expense', 'Pemasaran dan promosi'),
  ('6160', 'Beban Administrasi dan Umum',      'expense', 'ATK, perizinan rutin, dan beban umum lainnya'),
  ('6170', 'Beban Pajak dan Perizinan',        'expense', 'Pajak dan perizinan yang menjadi beban'),
  -- Pendapatan/Beban Lain-lain (7-xxx)
  ('7100', 'Beban Bunga',                      'expense', 'Bunga pinjaman bank'),
  ('7200', 'Beban Lain-lain',                  'expense', 'Beban non-operasional lainnya')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Leave types (Jenis Cuti/Ijin/Sakit)
-- --------------------------------------------------------------------------
INSERT INTO public.leave_types (code, name, annual_quota_days, deducts_quota, requires_document) VALUES
  ('cuti_tahunan', 'Cuti Tahunan', 12, true,  false),
  ('ijin',         'Ijin',          12, true,  false),
  ('sakit',        'Sakit',          0, false, true)
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Asset categories with depreciation defaults
-- --------------------------------------------------------------------------
INSERT INTO public.asset_categories (code, name, default_useful_life_months, default_depreciation_method) VALUES
  ('kendaraan',  'Kendaraan',        96, 'straight_line'),
  ('peralatan',  'Peralatan Kantor', 48, 'straight_line'),
  ('bangunan',   'Bangunan',        240, 'straight_line'),
  ('mesin',      'Mesin & Peralatan Produksi', 96, 'straight_line')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Print templates (D10): the 5 Indonesian document templates
-- --------------------------------------------------------------------------
INSERT INTO public.print_templates (template_key, name, description) VALUES
  ('invoice',        'Invoice / Faktur', 'Faktur penjualan dengan kop perusahaan, rincian barang, dan nomor Faktur Pajak'),
  ('purchase_order', 'Purchase Order',   'Surat pesanan pembelian ke pemasok dengan kop perusahaan'),
  ('delivery_note',  'Surat Jalan',      'Dokumen pengiriman barang dengan kop perusahaan'),
  ('receipt',        'Kuitansi',         'Bukti penerimaan pembayaran dengan kop perusahaan'),
  ('pay_slip',       'Slip Gaji',        'Slip gaji karyawan dengan rincian penghasilan dan potongan')
ON CONFLICT (template_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Default company_settings row (locked decisions D6, D7, D9, D10)
-- --------------------------------------------------------------------------
INSERT INTO public.company_settings (
  costing_method,
  default_depreciation_method,
  default_approver_type,
  hr_takeover_enabled
) VALUES (
  'average',          -- D6: metode Average
  'straight_line',    -- D7: depresiasi garis lurus
  'direct_supervisor',-- D9: approver = atasan langsung
  true                -- D9: HR dapat mengambil alih approval
)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Explicit grants (belt & braces on top of Supabase default privileges)
-- --------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
