"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL PENGATURAN (SETTINGS ACTIONS)
 * ============================================================================
 * 
 * Mengatur persistensi data konfigurasi perusahaan ke database Supabase:
 * 1. saveCompanyProfile(): Melakukan upsert pada tabel companies dan menyinkronkan kop surat ke company_settings.
 * 2. updateCostingMethod(): Menyimpan preferensi metode kalkulasi HPP persediaan (Average/FIFO).
 * 3. updateDepreciationMethod(): Menyimpan default metode depresiasi aset tetap (Straight-Line/Declining-Balance).
 * 4. updateApprovalSettings(): Mengonfigurasi wewenang takeover persetujuan oleh divisi HR.
 * 5. togglePrintTemplate(): Mengaktifkan atau menonaktifkan template dokumen cetak pada tabel print_templates.
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCompanyProfile(input: {
  name: string;
  address: string;
  phone: string;
  email: string;
  npwp: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan masuk kembali." };
  }

  const name = input.name.trim();
  const address = input.address.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const npwp = input.npwp.trim();

  if (name.length < 3) {
    return { ok: false, error: "Nama perusahaan minimal 3 karakter." };
  }

  const supabase = await createClient();

  // 1. Update/Upsert companies row (singleton = true)
  const { error: companyError } = await supabase
    .from("companies")
    .upsert(
      {
        singleton: true,
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        npwp: npwp || null,
      },
      { onConflict: "singleton" }
    );

  if (companyError) {
    return {
      ok: false,
      error: `Gagal menyimpan profil perusahaan: ${companyError.message}`,
    };
  }

  // 2. Sync to company_settings letterhead fields (D10)
  const { error: settingsError } = await supabase
    .from("company_settings")
    .upsert(
      {
        singleton: true,
        letterhead_company_name: name,
        letterhead_address: address || null,
        letterhead_phone: phone || null,
        letterhead_npwp: npwp || null,
      },
      { onConflict: "singleton" }
    );

  if (settingsError) {
    return {
      ok: false,
      error: `Gagal memperbarui kop surat: ${settingsError.message}`,
    };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/pembelian-penjualan");
  revalidatePath("/sdm");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCostingMethod(
  costingMethod: "average" | "fifo"
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan masuk kembali." };
  }

  if (costingMethod !== "average" && costingMethod !== "fifo") {
    return { ok: false, error: "Metode penilaian stok tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .upsert(
      {
        singleton: true,
        costing_method: costingMethod,
      },
      { onConflict: "singleton" }
    );

  if (error) {
    return {
      ok: false,
      error: `Gagal menyimpan metode stok: ${error.message}`,
    };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/inventaris");
  return { ok: true };
}

export async function updateDepreciationMethod(
  depreciationMethod: "straight_line" | "declining_balance"
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan masuk kembali." };
  }

  if (
    depreciationMethod !== "straight_line" &&
    depreciationMethod !== "declining_balance"
  ) {
    return { ok: false, error: "Metode penyusutan tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .upsert(
      {
        singleton: true,
        default_depreciation_method: depreciationMethod,
      },
      { onConflict: "singleton" }
    );

  if (error) {
    return {
      ok: false,
      error: `Gagal menyimpan metode depresiasi: ${error.message}`,
    };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/aset");
  return { ok: true };
}

export async function updateApprovalSettings(input: {
  hrTakeoverEnabled?: boolean;
  defaultApproverType?: "direct_supervisor" | "hr" | "finance";
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan masuk kembali." };
  }

  const payload: Record<string, unknown> = { singleton: true };
  if (typeof input.hrTakeoverEnabled === "boolean") {
    payload.hr_takeover_enabled = input.hrTakeoverEnabled;
  }
  if (input.defaultApproverType) {
    payload.default_approver_type = input.defaultApproverType;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .upsert(payload, { onConflict: "singleton" });

  if (error) {
    return {
      ok: false,
      error: `Gagal menyimpan alur persetujuan: ${error.message}`,
    };
  }

  revalidatePath("/pengaturan");
  return { ok: true };
}

export async function togglePrintTemplate(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan masuk kembali." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("print_templates")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: `Gagal mengubah status template: ${error.message}`,
    };
  }

  revalidatePath("/pengaturan");
  return { ok: true };
}

