/**
 * Utilitas bersama modul CRM (dipakai sisi server & klien).
 * Berisi tipe, label Bahasa Indonesia, dan helper kecil.
 */

export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalisasi relasi hasil join: di runtime berupa objek tunggal,
 * tetapi tipe inferensi Supabase menyatakannya sebagai array.
 */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function isDateValid(s: string | null | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type InteractionType =
  | "call"
  | "meeting"
  | "email"
  | "whatsapp"
  | "note"
  | "follow_up";

export const INTERACTION_TYPE_LABEL: Record<InteractionType, string> = {
  call: "Telepon",
  meeting: "Rapat",
  email: "Email",
  whatsapp: "WhatsApp",
  note: "Catatan",
  follow_up: "Tindak Lanjut",
};

export const INTERACTION_TYPE_ORDER: InteractionType[] = [
  "call",
  "meeting",
  "email",
  "whatsapp",
  "note",
  "follow_up",
];

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
};

export const CUSTOMER_STATUS_STYLE: Record<string, string> = {
  active: "bg-teal-400/20 text-teal-200 border-teal-300/40",
  inactive: "bg-slate-400/20 text-slate-300 border-slate-300/40",
};
