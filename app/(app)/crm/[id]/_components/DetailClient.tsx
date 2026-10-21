"use client";

/**
 * ============================================================================
 * KOMPONEN PROFIL LENGKAP PELANGGAN (CUSTOMER DETAIL CLIENT)
 * ============================================================================
 * 
 * Tampilan analitik 360 derajat interaksi dengan satu pelanggan tertentu:
 * 1. Kartu Ringkasan Finansial: Total Penjualan Akumulatif, Total Terbayar, Sisa Piutang Berjalan, dan Sisa Batas Kredit Tersedia.
 * 2. Riwayat Faktur Penjualan: Daftar seluruh invoice yang pernah diterbitkan beserta status pembayarannya.
 * 3. Linimasa Interaksi (Activity Timeline): Catatan komunikasi (Meeting, Telepon, Email, WhatsApp) dan tombol pencatatan aktivitas baru.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { formatIDR, formatTanggal } from "@/lib/format";
import { createInteraction } from "../../actions";
import {
  INTERACTION_TYPE_LABEL,
  INTERACTION_TYPE_ORDER,
  todayISO,
  type InteractionType,
} from "../../_lib/crm";

export type InvoiceView = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
  statusLabel: string;
  statusStyle: string;
  fakturPajakNumber: string | null;
};

export type PaymentView = {
  id: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  invoiceNumber: string;
};

export type InteractionView = {
  id: string;
  interactionDate: string;
  typeLabel: string;
  subject: string | null;
  notes: string | null;
  followUpDate: string | null;
};

function CatatInteraksiModal({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<InteractionType>("note");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = date.trim().length > 0 && !pending;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createInteraction({
        customerId,
        interactionDate: date,
        type,
        subject: subject.trim(),
        notes: notes.trim(),
        followUpDate: followUp.trim() || null,
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
    <GlassModal open onClose={onClose} title="Catat Interaksi">
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
            id="int-tanggal"
            label="Tanggal *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div>
            <span className="block text-sm font-medium text-slate-200 mb-1.5">
              Tipe Interaksi *
            </span>
            <select
              aria-label="Tipe interaksi"
              value={type}
              onChange={(e) => setType(e.target.value as InteractionType)}
              className="glass-input w-full min-h-[44px] px-4 rounded-xl text-sm"
            >
              {INTERACTION_TYPE_ORDER.map((t) => (
                <option key={t} value={t} className="text-slate-900">
                  {INTERACTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <GlassInput
          id="int-subjek"
          label="Subjek"
          placeholder="mis. Follow-up penawaran harga"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div>
          <span className="block text-sm font-medium text-slate-200 mb-1.5">
            Catatan
          </span>
          <textarea
            aria-label="Catatan interaksi"
            rows={4}
            placeholder="Ringkasan pembicaraan…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="glass-input w-full px-4 py-3 rounded-xl text-sm min-h-[100px]"
          />
        </div>
        <GlassInput
          id="int-followup"
          label="Tanggal Tindak Lanjut (opsional)"
          type="date"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
        />
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
            {pending ? "Menyimpan…" : "Simpan Interaksi"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export function DetailClient({
  customerId,
  customerName,
  invoices,
  payments,
  interactions,
}: {
  customerId: string;
  customerName: string;
  invoices: InvoiceView[];
  payments: PaymentView[];
  interactions: InteractionView[];
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <h2 className="text-base font-bold text-slate-100 mb-4">
          Riwayat Invoice
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Belum ada invoice untuk {customerName}.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-300/90">
                  <th className="py-2 pr-4 font-semibold">Nomor</th>
                  <th className="py-2 pr-4 font-semibold">Tanggal</th>
                  <th className="py-2 pr-4 font-semibold">Jatuh Tempo</th>
                  <th className="py-2 pr-4 font-semibold text-right">Total</th>
                  <th className="py-2 pr-4 font-semibold text-right">Dibayar</th>
                  <th className="py-2 pr-4 font-semibold text-right">Sisa</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t border-white/10">
                    <td className="py-2.5 pr-4 font-semibold text-slate-100">
                      {i.invoiceNumber}
                      {i.fakturPajakNumber && (
                        <div className="text-xs font-normal text-slate-400">
                          FP: {i.fakturPajakNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-200">
                      {formatTanggal(i.invoiceDate)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-200">
                      {formatTanggal(i.dueDate)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-100">
                      {formatIDR(i.totalAmount)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-teal-200">
                      {formatIDR(i.paidAmount)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-amber-200">
                      {formatIDR(Math.max(0, i.totalAmount - i.paidAmount))}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${i.statusStyle}`}
                      >
                        {i.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="text-base font-bold text-slate-100 mb-4">
          Riwayat Pembayaran
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Belum ada pembayaran tercatat.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-slate-300/90">
                  <th className="py-2 pr-4 font-semibold">Tanggal</th>
                  <th className="py-2 pr-4 font-semibold">Invoice</th>
                  <th className="py-2 pr-4 font-semibold">Metode</th>
                  <th className="py-2 font-semibold text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2.5 pr-4 text-slate-200">
                      {formatTanggal(p.paymentDate)}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-slate-100">
                      {p.invoiceNumber}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-200">
                      {p.method || "—"}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-teal-200">
                      {formatIDR(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-100 flex-1">
            Linimasa Interaksi
          </h2>
          <GlassButton onClick={() => setShowModal(true)}>
            + Catat Interaksi
          </GlassButton>
        </div>
        {interactions.length === 0 ? (
          <GlassCard className="p-8">
            <p className="text-sm text-slate-400 text-center">
              Belum ada interaksi tercatat dengan {customerName}.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {interactions.map((t) => (
              <GlassCard key={t.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border bg-teal-400/20 text-teal-200 border-teal-300/40">
                    {t.typeLabel}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTanggal(t.interactionDate)}
                  </span>
                  {t.followUpDate && (
                    <span className="text-xs font-medium text-amber-200">
                      Tindak lanjut: {formatTanggal(t.followUpDate)}
                    </span>
                  )}
                </div>
                {t.subject && (
                  <p className="text-sm font-semibold text-slate-100">
                    {t.subject}
                  </p>
                )}
                {t.notes && (
                  <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">
                    {t.notes}
                  </p>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CatatInteraksiModal
          customerId={customerId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
