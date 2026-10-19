import { createClient } from "@/lib/supabase/server";
import { InventarisTabs } from "./_components/InventarisTabs";
import {
  ProdukClient,
  type WarehouseOption,
} from "./_components/ProdukClient";
import { KartuStokClient } from "./_components/KartuStokClient";
import { GudangClient } from "./_components/GudangClient";
import {
  getWarehouseSummaries,
  type WarehouseSummary,
} from "./actions";
import {
  toNumber,
  one,
  type ProductWithWarehouse,
} from "./_lib/inventory";

const TABS = ["produk", "kartu-stok", "gudang"] as const;
type TabKey = (typeof TABS)[number];

type SearchParams = {
  tab?: string;
};

type RawProduct = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string | null;
  avg_cost: string | number;
  current_stock: string | number;
  min_stock: string | number;
  is_active: boolean;
};

type RawWarehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_default: boolean;
};

type RawLatestMutation = {
  product_id: string;
  warehouse:
    | { code: string; name: string }
    | Array<{ code: string; name: string }>
    | null;
};

/**
 * Daftar produk beserta gudang dari mutasi terakhir tiap produk.
 * (Skema tidak menyimpan gudang per produk; stok resmi bersifat global.)
 * Batas 2000 mutasi terbaru: cukup untuk v1, dievaluasi ulang bila
 * volume mutasi membesar.
 */
async function getProducts(): Promise<ProductWithWarehouse[]> {
  const supabase = await createClient();
  const [{ data: products }, { data: muts }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, sku, name, category, unit, avg_cost, current_stock, min_stock, is_active"
      )
      .order("sku"),
    supabase
      .from("stock_mutations")
      .select("product_id, warehouse:warehouses(code, name)")
      .order("mutation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const latest = new Map<string, { code: string; name: string }>();
  for (const m of ((muts ?? []) as RawLatestMutation[])) {
    if (latest.has(m.product_id)) continue;
    const wh = one(m.warehouse);
    if (wh) latest.set(m.product_id, { code: wh.code, name: wh.name });
  }

  return ((products ?? []) as RawProduct[]).map((p) => {
    const wh = latest.get(p.id);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit || "pcs",
      avg_cost: toNumber(p.avg_cost),
      current_stock: toNumber(p.current_stock),
      min_stock: toNumber(p.min_stock),
      is_active: p.is_active,
      latestWarehouseCode: wh?.code ?? null,
      latestWarehouseName: wh?.name ?? null,
    };
  });
}

async function getWarehouseOptions(): Promise<WarehouseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, code, name, is_default")
    .order("code");
  return ((data ?? []) as RawWarehouse[]).map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    is_default: w.is_default,
  }));
}

export default async function InventarisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabKey)
    : "produk";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">
          Inventaris & Gudang
        </h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Produk, mutasi stok dengan HPP average, kartu stok, dan gudang.
        </p>
      </div>

      <InventarisTabs active={tab} />

      <div className="mt-6">
        {tab === "produk" && <ProdukTab />}
        {tab === "kartu-stok" && <KartuStokTab />}
        {tab === "gudang" && <GudangTab />}
      </div>
    </div>
  );
}

async function ProdukTab() {
  let products: ProductWithWarehouse[] = [];
  let warehouses: WarehouseOption[] = [];
  try {
    [products, warehouses] = await Promise.all([
      getProducts(),
      getWarehouseOptions(),
    ]);
  } catch {
    products = [];
    warehouses = [];
  }
  return <ProdukClient products={products} warehouses={warehouses} />;
}

async function KartuStokTab() {
  let products: ProductWithWarehouse[] = [];
  let warehouses: WarehouseOption[] = [];
  try {
    [products, warehouses] = await Promise.all([
      getProducts(),
      getWarehouseOptions(),
    ]);
  } catch {
    products = [];
    warehouses = [];
  }
  return <KartuStokClient products={products} warehouses={warehouses} />;
}

async function GudangTab() {
  let warehouses: WarehouseSummary[] = [];
  try {
    warehouses = await getWarehouseSummaries();
  } catch {
    warehouses = [];
  }
  return <GudangClient warehouses={warehouses} />;
}
