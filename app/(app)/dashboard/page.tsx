import { GlassCard } from "@/components/ui/GlassCard";

const KPI_PLACEHOLDERS = [
  { label: "Total Pendapatan", hint: "Bulan berjalan" },
  { label: "Laba Bersih", hint: "Bulan berjalan" },
  { label: "Saldo Kas", hint: "Semua rekening" },
  { label: "Menunggu Persetujuan", hint: "Perlu tindakan Anda" },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Ringkasan kinerja perusahaan Anda
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {KPI_PLACEHOLDERS.map((kpi) => (
          <GlassCard key={kpi.label} className="p-5">
            <p className="text-sm font-medium text-slate-300/80">{kpi.label}</p>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">—</p>
            <p className="text-xs text-slate-400/70 mt-1">{kpi.hint}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-2">
          Aktivitas Terakhir
        </h2>
        <p className="text-sm text-slate-300/70">
          Data nyata akan ditampilkan di sini pada fase berikutnya, setelah
          modul Keuangan & Akuntansi terhubung ke database.
        </p>
      </GlassCard>
    </div>
  );
}
