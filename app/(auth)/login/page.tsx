"use client";

/**
 * ============================================================================
 * MODUL OTENTIKASI & MASUK SISTEM (AUTH LOGIN PAGE)
 * ============================================================================
 * 
 * Halaman masuk pengguna ke sistem ERP berbasis Supabase Auth:
 * 1. Otentikasi Email & Kata Sandi: Memverifikasi pengguna via Supabase client-side Auth.
 * 2. Penanganan Sesi & Cookie: Token sesi JWT disimpan di cookie untuk verifikasi di Next.js middleware & Server Actions.
 * 3. Pengalihan Otomatis: Mengarahkan pengguna aktif ke Dashboard setelah berhasil masuk.
 * ============================================================================
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Email atau kata sandi salah. Silakan coba lagi.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="card glass-strong w-full max-w-md p-8" style={{ backdropFilter: "var(--blur)" }}>
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="brand-mark mb-3" style={{ width: 48, height: 48, fontSize: 18 }}>
            ERP
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white m-0">
            PT Maju Bersama
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Masuk untuk mengakses sistem ERP terpadu
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label htmlFor="email">Alamat Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@perusahaan.co.id"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Kata Sandi</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm p-3 rounded-lg border font-medium"
              style={{
                background: "var(--danger-soft)",
                borderColor: "rgba(255, 122, 102, 0.35)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
            style={{ height: 44, fontSize: 14, marginTop: 12 }}
          >
            {loading ? "Memproses…" : "Masuk ke Sistem"}
          </button>
        </form>

        <div className="mt-6 pt-4 text-center border-t text-xs" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          Tahun buku 2026 · Hak Akses Internal Terproteksi
        </div>
      </div>
    </main>
  );
}
