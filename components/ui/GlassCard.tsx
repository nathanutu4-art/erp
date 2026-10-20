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
