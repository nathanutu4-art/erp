import type { ButtonHTMLAttributes } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

const VARIANTS: Record<NonNullable<GlassButtonProps["variant"]>, string> = {
  primary:
    "bg-teal-400/90 text-slate-950 hover:bg-teal-300 border border-teal-200/60 shadow-[0_8px_24px_rgba(45,212,191,0.35)]",
  ghost:
    "glass text-slate-100 hover:bg-white/15 border border-white/25",
  danger:
    "bg-rose-500/85 text-white hover:bg-rose-400 border border-rose-300/50",
};

export function GlassButton({
  variant = "primary",
  className = "",
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={`min-h-[44px] px-5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
