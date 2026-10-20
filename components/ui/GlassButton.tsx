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
