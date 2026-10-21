/**
 * ============================================================================
 * INPUT FORM KACA (GLASS INPUT)
 * ============================================================================
 * 
 * Elemen form standar yang menyatukan:
 * 1. Label teks di atas field input.
 * 2. Field input dengan styling transparan `var(--field)` dan focus ring teal.
 * 3. Indikator pesan kesalahan inline (`err-msg`) yang otomatis muncul jika terdapat properti `error`.
 * ============================================================================
 */

import type { InputHTMLAttributes } from "react";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function GlassInput({
  label,
  id,
  error,
  className = "",
  ...props
}: GlassInputProps) {
  return (
    <div className={`field ${error ? "invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={className} {...props} />
      {error && <div className="err-msg">{error}</div>}
    </div>
  );
}
