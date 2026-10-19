import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/ui/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { SignOutButton } from "@/components/ui/SignOutButton";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getCurrentUser();

  // Seharusnya tidak terjadi karena middleware sudah menjaga rute ini,
  // tetapi tetap ditangani secara defensif.
  if (!current) {
    redirect("/login");
  }

  // Edge case login pertama: pengguna terautentikasi tetapi belum punya
  // baris profil (atau profil dinonaktifkan).
  if (!current.profile || !current.profile.is_active) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <GlassCard strong className="w-full max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold text-slate-100">
            Akses Ditolak
          </h1>
          <p className="text-sm text-slate-300/80 mt-3">
            Akun Anda belum terdaftar sebagai pengguna aplikasi atau telah
            dinonaktifkan. Hubungi administrator untuk membuatkan profil
            pengguna.
          </p>
          <SignOutButton
            label="Kembali ke halaman masuk"
            className="mt-6 w-full"
          />
        </GlassCard>
      </main>
    );
  }

  return (
    <AppShell
      userName={current.profile.full_name}
      roleName={current.profile.role_name}
    >
      {children}
    </AppShell>
  );
}
