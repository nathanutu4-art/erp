/**
 * ============================================================================
 * MODUL KEUANGAN & AKUNTANSI (FINANCE & ACCOUNTING MODULE)
 * ============================================================================
 * 
 * Halaman Server Component utama untuk mengelola pembukuan dan akuntansi perusahaan:
 * 1. Bagan Akun (Chart of Accounts / COA): Master klasifikasi akun (Aset, Liabilitas, Ekuitas, Pendapatan, Beban).
 * 2. Jurnal Umum (General Journal): Pencatatan transaksi double-entry (Debit & Kredit) dengan status Draf, Terposting, dan Batal.
 * 3. Buku Besar (General Ledger): Rincian mutasi debit/kredit per akun spesifik dengan saldo berjalan (running balance).
 * 4. Laporan Laba Rugi (Income Statement): Menghitung pendapatan operasional, HPP, beban operasional, dan laba bersih periode berjalan.
 * 5. Neraca (Balance Sheet): Posisi keuangan perusahaan (Total Aset = Total Liabilitas + Total Ekuitas) per tanggal tertentu.
 * 6. Laporan Arus Kas (Cash Flow Statement): Arus kas dari aktivitas operasi, investasi, dan pendanaan.
 * 
 * Standar Akuntansi:
 * - Mengikuti kaidah Standar Akuntansi Keuangan (SAK / PSAK) Indonesia.
 * - Saldo normal: Aset & Beban bertambah di Debit; Liabilitas, Ekuitas, & Pendapatan bertambah di Kredit.
 * ============================================================================
 */

import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatTanggal } from "@/lib/format";
import { KeuanganTabs } from "./_components/KeuanganTabs";
import {
  BaganAkunClient,
  type AccountRow,
} from "./_components/BaganAkunClient";
import { JurnalClient, type JournalRow } from "./_components/JurnalClient";
import { BukuBesarClient } from "./_components/BukuBesarClient";
import { PeriodePicker, TanggalPicker } from "./_components/Pickers";
import {
  LaporanLabaRugi,
  LaporanNeraca,
  LaporanArusKas,
  type ReportAccountLine,
  type CashFlowItem,
} from "./_components/Laporan";
import {
  toNumber,
  one,
  saldoNormal,
  labelPeriode,
  CASH_ACCOUNT_CODES,
  type AccountType,
  type JournalStatus,
} from "./_lib/finance";

const TABS = [
  "bagan-akun",
  "jurnal",
  "buku-besar",
  "laba-rugi",
  "neraca",
  "arus-kas",
] as const;
type TabKey = (typeof TABS)[number];

function currentPeriode(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(periode: string): [string, string] {
  const [y, m] = periode.split("-").map(Number);
  const safeY = Number.isFinite(y) ? y : new Date().getFullYear();
  const safeM = m >= 1 && m <= 12 ? m : 1;
  const last = new Date(safeY, safeM, 0).getDate();
  const mm = String(safeM).padStart(2, "0");
  return [`${safeY}-${mm}-01`, `${safeY}-${mm}-${String(last).padStart(2, "0")}`];
}

function isPeriodeValid(p: string | undefined): p is string {
  return !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

type SearchParams = {
  tab?: string;
  q?: string;
  status?: string;
  periode?: string;
  tanggal?: string;
};

// ---------------------------------------------------------------------------
// Tipe baris mentah dari Supabase
// ---------------------------------------------------------------------------

type RawAccount = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id: string | null;
  is_header: boolean;
  is_active: boolean;
};

type RawPostedLine = {
  debit: string | number | null;
  credit: string | number | null;
  account_id: string;
  account:
    | { id: string; code: string; name: string; type: AccountType }
    | Array<{ id: string; code: string; name: string; type: AccountType }>
    | null;
  entry:
    | { status: string; entry_date: string }
    | Array<{ status: string; entry_date: string }>
    | null;
};

type RawJournal = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: JournalStatus;
  journal_lines: Array<{
    debit: string | number | null;
    credit: string | number | null;
  }> | null;
};

type RawCashEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  journal_lines: Array<{
    debit: string | number | null;
    credit: string | number | null;
    account:
      | { id: string; code: string; name: string; type: AccountType }
      | Array<{ id: string; code: string; name: string; type: AccountType }>
      | null;
  }> | null;
};

// ---------------------------------------------------------------------------
// Pengambilan data per tab
// ---------------------------------------------------------------------------

async function getAccounts(): Promise<RawAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, code, name, type, parent_id, is_header, is_active")
    .order("code");
  return ((data ?? []) as RawAccount[]);
}

async function getPostedLines(): Promise<RawPostedLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account_id, account:accounts!inner(id, code, name, type), entry:journal_entries!inner(status, entry_date)"
    )
    .eq("entry.status", "posted");
  return ((data ?? []) as RawPostedLine[]);
}

