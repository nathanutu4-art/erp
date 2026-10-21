/**
 * ============================================================================
 * MODUL PENGATURAN PERUSAHAAN & SISTEM (COMPANY & SYSTEM SETTINGS)
 * ============================================================================
 * 
 * Mengelola konfigurasi identitas perusahaan dan aturan global aplikasi (singleton):
 * 1. Profil Perusahaan: Nama resmi, alamat, telepon, email, NPWP, dan kop surat dokumen.
 * 2. Persetujuan & Metode: Penilaian persediaan (Average/FIFO), depresiasi default (Garis Lurus/Saldo Menurun), dan alur approval.
 * 3. Template Cetak: Status ketersediaan 5 format standar dokumen komersial Indonesia (Invoice, PO, Surat Jalan, Kuitansi, Slip Gaji).
 * ============================================================================
 */

import { createClient } from "@/lib/supabase/server";
import { PengaturanClient } from "./_components/PengaturanClient";

export default async function PengaturanPage() {
  const supabase = await createClient();

  const [companyRes, settingsRes, templatesRes] = await Promise.all([
    supabase.from("companies").select("*").limit(1).maybeSingle(),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase.from("print_templates").select("*").order("name"),
  ]);

  const company = {
    name: companyRes.data?.name ?? "PT Maju Bersama",
    address:
      companyRes.data?.address ??
      "Jl. Raya Pasar Minggu No. 88, Jakarta Selatan 12520",
    phone: companyRes.data?.phone ?? "(021) 7888-4455",
    email: companyRes.data?.email ?? "admin@majubersama.co.id",
    npwp: companyRes.data?.npwp ?? "01.845.322.9-015.000",
  };

  const settings = {
    costingMethod: settingsRes.data?.costing_method ?? "average",
    depreciationMethod:
      settingsRes.data?.default_depreciation_method ?? "straight_line",
    approverType:
      settingsRes.data?.default_approver_type ?? "direct_supervisor",
    hrTakeoverEnabled: settingsRes.data?.hr_takeover_enabled ?? true,
  };

  const templates = (templatesRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    code: t.template_key,
    template_key: t.template_key,
    is_active: t.is_active,
    description: t.description ?? "",
  }));

  return (
    <PengaturanClient
      company={company}
      settings={settings}
      templates={templates}
    />
  );
}
