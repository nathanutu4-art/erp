"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  { value: "semua", label: "Semua Tipe" },
  ...ACCOUNT_TYPE_ORDER.map((t) => ({
    value: t,
    label: ACCOUNT_TYPE_LABEL[t],
  })),
];

function typeBadgeClass(t: AccountType): string {
  switch (t) {
    case "asset":
      return "b-green";
    case "liability":
      return "b-red";
    case "equity":
      return "b-blue";
    case "revenue":
      return "b-green";
    case "expense":
      return "b-amber";
    default:
      return "b-gray";
  }
}

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
      <div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="akun-kode">Kode Akun *</label>
            <input
              id="akun-kode"
              type="text"
              placeholder="mis. 1180"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="akun-tipe">Tipe Akun *</label>
            <select
              id="akun-tipe"
              aria-label="Tipe akun"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              {ACCOUNT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="akun-nama">Nama Akun *</label>
          <input
            id="akun-nama"
            type="text"
            placeholder="mis. Perlengkapan Kantor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="akun-induk">Akun Induk (opsional)</label>
          <select
            id="akun-induk"
            aria-label="Akun induk"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Tanpa induk —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isHeader}
              onChange={(e) => setIsHeader(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent)" }}
            />
            <span>
              Akun Induk / Header
              <span style={{ display: "block", fontSize: "12px", color: "var(--muted)", fontWeight: 400 }}>
                Akun header hanya mengelompokkan akun anak dan tidak dapat dijurnal langsung.
              </span>
            </span>
          </label>
        </div>

        <div className="field">
          <label htmlFor="akun-deskripsi">Deskripsi (opsional)</label>
          <input
            id="akun-deskripsi"
            type="text"
            placeholder="Keterangan singkat akun"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
              marginBottom: "14px",
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
            className="btn btn-primary"
            onClick={submit}
            disabled={!canSave}
          >
            {pending ? "Menyimpan…" : "Simpan Akun"}
          </button>
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
    <div className="fin-view on">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Bagan Akun (Chart of Accounts)</h3>
            <p>
              Menampilkan {filtered.length} dari {accounts.length} akun terdaftar
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
              placeholder="Cari kode atau nama akun…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="select"
            aria-label="Filter tipe akun"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
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
            Tambah Akun
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Kode</th>
                <th>Nama Akun</th>
                <th style={{ width: "190px" }}>Tipe</th>
                <th style={{ width: "130px" }}>Saldo Normal</th>
                <th className="num" style={{ width: "190px" }}>
                  Saldo (Rp)
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-note">
                      {accounts.length === 0
                        ? "Belum ada akun. Tambahkan akun pertama Anda."
                        : "Tidak ada akun yang cocok dengan pencarian."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const saldo = saldoNormal(a.type, a.debit, a.credit);
                  const normal =
                    a.type === "asset" || a.type === "expense"
                      ? "Debit"
                      : "Kredit";
                  return (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {a.code}
                      </td>
                      <td>
                        {a.name}
                        {a.is_header && (
                          <span
                            className="badge b-blue"
                            style={{ marginLeft: "8px", fontSize: "10.5px", padding: "1px 7px" }}
                          >
                            Header
                          </span>
                        )}
                        {!a.is_active && (
                          <span
                            className="badge b-gray"
                            style={{ marginLeft: "8px", fontSize: "10.5px", padding: "1px 7px" }}
                          >
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${typeBadgeClass(a.type)}`}>
                          <i />
                          {ACCOUNT_TYPE_LABEL[a.type]}
                        </span>
                      </td>
                      <td>{normal}</td>
                      <td className="num">
                        {saldo < 0 ? (
                          <span className="neg">({formatIDR(Math.abs(saldo))})</span>
                        ) : (
                          formatIDR(saldo)
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="fin-note">
        Saldo dihitung dari seluruh jurnal berstatus Dibukukan. Akun kontra (akumulasi penyusutan) ditampilkan sebagai pengurang bertanda kurung.
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
