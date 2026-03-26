import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "success" | "info" | "accent" | "ghost";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-medical-teal to-medical-teal-glow text-primary-foreground hover:opacity-90 glow-teal",
  success:
    "bg-gradient-to-r from-medical-emerald to-medical-emerald-glow text-primary-foreground hover:opacity-90 glow-emerald",
  info: "bg-gradient-to-r from-medical-blue to-medical-blue-glow text-primary-foreground hover:opacity-90 glow-blue",
  accent:
    "bg-gradient-to-r from-medical-purple to-medical-purple-glow text-primary-foreground hover:opacity-90 glow-purple",
  ghost:
    "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border",
};

export function ActionButton({
  children,
  variant = "primary",
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "px-5 py-2.5 rounded-full",
        "font-semibold text-sm",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        variantStyles[variant],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="w-4 h-4">{icon}</span>
      )}
      {children}
    </button>
  );
}
