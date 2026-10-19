"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/ui/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-72 shrink-0 glass-strong border-r border-white/15 min-h-screen sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Drawer ponsel */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-default"
          />
          <aside className="glass-strong absolute left-0 top-0 bottom-0 w-72 border-r border-white/20">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="glass-strong border-b border-white/15 sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden glass min-w-[44px] min-h-[44px] rounded-xl text-slate-100 font-bold"
            >
              ☰
            </button>
            <p className="font-bold text-slate-100 truncate">ERP</p>
            <div className="flex-1" />
            <button
              onClick={handleLogout}
              className="glass min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/15 transition-colors"
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
