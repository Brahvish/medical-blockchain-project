import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

type GlowColor = "teal" | "emerald" | "blue" | "purple" | "none";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: GlowColor;
  highlight?: boolean;
  style?: CSSProperties;
}

const glowStyles: Record<GlowColor, string> = {
  teal: "glow-teal",
  emerald: "glow-emerald",
  blue: "glow-blue",
  purple: "glow-purple",
  none: "",
};

export function GlassCard({
  children,
  className,
  glow = "none",
  highlight = false,
  style,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-6 transition-all duration-300",
        highlight ? "glass-card-highlight" : "glass-card",
        glowStyles[glow],
        "hover:border-border/70",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
