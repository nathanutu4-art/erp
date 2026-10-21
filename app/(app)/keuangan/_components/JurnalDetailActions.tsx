"use client";

/**
 * ============================================================================
 * AKSI DETAIL JURNAL (JOURNAL DETAIL ACTIONS)
 * ============================================================================
 * 
 * Bilah tombol kontrol status jurnal pada halaman rincian jurnal `/keuangan/jurnal/[id]`:
 * - "Bukukan Jurnal" (`postJournalEntry`): Mengubah status draf menjadi terposting (masuk ke buku besar).
 * - "Batalkan Jurnal" (`voidJournalEntry`): Membatalkan jurnal dengan konfirmasi dialog aman.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  postJournalEntry,
  voidJournalEntry,
  type ActionResult,
} from "../actions";
import type { JournalStatus } from "../_lib/finance";

export function JurnalDetailActions({
  entryId,
  status,
}: {
  entryId: string;
  status: JournalStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (id: string) => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn(entryId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div>
      {error && (
        <p
          role="alert"
          style={{
            fontSize: "13px",
            color: "var(--danger)",
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: "9px",
            padding: "8px 12px",
            marginBottom: "10px",
          }}
        >
          {error}
        </p>
      )}
      {status === "draft" && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => run(postJournalEntry)}
            disabled={pending}
          >
            {pending ? "Membukukan…" : "Bukukan Jurnal"}
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Batalkan jurnal draf ini? Jurnal yang dibatalkan tetap tersimpan untuk audit."
                )
              ) {
                run(voidJournalEntry);
              }
            }}
            disabled={pending}
          >
            Batalkan Draf
          </button>
        </div>
      )}
      {status === "posted" && (
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={() => {
            if (
              window.confirm(
                "Batalkan (void) jurnal yang sudah dibukukan ini? Jurnal void tidak lagi memengaruhi laporan, tetapi tetap tersimpan untuk audit."
              )
            ) {
              run(voidJournalEntry);
            }
          }}
          disabled={pending}
        >
          {pending ? "Membatalkan…" : "Batalkan Jurnal (Void)"}
        </button>
      )}
    </div>
  );
}