async function getBaganAkun(): Promise<AccountRow[]> {
  const [accounts, lines] = await Promise.all([
    getAccounts(),
    getPostedLines(),
  ]);
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const s = sums.get(l.account_id) ?? { debit: 0, credit: 0 };
    s.debit += toNumber(l.debit);
    s.credit += toNumber(l.credit);
    sums.set(l.account_id, s);
  }
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return accounts.map((a) => {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    const parent = a.parent_id ? byId.get(a.parent_id) : undefined;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      parentCode: parent?.code ?? null,
      parentName: parent?.name ?? null,
      is_header: a.is_header,
      is_active: a.is_active,
      debit: s.debit,
      credit: s.credit,
    };
  });
}

async function getJournals(
  q: string,
  status: string
): Promise<{ entries: JournalRow[]; accounts: RawAccount[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("journal_entries")
    .select(
      "id, entry_number, entry_date, description, status, journal_lines(debit, credit)"
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "semua") query = query.eq("status", status);
  if (q.trim()) {
    const s = q.trim().replace(/[%_]/g, "");
    query = query.or(`entry_number.ilike.%${s}%,description.ilike.%${s}%`);
  }
  const [{ data }, accounts] = await Promise.all([
    query,
    getAccounts(),
  ]);
  const entries: JournalRow[] = ((data ?? []) as RawJournal[]).map((j) => ({
    id: j.id,
    entry_number: j.entry_number,
    entry_date: j.entry_date,
    description: j.description,
    status: j.status,
    total: (j.journal_lines ?? []).reduce(
      (sum, l) => sum + toNumber(l.debit),
      0
    ),
  }));
  return { entries, accounts };
}

type LabaRugiData = {
  revenues: ReportAccountLine[];
  expenses: ReportAccountLine[];
  totalRevenue: number;
  totalExpense: number;
};

async function getLabaRugi(periode: string): Promise<LabaRugiData> {
  const [start, end] = monthRange(periode);
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account:accounts!inner(id, code, name, type), entry:journal_entries!inner(status, entry_date)"
    )
    .eq("entry.status", "posted")
    .gte("entry.entry_date", start)
    .lte("entry.entry_date", end);

  const agg = new Map<
    string,
    { code: string; name: string; type: AccountType; debit: number; credit: number }
  >();
  for (const l of ((data ?? []) as RawPostedLine[])) {
    const acct = one(l.account);
    if (!acct || (acct.type !== "revenue" && acct.type !== "expense")) continue;
    const a = agg.get(acct.id) ?? {
      code: acct.code,
      name: acct.name,
      type: acct.type,
      debit: 0,
      credit: 0,
    };
    a.debit += toNumber(l.debit);
    a.credit += toNumber(l.credit);
    agg.set(acct.id, a);
  }

  const toLine = (a: {
    code: string;
    name: string;
    type: AccountType;
    debit: number;
    credit: number;
  }): ReportAccountLine => ({
    code: a.code,
    name: a.name,
    debit: a.debit,
    credit: a.credit,
    saldo: saldoNormal(a.type, a.debit, a.credit),
  });

  const revenues = [...agg.values()]
    .filter((a) => a.type === "revenue")
    .map(toLine)
    .sort((a, b) => (a.code < b.code ? -1 : 1));
  const expenses = [...agg.values()]
    .filter((a) => a.type === "expense")
    .map(toLine)
    .sort((a, b) => (a.code < b.code ? -1 : 1));

  return {
    revenues,
    expenses,
    totalRevenue: revenues.reduce((s, r) => s + r.saldo, 0),
    totalExpense: expenses.reduce((s, r) => s + r.saldo, 0),
  };
}

type NeracaData = {
  assets: ReportAccountLine[];
  liabilities: ReportAccountLine[];
  equities: ReportAccountLine[];
  totalAsset: number;
  totalLiability: number;
  totalEquity: number;
};

