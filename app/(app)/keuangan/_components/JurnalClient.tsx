"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { createJournalEntry, type JournalLineInput } from "../actions";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  STATUS_LABEL,
  type AccountOption,
  type JournalStatus,
} from "../_lib/finance";

export type JournalRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: JournalStatus;
  total: number;
};

// ---------------------------------------------------------------------------
// Modal formulir jurnal dengan validasi keseimbangan langsung (live)
// ---------------------------------------------------------------------------

type FormLine = {
  accountId: string;
  debit: string;
  credit: string;
  note: string;
};

const EMPTY_LINE: FormLine = { accountId: "", debit: "", credit: "", note: "" };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function JurnalFormModal({
  accounts,
  onClose,
}: {
  accounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entryDate, setEntryDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<FormLine[]>([
    { ...EMPTY_LINE },
    { ...EMPTY_LINE },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Hanya akun aktif & bukan header yang boleh dipilih.
  const postable = useMemo(
    () => accounts.filter((a) => a.is_active && !a.is_header),
    [accounts]
  );

  const totals = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const l of lines) {
      d += Math.round(parseAmount(l.debit) * 100);
      c += Math.round(parseAmount(l.credit) * 100);
    }
    return { debit: d / 100, credit: c / 100 };
  }, [lines]);

  const lineIssues = useMemo(
    () =>
      lines.map((l) => {
        if (!l.accountId) return "Pilih akun.";
        const d = parseAmount(l.debit);
        const c = parseAmount(l.credit);
        if (d > 0 && c > 0) return "Isi salah satu sisi saja.";
        if (d === 0 && c === 0) return "Isi nominal debit atau kredit.";
        return null;
      }),
    [lines]
  );

  const allLinesValid =
    lines.length >= 2 && lineIssues.every((i) => i === null);
  const balanced =
    allLinesValid && totals.debit === totals.credit && totals.debit > 0;
  const selisih = totals.debit - totals.credit;
  const canSave =
    balanced && description.trim().length > 0 && !pending;

  const updateLine = (i: number, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i: number) =>
    setLines((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)
    );

  const submit = (post: boolean) => {
    setError(null);
    const payload: JournalLineInput[] = lines.map((l) => ({
      accountId: l.accountId,
      debit: parseAmount(l.debit),
      credit: parseAmount(l.credit),
      description: l.note.trim() || undefined,
    }));
    startTransition(async () => {
      const res = await createJournalEntry({
        entryDate,
        description: description.trim(),
        lines: payload,
        post,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <GlassModal open onClose={onClose} title="Buat Jurnal Baru" wide>
      <div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="jurnal-tanggal">Tanggal *</label>
            <input
              id="jurnal-tanggal"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="jurnal-keterangan">Keterangan *</label>
            <input
              id="jurnal-keterangan"
              type="text"
              placeholder="mis. Penjualan tunai ke Pelanggan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: "14px", marginBottom: "8px" }}>
          <div className="j-head">
            <div>Akun</div>
            <div>Debit (Rp)</div>
            <div>Kredit (Rp)</div>
            <div />
          </div>

          {lines.map((l, i) => (
            <div key={i} className="j-line">
              <select
                aria-label={`Akun baris ${i + 1}`}
                value={l.accountId}
                onChange={(e) => updateLine(i, { accountId: e.target.value })}
              >
                <option value="">— Pilih akun —</option>
                {ACCOUNT_TYPE_ORDER.map((t) => {
                  const opts = postable.filter((a) => a.type === t);
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={t} label={ACCOUNT_TYPE_LABEL[t]}>
                      {opts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={l.debit}
                onChange={(e) => updateLine(i, { debit: e.target.value })}
              />
              <input
                type="number"
                min={0}
                placeholder="0"
                value={l.credit}
                onChange={(e) => updateLine(i, { credit: e.target.value })}
              />
              <button
                type="button"
                className="rm"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
                title="Hapus baris"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-sm"
            onClick={addLine}
            style={{ marginTop: "6px" }}
          >
            + Tambah Baris
          </button>
        </div>

        {/* Indikator keseimbangan langsung */}
        <div className="balance-bar">
          <div>
            Debit: <b>{formatIDR(totals.debit)}</b>
          </div>
          <div>
            Kredit: <b>{formatIDR(totals.credit)}</b>
          </div>
          <div className="spacer" />
          <span className={`badge ${balanced ? "b-green" : "b-amber"}`}>
            <i />
            {balanced
              ? "Keseimbangan: Balance"
              : `Belum Seimbang (selisih ${formatIDR(Math.abs(selisih))})`}
          </span>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "var(--danger)",
              background: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              borderRadius: "9px",
              padding: "10px 14px",
              marginTop: "14px",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "9px", marginTop: "18px" }}>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => submit(false)}
            disabled={!canSave}
          >
            {pending ? "Menyimpan…" : "Simpan Draf"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => submit(true)}
            disabled={!canSave}
          >
            {pending ? "Menyimpan…" : "Simpan & Bukukan"}
          </button>
        </div>
      </div>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Daftar Jurnal Umum + filter
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "semua", label: "Semua Status" },
  { value: "posted", label: "Terposting" },
  { value: "draft", label: "Draf" },
  { value: "void", label: "Dibatalkan" },
];

export function JurnalClient({
  entries,
  accounts,
  initialQ,
  initialStatus,
}: {
  entries: JournalRow[];
  accounts: AccountOption[];
  initialQ: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [showForm, setShowForm] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushFilters = (nextQ: string, nextStatus: string) => {
    const params = new URLSearchParams();
    params.set("tab", "jurnal");
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStatus !== "semua") params.set("status", nextStatus);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const onQChange = (v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => pushFilters(v, status), 450);
  };

  const onStatusChange = (v: string) => {
    setStatus(v);
    if (debounce.current) clearTimeout(debounce.current);
    pushFilters(q, v);
  };

  return (
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Jurnal Umum</h3>
            <p>
              Menampilkan {entries.length} jurnal tercatat · klik baris untuk detail
            </p>
          </div>
          <div className="spacer" />
          <div className="search-box">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Cari nomor atau keterangan…"
              value={q}
              onChange={(e) => onQChange(e.target.value)}
            />
          </div>
          <select
            className="select"
            aria-label="Filter status jurnal"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Jurnal
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "150px" }}>No. Jurnal</th>
                <th style={{ width: "120px" }}>Tanggal</th>
                <th>Keterangan</th>
                <th className="num">Debit</th>
                <th className="num">Kredit</th>
                <th style={{ width: "120px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-note">
                      Belum ada jurnal yang tercatat. Buat jurnal pertama Anda.
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((j) => (
                  <tr
                    key={j.id}
                    className="row-link"
                    onClick={() => router.push(`/keuangan/jurnal/${j.id}`)}
                  >
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {j.entry_number}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatTanggal(j.entry_date)}
                    </td>
                    <td>{j.description}</td>
                    <td className="num">{formatIDR(j.total)}</td>
                    <td className="num">{formatIDR(j.total)}</td>
                    <td>
                      <span
                        className={`badge ${
                          j.status === "posted"
                            ? "b-green"
                            : j.status === "void"
                            ? "b-red"
                            : "b-amber"
                        }`}
                      >
                        <i />
                        {STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="fin-note">
        Klik baris jurnal untuk melihat rincian baris debit/kredit.
      </p>

      {showForm && (
        <JurnalFormModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
