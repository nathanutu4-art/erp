import Link from "next/link";

const TABS = [
  { key: "bagan-akun", label: "Bagan Akun" },
  { key: "jurnal", label: "Jurnal Umum" },
  { key: "buku-besar", label: "Buku Besar" },
  { key: "laba-rugi", label: "Laba Rugi" },
  { key: "neraca", label: "Neraca" },
  { key: "arus-kas", label: "Arus Kas" },
] as const;

export function KeuanganTabs({ active }: { active: string }) {
  return (
    <nav
      aria-label="Navigasi modul keuangan"
      className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "bagan-akun" ? "/keuangan" : `/keuangan?tab=${t.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 min-h-[44px] inline-flex items-center px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              isActive
                ? "bg-teal-400/90 text-slate-950 border-teal-200/60 shadow-[0_8px_24px_rgba(45,212,191,0.35)]"
                : "glass text-slate-200 border-white/25 hover:bg-white/15"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
