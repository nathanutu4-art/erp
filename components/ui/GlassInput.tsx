import type { InputHTMLAttributes } from "react";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function GlassInput({ label, id, className = "", ...props }: GlassInputProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="block text-sm font-medium text-slate-200 mb-1.5">
        {label}
      </span>
      <input
        id={id}
        className={`glass-input w-full min-h-[44px] px-4 rounded-xl text-sm ${className}`}
        {...props}
      />
    </label>
  );
}
