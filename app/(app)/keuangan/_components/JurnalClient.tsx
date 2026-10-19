"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { createJournalEntry, type JournalLineInput } from "../actions";
import { formatIDR, formatTanggal } from "@/lib/format";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  STATUS_LABEL,
  STATUS_STYLE,
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
    <GlassModal open onClose={onClose} title="Buat Jurnal">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tanggal *
            </span>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <GlassInput
            id="jurnal-keterangan"
            label="Keterangan *"
            placeholder="mis. Penjualan tunai ke Toko Berkah"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              Baris Jurnal ({lines.length})
            </h3>
            <button
              type="button"
              onClick={addLine}
              className="min-h-[44px] px-3 rounded-xl text-sm font-semibold glass text-teal-200 border border-teal-300/40 hover:bg-white/15 transition-colors"
            >
              + Tambah Baris
            </button>
          </div>

          {lines.map((l, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300/80">
                  Baris {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}
                  aria-label={`Hapus baris ${i + 1}`}
                  className="min-w-[44px] min-h-[44px] rounded-xl text-sm font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-300/80 mb-1">
                  Akun *
                </span>
                <select
                  aria-label={`Akun baris ${i + 1}`}
                  value={l.accountId}
                  onChange={(e) =>
                    updateLine(i, { accountId: e.target.value })
                  }
                  className="glass-input w-full min-h-[44px] px-3 rounded-xl text-sm"
                >
                  <option value="" className="text-slate-900">
                    — Pilih akun —
                  </option>
                  {ACCOUNT_TYPE_ORDER.map((t) => {
                    const opts = postable.filter((a) => a.type === t);
                    if (opts.length === 0) return null;
                    return (
                      <optgroup
                        key={t}
                        label={ACCOUNT_TYPE_LABEL[t]}
                        className="text-slate-900"
                      >
                        {opts.map((a) => (
                          <option
                            key={a.id}
                            value={a.id}
                            className="text-slate-900"
                          >
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-300/80 mb-1">
                    Debit (Rp)
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="0"
                    value={l.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value })}
                    className="glass-input w-full min-h-[44px] px-3 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-300/80 mb-1">
                    Kredit (Rp)
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="0"
                    value={l.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value })}
                    className="glass-input w-full min-h-[44px] px-3 rounded-xl text-sm"
                  />
                </div>
              </div>
              {lineIssues[i] && (
                <p className="text-xs text-amber-200">{lineIssues[i]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Indikator keseimbangan langsung */}
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold flex flex-wrap items-center justify-between gap-2 ${
            balanced
              ? "bg-teal-400/15 border-teal-300/40 text-teal-200"
              : "bg-amber-400/10 border-amber-300/40 text-amber-200"
          }`}
          aria-live="polite"
        >
          <span>
            Debit {formatIDR(totals.debit)} · Kredit {formatIDR(totals.credit)}
          </span>
          {balanced ? (
            <span>✓ Seimbang</span>
          ) : (
            <span>Selisih {formatIDR(Math.abs(selisih))}</span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <GlassButton
            variant="ghost"
            onClick={onClose}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Batal
          </GlassButton>
          <GlassButton
            variant="ghost"
            onClick={() => submit(false)}
            disabled={!canSave}
            className="w-full sm:w-auto"
          >
            {pending ? "Menyimpan…" : "Simpan sebagai Draf"}
          </GlassButton>
          <GlassButton
            onClick={() => submit(true)}
            disabled={!canSave}
            className="w-full sm:w-auto"
          >
            {pending ? "Menyimpan…" : "Simpan & Bukukan"}
          </GlassButton>
        </div>
        {!balanced && (
          <p className="text-xs text-slate-400/70">
            Tombol simpan aktif setelah seluruh baris valid dan total debit =
            total kredit.
          </p>
        )}
      </div>
    </GlassModal>
  );
}

// ---------------------------------------------------------------------------
// Daftar Jurnal Umum + filter
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "semua", label: "Semua status" },
  { value: "draft", label: "Draf" },
  { value: "posted", label: "Dibukukan" },
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
    <div>
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex-1 min-w-0">
            <GlassInput
              id="cari-jurnal"
              label="Cari Jurnal"
              placeholder="Nomor atau keterangan…"
              value={q}
              onChange={(e) => onQChange(e.target.value)}
            />
          </div>
          <div className="sm:w-52">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Status
            </span>
            <select
              aria-label="Filter status jurnal"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="text-slate-900">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <GlassButton onClick={() => setShowForm(true)} className="md:shrink-0">
          + Buat Jurnal
        </GlassButton>
      </div>

      <GlassCard className="p-2 sm:p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-300/70 text-center py-10 px-4">
            Belum ada jurnal yang tercatat. Buat jurnal pertama Anda.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="min-w-[680px]">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nomor</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th className="!text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((j) => (
                  <tr key={j.id}>
                    <td className="whitespace-nowrap">
                      {formatTanggal(j.entry_date)}
                    </td>
                    <td className="font-mono font-semibold whitespace-nowrap">
                      <Link
                        href={`/keuangan/jurnal/${j.id}`}
                        className="text-teal-200 hover:text-teal-100 hover:underline"
                      >
                        {j.entry_number}
                      </Link>
                    </td>
                    <td className="!whitespace-normal min-w-[200px] max-w-[320px]">
                      <Link
                        href={`/keuangan/jurnal/${j.id}`}
                        className="hover:text-teal-100 hover:underline"
                      >
                        {j.description}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 border whitespace-nowrap ${STATUS_STYLE[j.status] ?? STATUS_STYLE.draft}`}
                      >
                        {STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="!text-right font-semibold whitespace-nowrap">
                      {formatIDR(j.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {showForm && (
        <JurnalFormModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
