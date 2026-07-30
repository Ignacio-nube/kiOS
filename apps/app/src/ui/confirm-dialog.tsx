/**
 * Reemplazo de `window.confirm()`: un diálogo nativo del navegador CONGELA
 * la ventana mientras está abierto (y con eso, cualquier automatización o
 * testing remoto que la controle). `confirm()` acá abajo es la misma firma
 * imperativa pero resuelve una Promise<boolean> contra un <AlertDialog> del
 * propio diseño — se llama desde cualquier handler, sin JSX en el call site.
 *
 * `<ConfirmDialogHost />` se monta UNA vez en el shell (igual que <Toaster>).
 */
import { create } from "zustand";
import { Button } from "./button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPrimitive,
  AlertDialogTitle,
} from "./shadcn/alert-dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta "Confirmar" en rojo: para bajas y otras acciones que cuesta deshacer. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  title: "",
  description: undefined,
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  danger: false,
  resolve: null,
}));

/** Análogo async de `window.confirm(mensaje)`: `await confirm({ title })`. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Si ya había un diálogo pendiente (no debería pasar: son modales),
    // no lo dejamos colgado sin resolver.
    useConfirmStore.getState().resolve?.(false);
    useConfirmStore.setState({
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? "Confirmar",
      cancelLabel: options.cancelLabel ?? "Cancelar",
      danger: options.danger ?? false,
      open: true,
      resolve,
    });
  });
}

function settle(value: boolean) {
  const { resolve } = useConfirmStore.getState();
  useConfirmStore.setState({ open: false, resolve: null });
  resolve?.(value);
}

export function ConfirmDialogHost() {
  const { open, title, description, confirmLabel, cancelLabel, danger } = useConfirmStore();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogPrimitive.Cancel asChild>
            <Button variant="outline" onClick={() => settle(false)}>
              {cancelLabel}
            </Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild>
            <Button variant={danger ? "danger" : "primary"} onClick={() => settle(true)}>
              {confirmLabel}
            </Button>
          </AlertDialogPrimitive.Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
