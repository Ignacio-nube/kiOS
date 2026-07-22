/**
 * Input propio de kiOS (no shadcn). El foco es ámbar y bien visible:
 * en el mostrador el ojo tiene que encontrar dónde está escribiendo
 * sin pensar. `size="lg"` para el buscador/scanner de la venta.
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "md", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-surface text-ink placeholder:text-muted-ink",
        "focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand",
        size === "md" && "h-10 px-3 text-sm",
        size === "lg" && "h-14 px-4 text-lg",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
