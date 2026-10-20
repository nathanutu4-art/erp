"use client";

import { useState, useTransition } from "react";
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
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Buku Besar</h3>
            <p>Mutasi dan saldo berjalan per akun</p>
          </div>
          <div className="spacer" />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="select"
              style={{ height: "37px", padding: "0 10px" }}
              aria-label="Dari tanggal"
            />
            <span style={{ color: "var(--muted)", fontSize: "12.5px" }}>s/d</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="select"
              style={{ height: "37px", padding: "0 10px" }}
              aria-label="Sampai tanggal"
            />
          </div>
          <select
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={{ minWidth: "240px" }}
            aria-label="Pilih akun"
          >
            <option value="">— Pilih Akun —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={load}
            disabled={!accountId || pending || !from || !to}
          >
            {pending ? "Memuat…" : "Tampilkan"}
          </button>
        </div>

        {!result ? (
          <div className="empty-note">
            Pilih akun dan rentang tanggal di atas, lalu klik &quot;Tampilkan&quot;.
          </div>
        ) : !result.ok ? (
          <div style={{ padding: "18px 22px" }}>
            <p
              role="alert"
              style={{
                fontSize: "13px",
                color: "var(--danger)",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger)",
                borderRadius: "9px",
                padding: "10px 14px",
              }}
            >
              {result.error}
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "16px 22px 0",
                display: "flex",
                gap: "26px",
                flexWrap: "wrap",
              }}
            >
              <div className="small">
                <span className="muted">Akun</span>
                <br />
                <b>
                  {result.account.code} — {result.account.name}
                </b>
              </div>
              <div className="small">
                <span className="muted">Saldo Normal</span>
                <br />
                <b>
                  {result.account.type === "asset" || result.account.type === "expense"
                    ? "Debit"
                    : "Kredit"}
                </b>
              </div>
              <div className="small">
                <span className="muted">Saldo Awal ({formatTanggal(from)})</span>
                <br />
                <b>{formatIDR(result.openingBalance)}</b>
              </div>
              <div className="small">
                <span className="muted">Saldo Akhir ({formatTanggal(to)})</span>
                <br />
                <b className="pos">
                  {formatIDR(
                    result.rows.length > 0
                      ? result.rows[result.rows.length - 1].runningBalance
                      : result.openingBalance
                  )}
                </b>
              </div>
            </div>

            <div className="tbl-wrap" style={{ marginTop: "12px" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>Tanggal</th>
                    <th style={{ width: "130px" }}>Ref. Jurnal</th>
                    <th>Keterangan</th>
                    <th className="num">Debit</th>
                    <th className="num">Kredit</th>
                    <th className="num">Saldo Berjalan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ color: "var(--muted)" }}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatTanggal(from)}</td>
                    <td className="mono small">—</td>
                    <td>Saldo Awal</td>
                    <td className="num">—</td>
                    <td className="num">—</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatIDR(result.openingBalance)}
                    </td>
                  </tr>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-note">
                          Tidak ada mutasi transaksi pada periode ini.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((r) => (
                      <tr key={`${r.entryId}-${r.debit}-${r.credit}`}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatTanggal(r.entryDate)}
                        </td>
                        <td className="mono small">{r.entryNumber}</td>
                        <td>{r.description}</td>
                        <td className="num">
                          {r.debit > 0 ? formatIDR(r.debit) : "—"}
                        </td>
                        <td className="num">
                          {r.credit > 0 ? formatIDR(r.credit) : "—"}
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {r.runningBalance < 0 ? (
                            <span className="neg">
                              ({formatIDR(Math.abs(r.runningBalance))})
                            </span>
                          ) : (
                            formatIDR(r.runningBalance)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total Mutasi & Saldo Akhir</td>
                    <td className="num">{formatIDR(result.totalDebit)}</td>
                    <td className="num">{formatIDR(result.totalCredit)}</td>
                    <td className="num">
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
          </>
        )}
      </div>

      <p className="fin-note">
        Saldo akhir buku besar sama dengan saldo akun pada Bagan Akun dan Neraca.
      </p>
    </div>
  );
}
