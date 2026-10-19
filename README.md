# ERP

Sistem ERP — aplikasi web single-tenant untuk perusahaan umum di Indonesia.
Satu deployment melayani satu perusahaan, dengan database terpisah per
perusahaan.

## Modul (v1)

- Dashboard
- Keuangan & Akuntansi
- SDM & Kehadiran
- Inventaris & Gudang
- Pembelian & Penjualan
- CRM
- Aset Tetap
- Pengaturan

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr`
- Bahasa produk: Indonesia

## Persiapan

1. Salin `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   dengan kredensial proyek Supabase Anda.

## Perintah

```bash
npm install     # instal dependensi
npm run dev     # jalankan di http://localhost:3000
npm run build   # build produksi
npm run start   # jalankan build produksi
npm run typecheck  # cek TypeScript (tsc --noEmit)
```

## Struktur

```
app/
  (auth)/login/      Halaman masuk
  (app)/             Area aplikasi (wajib login via middleware)
    dashboard/
    keuangan/ sdm/ inventaris/ pembelian-penjualan/ crm/ aset/ pengaturan/
  globals.css        Sistem desain glass + Tailwind v4
  layout.tsx         Font Plus Jakarta Sans + latar aurora
components/ui/       GlassCard, GlassButton, GlassInput, GlassModal,
                     Sidebar, DataTable, ModulePlaceholder
lib/supabase/        client.ts (browser), server.ts (server),
                     middleware.ts (penyegaran sesi)
middleware.ts        Proteksi rute + refresh sesi Supabase
```

## Catatan

- Jangan pernah me-commit kunci Supabase asli (`.env.local` sudah diabaikan git).
- Setiap deployment VPS = satu perusahaan (single-tenant).
