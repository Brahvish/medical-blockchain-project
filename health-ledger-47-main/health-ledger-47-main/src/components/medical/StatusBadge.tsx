import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type BadgeVariant = "default" | "patient" | "doctor" | "both" | "unregistered";

interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-border text-muted-foreground",
  patient: "border-medical-emerald/50 text-medical-emerald-glow bg-medical-emerald/10",
  doctor: "border-medical-blue/50 text-medical-blue-glow bg-medical-blue/10",
  both: "border-medical-purple/50 text-medical-purple-glow bg-medical-purple/10",
  unregistered: "border-border text-muted-foreground bg-secondary/50",
};

export function StatusBadge({
  variant = "default",
  children,
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-3 py-1 rounded-full",
        "text-sm font-medium",
        "border",
        variantStyles[variant],
        className
      )}
    >
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
}
