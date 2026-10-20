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
