"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;

function toCents(n: number): number {
  return Math.round(n * 100);
}

type AccountRef = {
  id: string;
  code: string;
  name: string;
  is_header: boolean;
  is_active: boolean;
};

/**
 * Nomor jurnal berformat JU-YYYY-NNNN, mis. JU-2026-0007.
 * Nomor dihitung dari jumlah jurnal pada tahun tersebut (+1).
 */
async function generateEntryNumber(
  supabase: SupabaseClient,
  year: string,
  extraBump = 0
): Promise<string> {
  const { count } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .gte("entry_date", `${year}-01-01`)
    .lte("entry_date", `${year}-12-31`);
  const seq = (count ?? 0) + 1 + extraBump;
  return `JU-${year}-${String(seq).padStart(4, "0")}`;
}

/** Periode akuntansi untuk tanggal tsb. sudah ditutup? */
async function isPeriodClosed(
  supabase: SupabaseClient,
  entryDate: string
): Promise<boolean> {
  const { data } = await supabase
    .from("fiscal_periods")
    .select("id")
    .lte("start_date", entryDate)
    .gte("end_date", entryDate)
    .eq("is_closed", true)
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// Bagan Akun
// ---------------------------------------------------------------------------

export async function createAccount(input: {
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
  isHeader?: boolean;
  description?: string;
}): Promise<ActionResult> {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { ok: false, error: "Kode akun wajib diisi." };
  if (!name) return { ok: false, error: "Nama akun wajib diisi." };
  if (!(VALID_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, error: "Tipe akun tidak valid." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Kode akun "${code}" sudah digunakan.` };
  }

  const parentId =
    input.parentId && input.parentId.trim() ? input.parentId.trim() : null;
  if (parentId) {
    const { data: parent } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) {
      return { ok: false, error: "Akun induk tidak ditemukan." };
    }
  }

  const { error } = await supabase.from("accounts").insert({
    code,
    name,
    type: input.type,
    parent_id: parentId,
    is_header: !!input.isHeader,
    description: input.description?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Kode akun "${code}" sudah digunakan.` };
    }
    return { ok: false, error: "Gagal menyimpan akun. Silakan coba lagi." };
  }

  revalidatePath("/keuangan");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Jurnal Umum
// ---------------------------------------------------------------------------

export type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
};

