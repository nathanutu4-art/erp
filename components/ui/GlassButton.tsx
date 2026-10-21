/**
 * ============================================================================
 * TOMBOL AKSI KACA (GLASS BUTTON)
 * ============================================================================
 * 
 * Komponen tombol UI yang membungkus kelas tombol `.btn` dari hifi-erp.html:
 * - `variant`:
 *   - "primary": Gradien warna teal (#14B8A6 ke #0B7A5F) dengan inset highlight dan drop-shadow glow.
 *   - "ghost": Latar belakang transparan dengan hover efek surface-3.
 *   - "danger": Tombol aksen merah lembut untuk aksi destruktif (void, hapus, pelepasan aset).
 * - `size`: Ukuran reguler (md) atau kompak (sm).
 * ============================================================================
 */

import type { ButtonHTMLAttributes } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

const VARIANTS: Record<NonNullable<GlassButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  ghost: "",
  danger: "btn-danger-ghost",
};

export function GlassButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: GlassButtonProps) {
  const sizeClass = size === "sm" ? "btn-sm" : "";
  const variantClass = VARIANTS[variant] ?? "";

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    />
  );
}
