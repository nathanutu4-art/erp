"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/keuangan", label: "Keuangan & Akuntansi" },
  { href: "/sdm", label: "SDM & Kehadiran" },
  { href: "/inventaris", label: "Inventaris & Gudang" },
  { href: "/pembelian-penjualan", label: "Pembelian & Penjualan" },
  { href: "/crm", label: "CRM" },
  { href: "/aset", label: "Aset Tetap" },
  { href: "/pengaturan", label: "Pengaturan" },
];

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4">
        <p className="text-xl font-extrabold tracking-tight text-slate-100">
          ERP
        </p>
        <p className="text-xs text-slate-300/70 mt-0.5">PT Maju Bersama</p>
      </div>
      <ul className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center min-h-[44px] px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-teal-400/25 text-teal-100 border border-teal-300/40 shadow-[0_4px_16px_rgba(45,212,191,0.25)]"
                    : "text-slate-200/80 hover:bg-white/10 hover:text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
