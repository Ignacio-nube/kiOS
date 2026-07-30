/**
 * Quién está en la caja, en el pie del rail de navegación. Va acá y no en
 * una pantalla porque el kiosquero tiene que VERLO desde cualquier lado
 * antes de cobrar — si cobra con el nombre del turno anterior, el cierre de
 * caja sale mal y no hay forma de darse cuenta después.
 */
import { UserRound } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { useCashierStore } from "./cashier-store";
import { cn } from "../../lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../ui/shadcn/dropdown-menu";

/** El nombre completo no entra en 64px: se muestra la primera palabra. */
function shortName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function CashierPicker({ onManage }: { onManage: () => void }) {
  const { repos } = useApp();
  const cashiers = useCashierStore((s) => s.cashiers);
  const activeId = useCashierStore((s) => s.activeId);
  const setActive = useCashierStore((s) => s.setActive);

  const active = cashiers.find((c) => c.id === activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mt-auto flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium text-muted-ink transition-colors hover:bg-muted hover:text-ink"
          title={active ? `Caja: ${active.name}` : "Elegir cajero"}
        >
          <UserRound className="size-5" />
          <span className="max-w-full truncate">{active ? shortName(active.name) : "Caja"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel>Quién está en la caja</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {cashiers.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={() => void setActive(repos, c.id)}
            className={cn(c.id === activeId && "font-semibold")}
          >
            <UserRound className={cn("size-4", c.id === activeId ? "text-brand" : "text-muted-ink")} />
            {c.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onManage}>Gestionar cajeros…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