export async function createJournalEntry(input: {
  entryDate: string;
  description: string;
  lines: JournalLineInput[];
  post: boolean;
}): Promise<ActionResult & { entryNumber?: string }> {
  const description = input.description.trim();
  if (!input.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) {
    return { ok: false, error: "Tanggal jurnal tidak valid." };
  }
  if (!description) {
    return { ok: false, error: "Keterangan jurnal wajib diisi." };
  }

  // Baris kosong (tanpa akun / tanpa nominal) diabaikan.
  const lines = (input.lines ?? []).filter(
    (l) =>
      l.accountId &&
      (toCents(l.debit) > 0 || toCents(l.credit) > 0)
  );
  if (lines.length < 2) {
    return { ok: false, error: "Jurnal membutuhkan minimal 2 baris akun." };
  }

  const supabase = await createClient();

  // --- Validasi akun: ada, aktif, bukan header ---
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, is_header, is_active")
    .in("id", accountIds);
  const byId = new Map(
    ((accounts ?? []) as AccountRef[]).map((a) => [a.id, a])
  );
  for (const line of lines) {
    const acct = byId.get(line.accountId);
    if (!acct) {
      return { ok: false, error: "Salah satu akun tidak ditemukan." };
    }
    if (!acct.is_active) {
      return { ok: false, error: `Akun ${acct.code} sudah tidak aktif.` };
    }
    if (acct.is_header) {
      return {
        ok: false,
        error: `Akun ${acct.code} adalah akun induk (header) — tidak boleh dijurnal langsung.`,
      };
    }
    const d = toCents(line.debit);
    const c = toCents(line.credit);
    if (d < 0 || c < 0) {
      return { ok: false, error: "Nominal tidak boleh negatif." };
    }
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      return {
        ok: false,
        error:
          "Setiap baris harus diisi di SATU sisi saja (debit ATAU kredit).",
      };
    }
  }

  // --- Keseimbangan jurnal: Σdebit HARUS = Σkredit (dihitung dalam sen) ---
  const totalDebit = lines.reduce((s, l) => s + toCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toCents(l.credit), 0);
  if (totalDebit === 0) {
    return { ok: false, error: "Total jurnal tidak boleh nol." };
  }
  if (totalDebit !== totalCredit) {
    return {
      ok: false,
      error: `Jurnal tidak seimbang: total debit ${formatIDR(totalDebit / 100)} ≠ total kredit ${formatIDR(totalCredit / 100)}.`,
    };
  }

  // --- Periode tutup menolak pembukuan ---
  if (input.post && (await isPeriodClosed(supabase, input.entryDate))) {
    return {
      ok: false,
      error: "Periode akuntansi untuk tanggal tersebut sudah ditutup.",
    };
  }

  const current = await getCurrentUser();
  const year = input.entryDate.slice(0, 4);

  // --- Simpan header (coba ulang bila nomor bentrok) ---
  let entryNumber = await generateEntryNumber(supabase, year);
  let headerId: string | null = null;
  for (let attempt = 0; attempt < 3 && !headerId; attempt++) {
    if (attempt > 0) {
      entryNumber = await generateEntryNumber(supabase, year, attempt);
    }
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        entry_number: entryNumber,
        entry_date: input.entryDate,
        description,
        reference_type: "manual",
        status: input.post ? "posted" : "draft",
        created_by: current?.user?.id ?? null,
        posted_at: input.post ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();
    if (!error && data) {
      headerId = (data as { id: string }).id;
    } else if (!error || (error as { code?: string }).code !== "23505") {
      return { ok: false, error: "Gagal menyimpan jurnal. Silakan coba lagi." };
    }
    // 23505 = nomor sudah dipakai: loop dan coba nomor berikutnya.
  }
  if (!headerId) {
    return { ok: false, error: "Gagal menyimpan jurnal. Silakan coba lagi." };
  }

  // --- Simpan baris-baris ---
  const payload = lines.map((l, i) => ({
    journal_entry_id: headerId as string,
    account_id: l.accountId,
    debit: toCents(l.debit) / 100,
    credit: toCents(l.credit) / 100,
    description: l.description?.trim() || null,
    line_order: i,
  }));
  const { error: lineError } = await supabase
    .from("journal_lines")
    .insert(payload);
  if (lineError) {
    // Batalkan header agar tidak ada jurnal yatim tanpa baris.
    await supabase.from("journal_entries").delete().eq("id", headerId);
    return {
      ok: false,
      error: "Gagal menyimpan baris jurnal. Silakan coba lagi.",
    };
  }

  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true, entryNumber };
}

/** Bukukan jurnal draf: validasi ulang keseimbangan dari baris di database. */
export async function postJournalEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, entry_date, status")
    .eq("id", entryId)
    .maybeSingle();
  const row = entry as { id: string; entry_date: string; status: string } | null;
  if (!row) return { ok: false, error: "Jurnal tidak ditemukan." };
  if (row.status !== "draft") {
    return {
      ok: false,
      error: "Hanya jurnal berstatus Draf yang dapat dibukukan.",
    };
  }
  if (await isPeriodClosed(supabase, row.entry_date)) {
    return {
      ok: false,
      error: "Periode akuntansi untuk tanggal jurnal sudah ditutup.",
    };
  }

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("debit, credit")
    .eq("journal_entry_id", entryId);
  const rows = ((lines ?? []) as Array<{
    debit: string | number | null;
    credit: string | number | null;
  }>);
  if (rows.length < 2) {
    return { ok: false, error: "Jurnal tidak valid (kurang dari 2 baris)." };
  }
  const d = rows.reduce((s, l) => s + toCents(Number(l.debit)), 0);
  const c = rows.reduce((s, l) => s + toCents(Number(l.credit)), 0);
  if (d !== c || d === 0) {
    return {
      ok: false,
      error: "Jurnal tidak seimbang — tidak dapat dibukukan.",
    };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) return { ok: false, error: "Gagal membukukan jurnal." };

  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Batalkan jurnal (void): tetap tersimpan untuk keperluan audit. */
