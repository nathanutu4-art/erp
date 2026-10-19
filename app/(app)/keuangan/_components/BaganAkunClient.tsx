"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { createAccount } from "../actions";
import { formatIDR } from "@/lib/format";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  saldoNormal,
  type AccountType,
} from "../_lib/finance";

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentCode: string | null;
  parentName: string | null;
  is_header: boolean;
  is_active: boolean;
  debit: number;
  credit: number;
};

const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "semua", label: "Semua tipe" },
  ...ACCOUNT_TYPE_ORDER.map((t) => ({
    value: t,
    label: ACCOUNT_TYPE_LABEL[t],
  })),
];

function TambahAkunModal({
  accounts,
  onClose,
}: {
  accounts: AccountRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [parentId, setParentId] = useState("");
  const [isHeader, setIsHeader] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave =
    code.trim().length > 0 && name.trim().length > 0 && !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAccount({
        code: code.trim(),
        name: name.trim(),
        type,
        parentId: parentId || null,
        isHeader,
        description: description.trim(),
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
    <GlassModal open onClose={onClose} title="Tambah Akun">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="akun-kode"
            label="Kode Akun *"
            placeholder="mis. 1180"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tipe Akun *
            </span>
            <select
              aria-label="Tipe akun"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {ACCOUNT_TYPE_ORDER.map((t) => (
                <option key={t} value={t} className="text-slate-900">
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <GlassInput
          id="akun-nama"
          label="Nama Akun *"
          placeholder="mis. Perlengkapan Kantor"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Akun Induk (opsional)
          </span>
          <select
            aria-label="Akun induk"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
          >
            <option value="" className="text-slate-900">
              — Tanpa induk —
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="text-slate-900">
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isHeader}
            onChange={(e) => setIsHeader(e.target.checked)}
            className="mt-1 h-5 w-5 accent-teal-400"
          />
          <span className="text-sm text-slate-200">
            Akun induk / header
            <span className="block text-xs text-slate-300/70 mt-0.5">
              Akun header hanya mengelompokkan akun anak dan tidak dapat
              dijurnal langsung.
            </span>
          </span>
        </label>

        <GlassInput
          id="akun-deskripsi"
          label="Deskripsi (opsional)"
          placeholder="Keterangan singkat akun"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

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
            onClick={submit}
            disabled={!canSave}
            className="w-full sm:w-auto"
          >
            {pending ? "Menyimpan…" : "Simpan Akun"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export function BaganAkunClient({ accounts }: { accounts: AccountRow[] }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("semua");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (typeFilter !== "semua" && a.type !== typeFilter) return false;
      if (!s) return true;
      return (
        a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
      );
    });
  }, [accounts, q, typeFilter]);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex-1 min-w-0">
            <GlassInput
              id="cari-akun"
              label="Cari Akun"
              placeholder="Kode atau nama akun…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="sm:w-52">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tipe
            </span>
            <select
              aria-label="Filter tipe akun"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value} className="text-slate-900">
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <GlassButton onClick={() => setShowModal(true)} className="md:shrink-0">
          + Tambah Akun
        </GlassButton>
      </div>

      <GlassCard className="p-2 sm:p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-300/70 text-center py-10 px-4">
            {accounts.length === 0
              ? "Belum ada akun. Tambahkan akun pertama Anda."
              : "Tidak ada akun yang cocok dengan pencarian."}
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="min-w-[640px]">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Akun</th>
                  <th>Tipe</th>
                  <th>Induk</th>
                  <th className="!text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const saldo = saldoNormal(a.type, a.debit, a.credit);
                  return (
                    <tr key={a.id}>
                      <td className="font-mono font-semibold">{a.code}</td>
                      <td className="!whitespace-normal min-w-[180px]">
                        {a.name}
                        <span className="ml-2 space-x-1">
                          {a.is_header && (
                            <span className="inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-violet-400/20 text-violet-200 border-violet-300/40">
                              Header
                            </span>
                          )}
                          {!a.is_active && (
                            <span className="inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 border bg-slate-400/20 text-slate-300 border-slate-300/40">
                              Nonaktif
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 border bg-sky-400/15 text-sky-200 border-sky-300/40">
                          {ACCOUNT_TYPE_LABEL[a.type]}
                        </span>
                      </td>
                      <td className="text-slate-300/80">
                        {a.parentCode ? `${a.parentCode}` : "—"}
                      </td>
                      <td
                        className={`!text-right font-semibold ${
                          saldo < 0 ? "text-rose-200" : ""
                        }`}
                      >
                        {formatIDR(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <p className="text-xs text-slate-400/70 mt-3">
        Saldo dihitung dari seluruh jurnal berstatus Dibukukan.
      </p>

      {showModal && (
        <TambahAkunModal
          accounts={accounts}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
