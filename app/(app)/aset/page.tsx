import { createClient } from "@/lib/supabase/server";
import { AsetClient, type AssetRow, type CategoryOption } from "./_components/AsetClient";
import { toNumber, one } from "./_lib/aset";

type RawAsset = {
  id: string;
  asset_code: string;
  name: string;
  category_id: string;
  purchase_date: string;
  purchase_cost: string | number;
  useful_life_months: number;
  depreciation_method: string;
  salvage_value: string | number;
  accumulated_depreciation: string | number;
  book_value: string | number;
  location: string | null;
  status: string;
  category: { code: string; name: string } | Array<{ code: string; name: string }> | null;
};

type RawCategory = {
  id: string;
  code: string;
  name: string;
  default_useful_life_months: number;
  default_depreciation_method: string;
};

async function getData(): Promise<{
  assets: AssetRow[];
  categories: CategoryOption[];
}> {
  const supabase = await createClient();
  const [{ data: assetsData }, { data: catData }] = await Promise.all([
    supabase
      .from("assets")
      .select(
        "id, asset_code, name, category_id, purchase_date, purchase_cost, useful_life_months, depreciation_method, salvage_value, accumulated_depreciation, book_value, location, status, category:asset_categories(code, name)"
      )
      .order("asset_code"),
    supabase
      .from("asset_categories")
      .select("id, code, name, default_useful_life_months, default_depreciation_method")
      .order("name"),
  ]);

  const assets: AssetRow[] = ((assetsData ?? []) as RawAsset[]).map((a) => {
    const cat = one(a.category);
    return {
      id: a.id,
      assetCode: a.asset_code,
      name: a.name,
      categoryId: a.category_id,
      categoryCode: cat?.code ?? null,
      categoryName: cat?.name ?? "—",
      purchaseDate: a.purchase_date,
      purchaseCost: toNumber(a.purchase_cost),
      usefulLifeMonths: a.useful_life_months,
      depreciationMethod: a.depreciation_method,
      salvageValue: toNumber(a.salvage_value),
      accumulatedDepreciation: toNumber(a.accumulated_depreciation),
      bookValue: toNumber(a.book_value),
      location: a.location,
      status: a.status,
    };
  });

  const categories: CategoryOption[] = ((catData ?? []) as RawCategory[]).map(
    (c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      defaultUsefulLifeMonths: c.default_useful_life_months,
      defaultDepreciationMethod: c.default_depreciation_method,
    })
  );

  return { assets, categories };
}

export default async function AsetPage() {
  let assets: AssetRow[] = [];
  let categories: CategoryOption[] = [];
  try {
    const data = await getData();
    assets = data.assets;
    categories = data.categories;
  } catch {
    assets = [];
    categories = [];
  }

  return (
    <div>
      <AsetClient assets={assets} categories={categories} />
    </div>
  );
}
