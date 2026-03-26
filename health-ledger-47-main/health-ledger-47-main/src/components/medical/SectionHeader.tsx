import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionHeaderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  description,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
