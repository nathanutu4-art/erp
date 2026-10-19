import type { ReactNode } from "react";

type DataTableProps = {
  title: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function DataTable({
  title,
  searchPlaceholder = "Cari…",
  searchValue,
  onSearchChange,
  actions,
  children,
}: DataTableProps) {
  return (
    <section aria-label={title}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="glass-input w-full min-h-[44px] pl-4 pr-4 rounded-xl text-sm"
          />
        </div>
        {actions}
      </div>
      <div className="glass rounded-2xl">
        <div className="tbl-wrap">{children}</div>
      </div>
    </section>
  );
}
