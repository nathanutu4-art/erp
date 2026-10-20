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
    <nav aria-label="Navigasi modul keuangan" className="subtabs">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "bagan-akun" ? "/keuangan" : `/keuangan?tab=${t.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`subtab ${isActive ? "active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
