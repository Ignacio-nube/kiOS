import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import type { Product } from "../../data/types";
import { STOCK_MOVEMENT_LABELS } from "../../domain/stock";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/shadcn/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/shadcn/select";

type EditableType = "restock" | "adjustment" | "shrinkage";

const TYPES: EditableType[] = ["restock", "shrinkage", "adjustment"];

export function StockMovementDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSaved: () => void;
}) {
  const { repos } = useApp();
  const [type, setType] = useState<EditableType>("restock");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!product) return;
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Ingresá una cantidad entera mayor a cero");
      return;
    }
    const qtyDelta = type === "restock" ? amount : -amount;

    setSaving(true);
    try {
      await repos.stock.addMovement({ productId: product.id, qtyDelta, type, note: note.trim() || undefined });
      toast.success("Movimiento registrado");
      setQty("");
      setNote("");
      onSaved();
    } catch (cause) {
      toast.error("No se pudo registrar", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de stock</DialogTitle>
        </DialogHeader>
        {product && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{product.name}</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as EditableType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{STOCK_MOVEMENT_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">
                Cantidad {type === "restock" ? "(entra)" : "(sale)"}
              </label>
              <Input inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Nota (opcional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: venció el lote" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
