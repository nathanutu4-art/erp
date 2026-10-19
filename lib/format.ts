/** Format angka menjadi Rupiah Indonesia, mis. Rp 1.250.000 */
export function formatIDR(
  value: number | string | null | undefined
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

/** Format tanggal ISO menjadi "20 Okt 2026" */
export function formatTanggal(
  isoDate: string | null | undefined
): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.length <= 10 ? `${isoDate}T00:00:00` : isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Nama bulan berjalan, mis. "Oktober 2026" */
export function namaBulanBerjalan(): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}
