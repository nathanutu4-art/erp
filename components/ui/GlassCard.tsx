/**
 * ============================================================================
 * KARTU KACA GLASSMORPHIC (GLASS CARD)
 * ============================================================================
 * 
 * Kontainer kartu transparan bertekstur kaca modern (frosted glass) yang mengikuti token desain hifi-erp.html:
 * - `card`: Menggunakan `var(--glass-fill)`, border kaca tipis, backdrop-blur 22px, dan saturasi 160%.
 * - `strong`: Varian kontras lebih tinggi (`glass-strong`) yang biasa dipakai pada modal dialog atau kartu login.
 * ============================================================================
 */

import type { HTMLAttributes } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
};

export function GlassCard({ strong, className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={`card ${strong ? "glass-strong" : ""} ${className}`}
      {...props}
    />
  );
}
