"use client";

/**
 * ============================================================================
 * TOMBOL KELUAR SISTEM (SIGN OUT BUTTON)
 * ============================================================================
 * 
 * Komponen Client Component untuk mengakhiri sesi login pengguna:
 * 1. Menghapus sesi otentikasi melalui `supabase.auth.signOut()`.
 * 2. Membersihkan cookie sesi di browser.
 * 3. Mengarahkan kembali pengguna ke halaman `/login` dengan `router.refresh()`.
 * ============================================================================
 */

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = {
  label?: string;
  className?: string;
};

export function SignOutButton({
  label = "Keluar",
  className = "",
}: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      title="Keluar dari akun"
      aria-label="Keluar dari akun"
      className={`icon-btn ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