async function getNeraca(tanggal: string): Promise<NeracaData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account:accounts!inner(id, code, name, type), entry:journal_entries!inner(status, entry_date)"
    )
    .eq("entry.status", "posted")
    .lte("entry.entry_date", tanggal);

  const agg = new Map<
    string,
    { code: string; name: string; type: AccountType; debit: number; credit: number }
  >();
  for (const l of ((data ?? []) as RawPostedLine[])) {
    const acct = one(l.account);
    if (
      !acct ||
      (acct.type !== "asset" &&
        acct.type !== "liability" &&
        acct.type !== "equity")
    )
      continue;
    const a = agg.get(acct.id) ?? {
      code: acct.code,
      name: acct.name,
      type: acct.type,
      debit: 0,
      credit: 0,
    };
    a.debit += toNumber(l.debit);
    a.credit += toNumber(l.credit);
    agg.set(acct.id, a);
  }

  const toLine = (a: {
    code: string;
    name: string;
    type: AccountType;
    debit: number;
    credit: number;
  }): ReportAccountLine => ({
    code: a.code,
    name: a.name,
    debit: a.debit,
    credit: a.credit,
    saldo: saldoNormal(a.type, a.debit, a.credit),
  });

  const byType = (t: AccountType) =>
    [...agg.values()]
      .filter((a) => a.type === t)
      .map(toLine)
      .filter((r) => Math.abs(r.saldo) > 0.005 || r.debit > 0 || r.credit > 0)
      .sort((a, b) => (a.code < b.code ? -1 : 1));

  const assets = byType("asset");
  const liabilities = byType("liability");
  const equities = byType("equity");

  return {
    assets,
    liabilities,
    equities,
    totalAsset: assets.reduce((s, r) => s + r.saldo, 0),
    totalLiability: liabilities.reduce((s, r) => s + r.saldo, 0),
    totalEquity: equities.reduce((s, r) => s + r.saldo, 0),
  };
}

type ArusKasData = {
  operasi: CashFlowItem[];
  investasi: CashFlowItem[];
  pendanaan: CashFlowItem[];
  totalOperasi: number;
  totalInvestasi: number;
  totalPendanaan: number;
  saldoAwal: number;
  saldoAkhir: number;
};

/**
 * Klasifikasi aktivitas per jurnal berdasarkan akun lawan:
 * aset tetap (kode 12xx) → investasi; liabilitas/ekuitas → pendanaan;
 * selebihnya → operasi.
 */
function klasifikasiArusKas(
  lines: Array<{ code: string; type: AccountType }>
): "operasi" | "investasi" | "pendanaan" {
  const lawan = lines.filter((l) => !CASH_ACCOUNT_CODES.includes(l.code));
  if (lawan.some((l) => l.code.startsWith("12"))) return "investasi";
  if (
    lawan.some((l) => l.type === "liability" || l.type === "equity")
  )
    return "pendanaan";
  return "operasi";
}

async function getArusKas(periode: string): Promise<ArusKasData> {
  const [start, end] = monthRange(periode);
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_number, entry_date, description, journal_lines(debit, credit, account:accounts(id, code, name, type))"
    )
    .eq("status", "posted")
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  const operasi: CashFlowItem[] = [];
  const investasi: CashFlowItem[] = [];
  const pendanaan: CashFlowItem[] = [];

  for (const e of ((entries ?? []) as RawCashEntry[])) {
    const lines = (e.journal_lines ?? [])
      .map((l) => {
        const acct = one(l.account);
        if (!acct) return null;
        return {
          code: acct.code,
          type: acct.type,
          debit: toNumber(l.debit),
          credit: toNumber(l.credit),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const efekKas = lines
      .filter((l) => CASH_ACCOUNT_CODES.includes(l.code))
      .reduce((s, l) => s + (l.debit - l.credit), 0);
    if (Math.abs(efekKas) < 0.005) continue;

    const item: CashFlowItem = {
      entryNumber: e.entry_number,
      entryDate: e.entry_date,
      description: e.description,
      amount: Math.round(efekKas * 100) / 100,
    };
    const kelas = klasifikasiArusKas(lines);
    if (kelas === "investasi") investasi.push(item);
    else if (kelas === "pendanaan") pendanaan.push(item);
    else operasi.push(item);
  }

  // Saldo kas awal = saldo Kas+Bank sebelum periode berjalan.
  const { data: prior } = await supabase
    .from("journal_lines")
    .select(
      "debit, credit, account:accounts!inner(code), entry:journal_entries!inner(status, entry_date)"
    )
    .eq("entry.status", "posted")
    .lt("entry.entry_date", start)
    .in("account.code", CASH_ACCOUNT_CODES);

  let saldoAwal = 0;
  for (const l of ((prior ?? []) as Array<{
    debit: string | number | null;
    credit: string | number | null;
  }>)) {
    saldoAwal += toNumber(l.debit) - toNumber(l.credit);
  }

  const totalOperasi = operasi.reduce((s, i) => s + i.amount, 0);
  const totalInvestasi = investasi.reduce((s, i) => s + i.amount, 0);
  const totalPendanaan = pendanaan.reduce((s, i) => s + i.amount, 0);

  return {
    operasi,
    investasi,
    pendanaan,
    totalOperasi,
    totalInvestasi,
    totalPendanaan,
    saldoAwal: Math.round(saldoAwal * 100) / 100,
    saldoAkhir:
      Math.round(
        (saldoAwal + totalOperasi + totalInvestasi + totalPendanaan) * 100
      ) / 100,
  };
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabKey)
    : "bagan-akun";

  return (
    <div>
      <KeuanganTabs active={tab} />

      <div>
        {tab === "bagan-akun" && <BaganAkunTab />}
        {tab === "jurnal" && (
          <JurnalTab q={params.q ?? ""} status={params.status ?? "semua"} />
        )}
        {tab === "buku-besar" && <BukuBesarTab />}
        {tab === "laba-rugi" && (
          <LabaRugiTab
            periode={isPeriodeValid(params.periode) ? params.periode! : currentPeriode()}
          />
        )}
        {tab === "neraca" && (
          <NeracaTab
            tanggal={
              params.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(params.tanggal)
                ? params.tanggal
                : todayISO()
            }
          />
        )}
        {tab === "arus-kas" && (
          <ArusKasTab
            periode={isPeriodeValid(params.periode) ? params.periode! : currentPeriode()}
          />
        )}
      </div>
    </div>
  );
}

async function BaganAkunTab() {
  let accounts: AccountRow[] = [];
  try {
    accounts = await getBaganAkun();
  } catch {
    accounts = [];
  }
  return <BaganAkunClient accounts={accounts} />;
}

async function JurnalTab({ q, status }: { q: string; status: string }) {
  let entries: JournalRow[] = [];
  let accounts: RawAccount[] = [];
  try {
    const res = await getJournals(q, status);
    entries = res.entries;
    accounts = res.accounts;
  } catch {
    entries = [];
    accounts = [];
  }
  return (
    <JurnalClient
      entries={entries}
      accounts={accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        is_header: a.is_header,
        is_active: a.is_active,
      }))}
      initialQ={q}
      initialStatus={status}
    />
  );
}