export async function voidJournalEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("id", entryId)
    .maybeSingle();
  const row = entry as { id: string; status: string } | null;
  if (!row) return { ok: false, error: "Jurnal tidak ditemukan." };
  if (row.status === "void") {
    return { ok: false, error: "Jurnal ini sudah dibatalkan." };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "void" })
    .eq("id", entryId);
  if (error) return { ok: false, error: "Gagal membatalkan jurnal." };

  revalidatePath("/keuangan");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Buku Besar
// ---------------------------------------------------------------------------

export type LedgerRow = {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type LedgerResult =
  | {
      ok: true;
      account: { code: string; name: string; type: string };
      openingBalance: number;
      rows: LedgerRow[];
      totalDebit: number;
      totalCredit: number;
    }
  | { ok: false; error: string };

type RawLedgerLine = {
  debit: string | number | null;
  credit: string | number | null;
  created_at: string;
  entry:
    | {
        id: string;
        entry_number: string;
        entry_date: string;
        description: string;
        status: string;
      }
    | Array<{
        id: string;
        entry_number: string;
        entry_date: string;
        description: string;
        status: string;
      }>
    | null;
};

function oneEntry(
  v: RawLedgerLine["entry"]
): {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
} | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getLedger(
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<LedgerResult> {
  if (!accountId) {
    return { ok: false, error: "Pilih akun terlebih dahulu." };
  }
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("id", accountId)
    .maybeSingle();
  const acct = account as {
    id: string;
    code: string;
    name: string;
    type: "asset" | "liability" | "equity" | "revenue" | "expense";
  } | null;
  if (!acct) return { ok: false, error: "Akun tidak ditemukan." };

  // Seluruh mutasi posted akun ini; pengurutan dilakukan di aplikasi
  // agar tidak bergantung pada sintaks order tabel relasi.
  const { data: lines, error } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, created_at, entry:journal_entries!inner(id, entry_number, entry_date, description, status)"
    )
    .eq("account_id", accountId)
    .eq("entry.status", "posted");

  if (error) {
    return { ok: false, error: "Gagal memuat buku besar." };
  }

  const all = ((lines ?? []) as RawLedgerLine[])
    .map((l) => {
      const e = oneEntry(l.entry);
      if (!e) return null;
      return {
        entryId: e.id,
        entryNumber: e.entry_number,
        entryDate: e.entry_date,
        description: e.description,
        createdAt: l.created_at,
        debit:
          Math.round(Number(l.debit ?? 0) * 100) / 100,
        credit:
          Math.round(Number(l.credit ?? 0) * 100) / 100,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) =>
      a.entryDate < b.entryDate
        ? -1
        : a.entryDate > b.entryDate
          ? 1
          : a.createdAt < b.createdAt
            ? -1
            : 1
    );

  const saldoOf = (debit: number, credit: number): number =>
    acct.type === "asset" || acct.type === "expense"
      ? debit - credit
      : credit - debit;

  let openingBalance = 0;
  for (const l of all) {
    if (l.entryDate < fromDate) openingBalance += saldoOf(l.debit, l.credit);
  }

  const rows: LedgerRow[] = [];
  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of all) {
    if (l.entryDate < fromDate || l.entryDate > toDate) continue;
    running += saldoOf(l.debit, l.credit);
    totalDebit += l.debit;
    totalCredit += l.credit;
    rows.push({ ...l, runningBalance: running });
  }

  return {
    ok: true,
    account: { code: acct.code, name: acct.name, type: acct.type },
    openingBalance,
    rows,
    totalDebit,
    totalCredit,
  };
}
