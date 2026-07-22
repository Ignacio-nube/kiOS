/** Pantalla vacía = invitación a actuar, nunca un hueco mudo. */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      {Icon && <Icon className="mb-1 size-8 text-muted-ink" aria-hidden />}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-ink">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
