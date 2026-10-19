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
    <GlassModal open onClose={onClose} title="Tambah Pelanggan">
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="cust-kode"
            label="Kode Pelanggan *"
            placeholder="mis. CUST-0001"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <GlassInput
            id="cust-nama"
            label="Nama Pelanggan *"
            placeholder="mis. PT Maju Jaya"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="cust-kontak"
            label="Nama Kontak"
            placeholder="Nama PIC"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <GlassInput
            id="cust-telp"
            label="Telepon"
            placeholder="mis. 0812xxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <GlassInput
          id="cust-email"
          label="Email"
          type="email"
          placeholder="mis. info@perusahaan.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <GlassInput
          id="cust-alamat"
          label="Alamat"
          placeholder="Jalan, kota"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            id="cust-npwp"
            label="NPWP"
            placeholder="Nomor NPWP"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
          <GlassInput
            id="cust-limit"
            label="Batas Kredit (Rp)"
            type="number"
            min="0"
            placeholder="0"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-5 h-5 accent-teal-400"
          />
          <span className="text-sm font-medium text-slate-200">
            Pelanggan aktif
          </span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
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

  return (
    <>
      <DataTable
        title="Daftar Pelanggan"
        searchPlaceholder="Cari kode, nama, kontak…"
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <GlassButton onClick={() => setShowModal(true)}>
            + Tambah Pelanggan
          </GlassButton>
        }
      >
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-slate-300/90">
              <th className="px-4 py-3 font-semibold">Pelanggan</th>
              <th className="px-4 py-3 font-semibold">Kontak</th>
              <th className="px-4 py-3 font-semibold">Kota / Alamat</th>
              <th className="px-4 py-3 font-semibold text-right">
                Total Piutang
              </th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/crm/${c.id}`)}
                className="border-t border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.code}</div>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {c.contactPerson || "—"}
                  {c.phone && (
                    <div className="text-xs text-slate-400">{c.phone}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-200 max-w-[220px] truncate">
                  {c.address || "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-100">
                  {formatIDR(c.totalPiutang)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        CUSTOMER_STATUS_STYLE[
                          c.isActive ? "active" : "inactive"
                        ]
                      }`}
                    >
                      {CUSTOMER_STATUS_LABEL[c.isActive ? "active" : "inactive"]}
                    </span>
                    {c.hasOverdue && (
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-500/20 text-rose-200 border-rose-300/40">
                        Menunggak
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  {customers.length === 0
                    ? "Belum ada pelanggan. Tambahkan pelanggan pertama Anda."
                    : "Tidak ada pelanggan yang cocok dengan pencarian."}
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/15">
                <td
                  colSpan={3}
                  className="px-4 py-3 text-right font-semibold text-slate-200"
                >
                  Total Piutang
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-slate-100">
                  {formatIDR(totalPiutang)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </DataTable>
      {showModal && <TambahPelangganModal onClose={() => setShowModal(false)} />}
    </>
  );
}
