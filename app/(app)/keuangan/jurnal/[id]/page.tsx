import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  toNumber,
  one,
  STATUS_LABEL,
  STATUS_STYLE,
  type JournalStatus,
} from "../../_lib/finance";
import { JurnalDetailActions } from "../../_components/JurnalDetailActions";

type EntryRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: JournalStatus;
  reference_type: string | null;
  posted_at: string | null;
  created_at: string;
};

type LineRow = {
  id: string;
  debit: string | number | null;
  credit: string | number | null;
  description: string | null;
  line_order: number;
  account: { code: string; name: string } | Array<{ code: string; name: string }> | null;
};

export default async function JurnalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entryData } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_number, entry_date, description, status, reference_type, posted_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  const entry = entryData as EntryRow | null;
  if (!entry) notFound();

  const { data: linesData } = await supabase
    .from("journal_lines")
    .select("id, debit, credit, description, line_order, account:accounts(code, name)")
    .eq("journal_entry_id", id)
    .order("line_order", { ascending: true });
  const lines = ((linesData ?? []) as LineRow[]).map((l) => ({
    ...l,
    account: one(l.account),
  }));

  const totalDebit = lines.reduce((s, l) => s + toNumber(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toNumber(l.credit), 0);
  const balanced =
    Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  return (
    <div>
      <Link
        href="/keuangan?tab=jurnal"
        className="inline-flex items-center min-h-[44px] text-sm font-semibold text-teal-200 hover:text-teal-100 mb-4"
      >
        ← Kembali ke Jurnal Umum
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 font-mono">
            {entry.entry_number}
          </h1>
          <p className="text-sm text-slate-300/80 mt-1">{entry.description}</p>
        </div>
        <span
          className={`inline-flex items-center min-h-[44px] text-xs font-bold rounded-full px-4 border ${STATUS_STYLE[entry.status] ?? STATUS_STYLE.draft}`}
        >
          {STATUS_LABEL[entry.status] ?? entry.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-300/70">Tanggal</p>
          <p className="text-sm font-bold text-slate-100 mt-1">
            {formatTanggal(entry.entry_date)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-slate-300/70">Sumber</p>
          <p className="text-sm font-bold text-slate-100 mt-1 capitalize">
            {entry.reference_type ?? "—"}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-slate-300/70">Dibukukan pada</p>
          <p className="text-sm font-bold text-slate-100 mt-1">
            {entry.posted_at ? formatTanggal(entry.posted_at) : "—"}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-2 sm:p-4 mb-6">
        <div className="tbl-wrap">
          <table className="min-w-[640px]">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Akun</th>
                <th>Keterangan Baris</th>
                <th className="!text-right">Debit</th>
                <th className="!text-right">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">
                    {l.account?.code ?? "—"}
                  </td>
                  <td className="!whitespace-normal min-w-[160px]">
                    {l.account?.name ?? "—"}
                  </td>
                  <td className="!whitespace-normal min-w-[140px] text-slate-300/80">
                    {l.description ?? "—"}
                  </td>
                  <td className="!text-right whitespace-nowrap">
                    {toNumber(l.debit) > 0 ? formatIDR(toNumber(l.debit)) : "—"}
                  </td>
                  <td className="!text-right whitespace-nowrap">
                    {toNumber(l.credit) > 0 ? formatIDR(toNumber(l.credit)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20 font-bold">
                <td colSpan={3}>Total</td>
                <td className="!text-right whitespace-nowrap">
                  {formatIDR(totalDebit)}
                </td>
                <td className="!text-right whitespace-nowrap">
                  {formatIDR(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-3 sm:px-4 py-3">
          <span
            className={`inline-block text-xs font-bold rounded-full px-3 py-1 border ${
              balanced
                ? "bg-teal-400/20 text-teal-200 border-teal-300/40"
                : "bg-rose-500/20 text-rose-200 border-rose-300/40"
            }`}
          >
            {balanced ? "✓ Seimbang" : "⚠ Tidak seimbang"}
          </span>
        </div>
      </GlassCard>

      <JurnalDetailActions entryId={entry.id} status={entry.status} />
    </div>
  );
}
