"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
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
          className="text-sm font-medium text-rose-200 bg-rose-500/15 border border-rose-300/40 rounded-xl px-4 py-3 mb-4"
        >
          {error}
        </p>
      )}
      {status === "draft" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <GlassButton
            onClick={() => run(postJournalEntry)}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {pending ? "Membukukan…" : "Bukukan Jurnal"}
          </GlassButton>
          <GlassButton
            variant="danger"
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
            className="w-full sm:w-auto"
          >
            Batalkan Draf
          </GlassButton>
        </div>
      )}
      {status === "posted" && (
        <GlassButton
          variant="danger"
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
          className="w-full sm:w-auto"
        >
          {pending ? "Membatalkan…" : "Batalkan Jurnal (Void)"}
        </GlassButton>
      )}
    </div>
  );
}
