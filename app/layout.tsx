/**
 * ============================================================================
 * ROOT LAYOUT (GLOBAL APPLICATION WRAPPER)
 * ============================================================================
 * 
 * Layout tingkat teratas Next.js App Router:
 * 1. Pemuatan Font: Memuat Google Fonts (Plus Jakarta Sans untuk UI body, JetBrains Mono untuk angka/kode).
 * 2. Visual Aurora Canvas: Merender 4 orb gradien animasi di belakang layar untuk efek glassmorphism modern.
 * 3. Konfigurasi Metadata: Judul default dan deskripsi meta aplikasi ERP.
 * ============================================================================
 */

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ERP — PT Maju Bersama",
  description: "Sistem ERP — aplikasi web single-tenant untuk perusahaan umum di Indonesia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="aurora" aria-hidden="true">
          <div className="orb o1" />
          <div className="orb o2" />
          <div className="orb o3" />
          <div className="orb o4" />
        </div>
        {children}
      </body>
    </html>
  );
}
