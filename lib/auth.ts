import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ProfileWithRole = {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  is_active: boolean;
  /** Nama peran dari tabel roles (mis. "admin", "finance"). null bila belum punya peran. */
  role_name: string | null;
};

export type CurrentUser = {
  user: User;
  /** null bila pengguna terautentikasi tetapi belum punya baris profil (edge case login pertama). */
  profile: ProfileWithRole | null;
};

type ProfileQueryRow = {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  is_active: boolean;
  roles: { name: string } | null;
};

/**
 * Mengambil pengguna yang sedang masuk beserta baris profil dan nama perannya.
 * Hanya dipakai di Server Component / layout terproteksi.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_id, is_active, roles(name)")
    .eq("id", user.id)
    .maybeSingle();

  const row = data as ProfileQueryRow | null;
  if (!row) return { user, profile: null };

  return {
    user,
    profile: {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role_id: row.role_id,
      is_active: row.is_active,
      role_name: row.roles?.name ?? null,
    },
  };
}