async function BukuBesarTab() {
  let accounts: RawAccount[] = [];
  try {
    accounts = (await getAccounts()).filter((a) => a.is_active);
  } catch {
    accounts = [];
  }
  return (
    <BukuBesarClient
      accounts={accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        is_header: a.is_header,
        is_active: a.is_active,
      }))}
    />
  );
}

async function LabaRugiTab({ periode }: { periode: string }) {
  let data: LabaRugiData = {
    revenues: [],
    expenses: [],
    totalRevenue: 0,
    totalExpense: 0,
  };
  try {
    data = await getLabaRugi(periode);
  } catch {
    // tampilkan laporan kosong, bukan error mentah
  }
  return (
    <div>
      <div className="mb-4">
        <PeriodePicker value={periode} tab="laba-rugi" label="Periode" />
      </div>
      <LaporanLabaRugi
        revenues={data.revenues}
        expenses={data.expenses}
        totalRevenue={data.totalRevenue}
        totalExpense={data.totalExpense}
        periodeLabel={labelPeriode(periode)}
      />
    </div>
  );
}

async function NeracaTab({ tanggal }: { tanggal: string }) {
  let data: NeracaData = {
    assets: [],
    liabilities: [],
    equities: [],
    totalAsset: 0,
    totalLiability: 0,
    totalEquity: 0,
  };
  try {
    data = await getNeraca(tanggal);
  } catch {
    // tampilkan laporan kosong, bukan error mentah
  }
  return (
    <div>
      <div className="mb-4">
        <TanggalPicker value={tanggal} label="Per Tanggal" />
      </div>
      <LaporanNeraca
        assets={data.assets}
        liabilities={data.liabilities}
        equities={data.equities}
        totalAsset={data.totalAsset}
        totalLiability={data.totalLiability}
        totalEquity={data.totalEquity}
        tanggalLabel={formatTanggal(tanggal)}
      />
    </div>
  );
}

async function ArusKasTab({ periode }: { periode: string }) {
  let data: ArusKasData = {
    operasi: [],
    investasi: [],
    pendanaan: [],
    totalOperasi: 0,
    totalInvestasi: 0,
    totalPendanaan: 0,
    saldoAwal: 0,
    saldoAkhir: 0,
  };
  try {
    data = await getArusKas(periode);
  } catch {
    // tampilkan laporan kosong, bukan error mentah
  }
  return (
    <div>
      <div className="mb-4">
        <PeriodePicker value={periode} tab="arus-kas" label="Periode" />
      </div>
      <LaporanArusKas
        operasi={data.operasi}
        investasi={data.investasi}
        pendanaan={data.pendanaan}
        totalOperasi={data.totalOperasi}
        totalInvestasi={data.totalInvestasi}
        totalPendanaan={data.totalPendanaan}
        saldoAwal={data.saldoAwal}
        saldoAkhir={data.saldoAkhir}
        periodeLabel={labelPeriode(periode)}
      />
    </div>
  );
}
