"use client";

/**
 * ============================================================================
 * KOMPONEN JADWAL AMORTISASI & PENYUSUTAN ASET (DEPRECIATION SCHEDULE CLIENT)
 * ============================================================================
 * 
 * Menampilkan dan mengelola jadwal depresiasi bulanan per aset tetap:
 * 1. Tabel Amortisasi: Periode berjalan (YYYY-MM), beban penyusutan per bulan,
 *    akumulasi depresiasi, dan sisa nilai buku (book value).
 * 2. Pembukuan Otomatis: Tombol "Bukukan Depresiasi" untuk mengeksekusi
 *    Server Action `postDepreciation`, yang secara otomatis membuat entri jurnal umum
 *    (Beban Depresiasi pada Akumulasi Depresiasi) di modul akuntansi.
 * 3. Status Terbuku: Menampilkan lencana nomor referensi jurnal terkait jika periode
 *    tersebut sudah dibukukan ke buku besar.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { formatIDR } from "@/lib/format";
import { postDepreciation } from "../../actions";
import { formatPeriode } from "../../_lib/aset";

export type ScheduleView = {
  id: string;
  periodDate: string;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isPosted: boolean;
  journalEntryId: string | null;
  journalEntryNumber: string | null;
};

export function JadwalClient({
  assetId,
  assetStatus,
  schedules,
}: {
  assetId: string;
  assetStatus: string;
  schedules: ScheduleView[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastPosted, setLastPosted] = useState<string | null>(null);

  const canPost = assetStatus !== "disposed";

  const bukukan = (scheduleId: string) => {
    setError(null);
    setLastPosted(null);
    setPendingId(scheduleId);
    startTransition(async () => {
      const res = await postDepreciation(scheduleId);
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLastPosted(
        `Periode dibukukan sebagai jurnal ${res.entryNumber ?? ""}.`
      );
      router.refresh();
    });
  };

  return (
    <GlassCard className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-slate-100 flex-1">
          Jadwal Penyusutan
        </h2>
        <p className="text-xs text-slate-400">
          Jurnal otomatis: Dr Beban Penyusutan / Cr Akumulasi Penyusutan
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3 mb-4"
        >
          {error}
        </p>
      )}
      {lastPosted && (
        <p
          role="status"
          className="text-sm font-medium text-teal-200 bg-teal-500/15 border border-teal-300/40 rounded-xl px-4 py-3 mb-4"
        >
          {lastPosted}
        </p>
      )}

      {schedules.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          Jadwal penyusutan belum tersedia untuk aset ini.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-slate-300/90">
                <th className="py-2 pr-4 font-semibold">Periode</th>
                <th className="py-2 pr-4 font-semibold text-right">
                  Penyusutan
                </th>
                <th className="py-2 pr-4 font-semibold text-right">Akumulasi</th>
                <th className="py-2 pr-4 font-semibold text-right">
                  Nilai Buku
                </th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="py-2.5 pr-4 font-semibold text-slate-100">
                    {formatPeriode(s.periodDate)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-100">
                    {formatIDR(s.depreciationAmount)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-200">
                    {formatIDR(s.accumulatedDepreciation)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-200">
                    {formatIDR(s.bookValue)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {s.isPosted ? (
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border bg-teal-400/20 text-teal-200 border-teal-300/40 whitespace-nowrap">
                        Dibukukan
                        {s.journalEntryNumber
                          ? ` · ${s.journalEntryNumber}`
                          : ""}
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-400/20 text-amber-200 border-amber-300/40 whitespace-nowrap">
                        Menunggu
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {!s.isPosted && canPost ? (
                      <GlassButton
                        onClick={() => bukukan(s.id)}
                        disabled={pendingId !== null}
                        className="!min-h-[40px] !px-4 !text-xs"
                      >
                        {pendingId === s.id ? "Memproses…" : "Bukukan"}
                      </GlassButton>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
