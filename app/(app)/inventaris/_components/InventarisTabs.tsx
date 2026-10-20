import Link from "next/link";

const TABS = [
  { key: "produk", label: "Master Produk" },
  { key: "gudang", label: "Daftar Gudang" },
  { key: "kartu-stok", label: "Kartu Stok" },
] as const;

export function InventarisTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Navigasi modul inventaris" className="subtabs">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "produk" ? "/inventaris" : `/inventaris?tab=${t.key}`}
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
