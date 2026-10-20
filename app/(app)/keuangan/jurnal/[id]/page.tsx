import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  toNumber,
  one,
  STATUS_LABEL,
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
    <div className="fin-view on">
      <Link
        href="/keuangan?tab=jurnal"
        className="btn btn-sm"
        style={{ marginBottom: "14px", display: "inline-flex", textDecoration: "none" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        Kembali ke Jurnal Umum
      </Link>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>
              {entry.entry_number} — {entry.description}
            </h3>
            <p>
              Tanggal: {formatTanggal(entry.entry_date)} · Status: {STATUS_LABEL[entry.status] ?? entry.status}
            </p>
          </div>
          <div className="spacer" />
          <span
            className={`badge ${
              entry.status === "posted"
                ? "b-green"
                : entry.status === "void"
                ? "b-red"
                : "b-amber"
            }`}
          >
            <i />
            {STATUS_LABEL[entry.status] ?? entry.status}
          </span>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Kode</th>
                <th>Akun</th>
                <th className="num" style={{ width: "160px" }}>Debit</th>
                <th className="num" style={{ width: "160px" }}>Kredit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const isCredit = toNumber(l.credit) > 0;
                return (
                  <tr key={l.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {l.account?.code ?? "—"}
                    </td>
                    <td style={{ paddingLeft: isCredit ? "34px" : undefined }}>
                      {l.account?.name ?? "—"}
                      {l.description && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "12px",
                            color: "var(--muted)",
                          }}
                        >
                          {l.description}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {toNumber(l.debit) > 0 ? formatIDR(toNumber(l.debit)) : "—"}
                    </td>
                    <td className="num">
                      {toNumber(l.credit) > 0 ? formatIDR(toNumber(l.credit)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num">{formatIDR(totalDebit)}</td>
                <td className="num">{formatIDR(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div
          className="card-pad"
          style={{
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: "26px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="small">
            <span className="muted">Dibuat pada</span>
            <br />
            <b>{formatTanggal(entry.created_at)}</b>
          </div>
          <div className="small">
            <span className="muted">Referensi</span>
            <br />
            <b>{entry.reference_type ?? "Manual"}</b>
          </div>
          <div className="small">
            <span className="muted">Dibukukan pada</span>
            <br />
            <b>{entry.posted_at ? formatTanggal(entry.posted_at) : "—"}</b>
          </div>
          <div className="small">
            <span className="muted">Keseimbangan</span>
            <br />
            <b className={balanced ? "pos" : "neg"}>
              {balanced ? "Balance — selisih Rp 0" : "Tidak Seimbang!"}
            </b>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <JurnalDetailActions entryId={entry.id} status={entry.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
