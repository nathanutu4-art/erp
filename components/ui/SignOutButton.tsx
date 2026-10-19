"use client";

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
      className={`glass min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/15 transition-colors ${className}`}
    >
      {label}
    </button>
  );
}
