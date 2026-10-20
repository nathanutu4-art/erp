"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { formatIDR } from "@/lib/format";
import { createCustomer } from "../actions";
import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_STATUS_STYLE,
} from "../_lib/crm";

export type CustomerRow = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditLimit: number;
  isActive: boolean;
  totalPiutang: number;
  hasOverdue: boolean;
};

function TambahPelangganModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSave = code.trim().length > 0 && name.trim().length > 0 && !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCustomer({
        code: code.trim(),
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        taxId: taxId.trim(),
        creditLimit: creditLimit.trim() ? Number(creditLimit) : 0,
        isActive,
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
    <GlassModal open onClose={onClose} title="Tambah Pelanggan" subtitle="Pelanggan baru akan dapat dipilih saat pembuatan invoice dan transaksi">
      <div className="space-y-4">
        <div className="field-row">
          <GlassInput
            id="cust-code"
            label="Kode Pelanggan *"
            placeholder="cth. CUST-001"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <GlassInput
            id="cust-name"
            label="Nama Pelanggan / Perusahaan *"
            placeholder="cth. PT Nusantara Retail"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <GlassInput
            id="cust-cp"
            label="Contact Person"
            placeholder="Nama kontak PIC"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <GlassInput
            id="cust-phone"
            label="No. Telepon / WhatsApp"
            placeholder="08123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="field-row">
          <GlassInput
            id="cust-email"
            type="email"
            label="Email"
            placeholder="kontak@perusahaan.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <GlassInput
            id="cust-tax"
            label="NPWP"
            placeholder="00.000.000.0-000.000"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
        </div>

        <div className="field-row">
          <GlassInput
            id="cust-limit"
            type="number"
            label="Limit Kredit (Rp)"
            placeholder="0"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
          <div className="field">
            <label htmlFor="cust-active">Status Pelanggan</label>
            <select
              id="cust-active"
              className="select"
              style={{ width: "100%" }}
              value={isActive ? "1" : "0"}
              onChange={(e) => setIsActive(e.target.value === "1")}
            >
              <option value="1">Aktif</option>
              <option value="0">Non-Aktif</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="cust-addr">Alamat Lengkap</label>
          <textarea
            id="cust-addr"
            rows={2}
            className="field"
            style={{ width: "100%", padding: "9.5px 12px" }}
            placeholder="Alamat kantor / gudang pengiriman"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        {error && <div className="err-msg" style={{ display: "block" }}>{error}</div>}

        <div className="modal-foot">
          <GlassButton variant="ghost" onClick={onClose} disabled={pending}>
            Batal
          </GlassButton>
          <GlassButton variant="primary" onClick={submit} disabled={!canSave}>
            {pending ? "Menyimpan…" : "Simpan Pelanggan"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export function CrmClient({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.code, c.name, c.contactPerson ?? "", c.phone ?? "", c.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  const totalPiutang = useMemo(
    () => filtered.reduce((s, c) => s + c.totalPiutang, 0),
    [filtered]
  );

  const totalOverdue = useMemo(
    () => filtered.filter((c) => c.hasOverdue).length,
    [filtered]
  );

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="stats-grid cols-3">
        <div className="card stat">
          <div className="s-label">Total Pelanggan Terdaftar</div>
          <div className="s-value">{customers.length}</div>
          <div className="s-foot">Mitra bisnis aktif</div>
        </div>
        <div className="card stat">
          <div className="s-label">Total Piutang Berjalan</div>
          <div className="s-value pos">{formatIDR(totalPiutang)}</div>
          <div className="s-foot">Termin pembayaran normal</div>
        </div>
        <div className="card stat">
          <div className="s-label">Perhatian Jatuh Tempo</div>
          <div className={`s-value ${totalOverdue > 0 ? "neg" : ""}`}>
            {totalOverdue} Pelanggan
          </div>
          <div className="s-foot">Memerlukan penagihan</div>
        </div>
      </div>

      <DataTable
        title="Daftar Pelanggan"
        subtitle={`Menampilkan ${filtered.length} dari ${customers.length} pelanggan`}
        searchPlaceholder="Cari nama pelanggan, kode, kota…"
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <GlassButton onClick={() => setShowModal(true)} variant="primary">
            + Tambah Pelanggan
          </GlassButton>
        }
      >
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>Kode</th>
              <th>Nama Pelanggan</th>
              <th>Contact Person</th>
              <th>Telepon / Alamat</th>
              <th className="num">Sisa Piutang</th>
              <th style={{ width: 120 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/crm/${c.id}`)}
                className="row-link"
              >
                <td className="mono" style={{ fontWeight: 600 }}>{c.code}</td>
                <td>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                </td>
                <td>{c.contactPerson || "—"}</td>
                <td className="muted small">
                  {c.phone ? <span>{c.phone} · </span> : null}
                  {c.address ? <span className="truncate">{c.address}</span> : "—"}
                </td>
                <td className="num font-semibold">
                  {c.totalPiutang > 0 ? (
                    <span className="pos">{formatIDR(c.totalPiutang)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className={`badge ${c.isActive ? "b-green" : "b-gray"}`}>
                    <i />
                    {c.isActive ? "Aktif" : "Non-aktif"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-note">
                    Tidak ada pelanggan yang cocok dengan pencarian.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DataTable>

      <p className="fin-note">
        Klik baris pelanggan untuk melihat profil, riwayat invoice dan transaksi pembayaran.
      </p>

      {showModal && (
        <TambahPelangganModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
