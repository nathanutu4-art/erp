"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";

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
    <main className="min-h-screen flex items-center justify-center p-4">
      <GlassCard strong className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <p className="text-3xl font-extrabold tracking-tight text-slate-100">
            ERP
          </p>
          <p className="text-sm text-slate-300/80 mt-2">
            Masuk untuk mengelola perusahaan Anda
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.id"
          />
          <GlassInput
            id="password"
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && (
            <p role="alert" className="text-sm text-rose-300 font-medium">
              {error}
            </p>
          )}
          <GlassButton type="submit" disabled={loading} className="w-full">
            {loading ? "Memproses…" : "Masuk"}
          </GlassButton>
        </form>
      </GlassCard>
    </main>
  );
}
