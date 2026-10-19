"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { getLedger, type LedgerResult } from "../actions";
import { formatIDR, formatTanggal } from "@/lib/format";
import type { AccountOption } from "../_lib/finance";

function yearStartISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BukuBesarClient({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(yearStartISO());
  const [to, setTo] = useState(todayISO());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LedgerResult | null>(null);

  const load = () => {
    startTransition(async () => {
      const res = await getLedger(accountId, from, to);
      setResult(res);
    });
  };

  return (
    <div>
      <GlassCard className="p-4 sm:p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:items-end">
          <div className="md:col-span-2">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Akun
            </span>
            <select
              aria-label="Pilih akun"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              <option value="" className="text-slate-900">
                — Pilih akun —
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="text-slate-900">
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Dari Tanggal
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Sampai Tanggal
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <GlassButton
            onClick={load}
            disabled={!accountId || pending || !from || !to}
            className="w-full md:w-auto"
          >
            {pending ? "Memuat…" : "Tampilkan Buku Besar"}
          </GlassButton>
        </div>
      </GlassCard>

      {!result ? (
        <GlassCard className="p-6">
          <p className="text-sm text-slate-300/70 text-center py-8">
            Pilih akun dan rentang tanggal, lalu tekan “Tampilkan Buku Besar”.
          </p>
        </GlassCard>
      ) : !result.ok ? (
        <GlassCard className="p-6">
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {result.error}
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-2 sm:p-4">
          <div className="px-3 sm:px-4 pt-3 pb-4">
            <h2 className="text-lg font-bold text-slate-100">
              {result.account.code} — {result.account.name}
            </h2>
            <p className="text-xs text-slate-300/70 mt-1">
              Periode {formatTanggal(from)} s.d. {formatTanggal(to)}
            </p>
          </div>
          {result.rows.length === 0 ? (
            <p className="text-sm text-slate-300/70 text-center py-10 px-4">
              Tidak ada mutasi pada periode ini. Saldo awal{" "}
              {formatIDR(result.openingBalance)}.
            </p>
          ) : (
            <div className="tbl-wrap">
              <table className="min-w-[720px]">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Nomor</th>
                    <th>Keterangan</th>
                    <th className="!text-right">Debit</th>
                    <th className="!text-right">Kredit</th>
                    <th className="!text-right">Saldo Berjalan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-300/80">
                    <td colSpan={5} className="!whitespace-normal">
                      Saldo awal
                    </td>
                    <td className="!text-right font-semibold">
                      {formatIDR(result.openingBalance)}
                    </td>
                  </tr>
                  {result.rows.map((r) => (
                    <tr key={`${r.entryId}-${r.debit}-${r.credit}`}>
                      <td className="whitespace-nowrap">
                        {formatTanggal(r.entryDate)}
                      </td>
                      <td className="font-mono whitespace-nowrap">
                        {r.entryNumber}
                      </td>
                      <td className="!whitespace-normal min-w-[180px] max-w-[300px]">
                        {r.description}
                      </td>
                      <td className="!text-right whitespace-nowrap">
                        {r.debit > 0 ? formatIDR(r.debit) : "—"}
                      </td>
                      <td className="!text-right whitespace-nowrap">
                        {r.credit > 0 ? formatIDR(r.credit) : "—"}
                      </td>
                      <td
                        className={`!text-right font-semibold whitespace-nowrap ${
                          r.runningBalance < 0 ? "text-rose-200" : ""
                        }`}
                      >
                        {formatIDR(r.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/20 font-bold">
                    <td colSpan={3} className="!whitespace-normal">
                      Total mutasi periode
                    </td>
                    <td className="!text-right whitespace-nowrap">
                      {formatIDR(result.totalDebit)}
                    </td>
                    <td className="!text-right whitespace-nowrap">
                      {formatIDR(result.totalCredit)}
                    </td>
                    <td className="!text-right whitespace-nowrap">
                      {formatIDR(
                        result.rows.length > 0
                          ? result.rows[result.rows.length - 1].runningBalance
                          : result.openingBalance
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
