"use server";

/**
 * ============================================================================
 * SERVER ACTIONS MODUL CRM PELANGGAN
 * ============================================================================
 * 
 * Logika mutasi relasi pelanggan di sisi server:
 * 1. createCustomer(): Mendaftarkan pelanggan baru dan menghasilkan nomor unik CUST-YYYY-NNNN.
 * 2. updateCustomer(): Memperbarui informasi kontak, alamat, dan plafon kredit pelanggan.
 * 3. toggleCustomerStatus(): Mengaktifkan atau menonaktifkan status akun pelanggan.
 * 4. recordCustomerInteraction(): Mencatat log interaksi (pertemuan, panggilan telepon, email penawaran).
 * ============================================================================
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  isDateValid,
  todayISO,
  INTERACTION_TYPE_ORDER,
  type InteractionType,
} from "./_lib/crm";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const current = await getCurrentUser();
  if (!current?.user) return { ok: false, error: "Anda harus masuk." };
  return { ok: true, userId: current.user.id };
}

// ---------------------------------------------------------------------------
// Pelanggan
// ---------------------------------------------------------------------------

export async function createCustomer(input: {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) return { ok: false, error: "Kode pelanggan wajib diisi." };
  if (!name) return { ok: false, error: "Nama pelanggan wajib diisi." };

  const creditLimit = Math.round(Number(input.creditLimit ?? 0) * 100) / 100;
  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return { ok: false, error: "Batas kredit tidak valid." };
  }
  if (input.email && input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { ok: false, error: "Alamat email tidak valid." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Kode pelanggan "${code}" sudah digunakan.` };
  }

  const { error } = await supabase.from("customers").insert({
    code,
    name,
    contact_person: input.contactPerson?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    tax_id: input.taxId?.trim() || null,
    credit_limit: creditLimit,
    is_active: input.isActive ?? true,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: `Kode pelanggan "${code}" sudah digunakan.` };
    }
    return { ok: false, error: "Gagal menyimpan pelanggan. Silakan coba lagi." };
  }

  revalidatePath("/crm");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Interaksi pelanggan
// ---------------------------------------------------------------------------

export async function createInteraction(input: {
  customerId: string;
  interactionDate?: string;
  type: string;
  subject?: string;
  notes?: string;
  followUpDate?: string | null;
}): Promise<ActionResult> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!input.customerId) {
    return { ok: false, error: "Pelanggan tidak valid." };
  }
  if (!(INTERACTION_TYPE_ORDER as readonly string[]).includes(input.type)) {
    return { ok: false, error: "Tipe interaksi tidak valid." };
  }

  const interactionDate = isDateValid(input.interactionDate)
    ? input.interactionDate!
    : todayISO();
  const followUpDate = input.followUpDate?.trim() || null;
  if (followUpDate && !isDateValid(followUpDate)) {
    return { ok: false, error: "Tanggal tindak lanjut tidak valid." };
  }

  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", input.customerId)
    .maybeSingle();
  if (!customer) {
    return { ok: false, error: "Pelanggan tidak ditemukan." };
  }

  const { error } = await supabase.from("customer_interactions").insert({
    customer_id: input.customerId,
    interaction_date: interactionDate,
    type: input.type as InteractionType,
    subject: input.subject?.trim() || null,
    notes: input.notes?.trim() || null,
    follow_up_date: followUpDate,
    created_by: auth.userId,
  });
  if (error) {
    return { ok: false, error: "Gagal mencatat interaksi. Silakan coba lagi." };
  }

  revalidatePath(`/crm/${input.customerId}`);
  revalidatePath("/crm");
  return { ok: true };
}
